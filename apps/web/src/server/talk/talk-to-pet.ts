import {
	decayNeeds,
	isDue,
	likelyWorry,
	mentionsFact,
	wholeNeeds,
	FREE_TALKS_PER_DAY,
	localDay,
	localWeekday,
	MEMORY_CAP_FREE,
	MEMORY_CAP_PLUS,
	messagesLeft,
	type MemoryCategory,
	type MemoryKind,
	type TalkBody
} from '@app/contract'
import { toWirePet } from '@/server/api/pet-wire'
import { aiUsageStore, type AiUsageEntry } from '@/server/db/ai-usage'
import { needsOf, petStore, type PetRecord } from '@/server/db/pets'
import { profileStore } from '@/server/db/profiles'
import { talkStore } from '@/server/db/talk'
import { memoryStore, type MemoryRecord } from '@/server/db/memory'
import { log } from '@/server/lib/logger'
import type {
	MemoryOp,
	PetReply,
	PromptMemoryContext,
	ReplyFailure,
	ReplyProvider,
	ReplyResult,
	TalkPet
} from './reply-provider'

// Saying something to the pet, start to finish, without HTTP (docs/application/features/
// m6-talk-requirements.md, R7–R16). The route (app/api/app/v1/pet/talk) turns the result into a
// response and records the events; this decides what happens:
//
//   1. the day so far: a free account with nothing left gets the limit, and no model call
//   2. the pet's reply, from the provider, with the pet as it is right now
//   3. the reply counted and its intent applied, under the needs lock (talkStore.apply)
//   4. one ai_usage row per model call, whatever happened
//   5. long-term memory (v2-memory-requirements.md, R9–R14): the facts picked for what was said
//      go into the prompt, and a fact the reply asks to keep is saved after the reply counted.
//      Memory never decides a reply: a fact that can't be picked or saved is logged, never shown.
//
// What was said and the reply are passed through, never stored and never logged. A kept fact is
// the model's short note about the person, checked (@app/contract, checkFact), never the words.

export type TalkRequest = {
	userId: string
	body: TalkBody
	provider: ReplyProvider
	now?: Date
}

export type TalkResult =
	| { kind: 'no_pet' }
	| { kind: 'limit_reached'; pet: PetRecord }
	| { kind: 'failed'; failure: ReplyFailure }
	| {
			kind: 'answered'
			/** `retried`: this message had already counted; nothing changed or counted again. */
			outcome: 'replied' | 'retried'
			pet: PetRecord
			reply: PetReply
			needChanged: boolean
			/** Null for Plus. */
			messagesLeft: number | null
			/** The account's first counted reply ever: activation. */
			first: boolean
			/** The fact this reply kept (R15), or null. */
			remembered: KeptMemory | null
			/** The fact this reply brought up from memory (R15b), checked against its words, or null. */
			recalled: { id: string; text: string } | null
	  }

/** A fact a reply kept: what the app shows, and the labels the route records (never the text). */
export type KeptMemory = {
	id: string
	text: string
	category: MemoryCategory
	kind: MemoryKind
	replaced: boolean
}

/** The pet as the prompt sees it: its needs decayed to now in the person's time zone, whole. */
export function talkPetOf(row: PetRecord, timeZone: string, now: Date): TalkPet {
	const pet = toWirePet(row)
	const { needs, storedAt } = needsOf(row)
	return {
		name: pet.name,
		appearance: pet.appearance,
		preset: pet.preset,
		traits: pet.traits,
		needs: wholeNeeds(decayNeeds(needs, storedAt, now, timeZone))
	}
}

export async function talkToPet({
	userId,
	body,
	provider,
	now = new Date()
}: TalkRequest): Promise<TalkResult> {
	const pet = await petStore.get(userId)
	if (!pet) return { kind: 'no_pet' }

	const day = localDay(now, body.time_zone)
	const [premium, status, personName] = await Promise.all([
		profileStore.isPremium(userId),
		talkStore.status(userId, body.message_id, day),
		profileStore.personName(userId)
	])
	if (!status) return { kind: 'no_pet' }
	const dailyLimit = premium ? null : FREE_TALKS_PER_DAY
	const picked = await pickFacts(userId, body.text, day, now)
	// A retry of a message that already counted still gets its answer, even on a full day.
	if (!status.alreadyCounted && dailyLimit !== null && status.counted >= dailyLimit) {
		return { kind: 'limit_reached', pet }
	}

	const answer = await provider.reply({
		pet: talkPetOf(pet, body.time_zone, now),
		said: body.text,
		recent: body.recent,
		personName,
		memory: promptMemory(picked, body.text, day, localWeekday(now, body.time_zone))
	})
	if (!answer.ok) {
		await recordUsage(userId, provider, answer, answer.failure)
		return { kind: 'failed', failure: answer.failure }
	}

	const applied = await talkStore.apply(userId, {
		messageId: body.message_id,
		intent: answer.reply.intent,
		input: body.input,
		timeZone: body.time_zone,
		day,
		dailyLimit,
		now
	})
	await recordUsage(userId, provider, answer, applied?.outcome ?? 'replied')
	if (!applied) return { kind: 'no_pet' }
	if (applied.outcome === 'limit_reached') return { kind: 'limit_reached', pet: applied.row }
	// A retry already had its chance to keep a fact (R14).
	const remembered =
		applied.outcome === 'replied' && answer.reply.memory
			? await keep(userId, answer.reply.memory, picked, { premium, day, now })
			: null

	return {
		kind: 'answered',
		outcome: applied.outcome,
		pet: applied.row,
		reply: answer.reply,
		needChanged: applied.added.happiness !== 0 || applied.added.affection !== 0,
		messagesLeft: dailyLimit === null ? null : messagesLeft(applied.countedToday),
		first: applied.first,
		remembered,
		recalled: recalledFact(answer.reply, picked)
	}
}

/**
 * The note the reply says it brought up, when the reply really mentions it (R15b). Logged by its
 * ref only, so the console shows which note a reply used while developing, never its words.
 */
function recalledFact(
	reply: PetReply,
	picked: MemoryRecord[]
): { id: string; text: string } | null {
	if (!reply.recalled) return null
	const fact = picked.find((_, index) => refOf(index) === reply.recalled)
	const shown = fact !== undefined && mentionsFact(reply.reply, fact)
	log.info('talk recalled a note', { source: 'talk', recalled: reply.recalled, shown })
	return shown ? { id: fact.id, text: fact.text } : null
}

/** The facts for this message (R9), or none when they can't be read: the pet still answers. */
async function pickFacts(
	userId: string,
	said: string,
	day: string,
	now: Date
): Promise<MemoryRecord[]> {
	try {
		return await memoryStore.pick(userId, said, day, now)
	} catch (err) {
		log.error('memory not picked', { source: 'talk', err })
		return []
	}
}

/** The prompt's view of the picked facts: m1, m2… in the order picked (R10). */
function promptMemory(
	picked: MemoryRecord[],
	said: string,
	day: string,
	weekday: string
): PromptMemoryContext {
	const worry = likelyWorry(picked, said, day)
	return {
		today: day,
		weekday,
		facts: picked.map((fact, index) => ({
			ref: refOf(index),
			text: fact.text,
			kind: fact.kind,
			followUp: fact.followUp,
			followUpOn: fact.followUpOn,
			due: isDue(fact, day),
			worry: fact === worry
		}))
	}
}

const refOf = (index: number) => `m${index + 1}`

/**
 * Saves what the reply asked to keep (R12–R14): a replace names a fact by its ref, which is
 * turned back into its row here, so the model never sees or sends an id. Null when nothing was
 * kept: a duplicate, no pet, or a failure, which is logged without the fact.
 */
async function keep(
	userId: string,
	op: MemoryOp,
	picked: MemoryRecord[],
	{ premium, day, now }: { premium: boolean; day: string; now: Date }
): Promise<KeptMemory | null> {
	const replacing =
		op.action === 'replace' ? picked.find((_, index) => refOf(index) === op.ref) : undefined
	try {
		const saved = await memoryStore.save(
			userId,
			replacing
				? { action: 'replace', id: replacing.id, fact: op.fact }
				: { action: 'add', fact: op.fact },
			{ cap: premium ? MEMORY_CAP_PLUS : MEMORY_CAP_FREE, source: 'talk', today: day, now }
		)
		if (saved.kind !== 'saved') return null
		const { id, text, category, kind } = saved.memory
		return { id, text, category, kind, replaced: saved.replaced }
	} catch (err) {
		log.error('memory not saved', { source: 'talk', err })
		return null
	}
}

/** Bookkeeping: a usage row that can't be written is logged, never a failed reply. */
async function recordUsage(
	userId: string,
	provider: ReplyProvider,
	answer: ReplyResult,
	outcome: AiUsageEntry['outcome']
): Promise<void> {
	try {
		await aiUsageStore.record({
			userId,
			provider: provider.name,
			model: provider.model,
			inputTokens: answer.usage.inputTokens,
			outputTokens: answer.usage.outputTokens,
			latencyMs: answer.latencyMs,
			outcome,
			intent: answer.ok ? answer.reply.intent : null
		})
	} catch (err) {
		log.error('ai usage not recorded', { source: 'talk', outcome, err })
	}
}
