import {
	localDay,
	localWeekday,
	MEMORY_CAP_FREE,
	MEMORY_CAP_PLUS,
	saysUnder13,
	type IntroSendBody
} from '@app/contract'
import { aiUsageStore } from '@/server/db/ai-usage'
import { introStore, type IntroRecordResult } from '@/server/db/intro'
import type { MemoryRecord } from '@/server/db/memory'
import { petStore } from '@/server/db/pets'
import { profileStore } from '@/server/db/profiles'
import { log } from '@/server/lib/logger'
import type { IntroResult, ReplyFailure, ReplyProvider } from './reply-provider'
import { talkPetOf } from './talk-to-pet'

// "Tell me about you", start to finish, without HTTP (docs/application/features/
// v2-memory-requirements.md, R18–R24). The route (app/api/app/v1/pet/intro) turns the result into
// a response and records the events; this decides what happens:
//
//   1. the step as it stands: closed, or this message already answered (a retry), means no call
//   2. someone who says they are under 13: no call, nothing kept, the step ends (R4, decision 11)
//   3. one model call; a failure uses no attempt (decision 7)
//   4. the attempt recorded and its facts kept, in one transaction (introStore.record)
//   5. one ai_usage row per model call, whatever happened
//
// What was said and the pet's line are passed through, never stored and never logged.

/** The pet's line when the call kept nothing: try again, or later (R23). */
export const INTRO_EMPTY_LINE = 'Tell me more about you sometime!'
/** The line for a retried message: its facts are already kept, and the model isn't asked again. */
export const INTRO_RETRIED_LINE = "I remember what you told me. I'm so glad we met!"
/** The line for someone under 13: kind, and about nothing they said. */
export const INTRO_YOUNG_LINE = "It's so nice to meet you! Let's play and talk lots."

export type IntroFlowRequest = {
	userId: string
	body: IntroSendBody
	provider: ReplyProvider
	now?: Date
}

export type IntroFlowResult =
	| { kind: 'no_pet' }
	| { kind: 'closed' }
	| { kind: 'conflict' }
	| { kind: 'failed'; failure: ReplyFailure }
	| {
			kind: 'answered'
			/** `retried`: this message had already been answered; nothing new was kept. */
			outcome: 'saved' | 'retried'
			line: string
			facts: MemoryRecord[]
			attemptsLeft: number
			due: boolean
	  }

export async function introduce({
	userId,
	body,
	provider,
	now = new Date()
}: IntroFlowRequest): Promise<IntroFlowResult> {
	const status = await introStore.status(userId, body.message_id)
	if (status.kind === 'no_pet' || status.kind === 'closed') return status
	if (status.kind === 'retried') return retried(status)

	const today = localDay(now, body.time_zone)
	if (saysUnder13(body.text)) {
		return answered(
			await introStore.record(userId, {
				messageId: body.message_id,
				facts: [],
				cap: MEMORY_CAP_FREE,
				today,
				end: true,
				now
			}),
			INTRO_YOUNG_LINE,
			{ keepLine: true }
		)
	}

	const pet = await petStore.get(userId)
	if (!pet) return { kind: 'no_pet' }
	const [premium, personName] = await Promise.all([
		profileStore.isPremium(userId),
		profileStore.personName(userId)
	])
	const answer = await provider.intro({
		pet: talkPetOf(pet, body.time_zone, now),
		said: body.text,
		personName,
		today,
		weekday: localWeekday(now, body.time_zone)
	})
	await recordUsage(userId, provider, answer)
	if (!answer.ok) return { kind: 'failed', failure: answer.failure }

	const recorded = await introStore.record(userId, {
		messageId: body.message_id,
		facts: answer.answer.facts,
		cap: premium ? MEMORY_CAP_PLUS : MEMORY_CAP_FREE,
		today,
		now
	})
	return answered(recorded, answer.answer.line)
}

function retried(status: Extract<IntroRecordResult, { kind: 'retried' }>): IntroFlowResult {
	return {
		kind: 'answered',
		outcome: 'retried',
		line: status.facts.length > 0 ? INTRO_RETRIED_LINE : INTRO_EMPTY_LINE,
		facts: status.facts,
		attemptsLeft: status.attemptsLeft,
		due: status.due
	}
}

/**
 * The flow's result for a recorded attempt. The model's line names what it heard, so with nothing
 * kept it is replaced by INTRO_EMPTY_LINE, unless `keepLine` (a written line already).
 */
function answered(
	recorded: IntroRecordResult,
	line: string,
	{ keepLine = false }: { keepLine?: boolean } = {}
): IntroFlowResult {
	switch (recorded.kind) {
		case 'no_pet':
		case 'closed':
		case 'conflict':
			return recorded
		case 'retried':
			return retried(recorded)
		case 'saved':
			return {
				kind: 'answered',
				outcome: 'saved',
				line: recorded.facts.length > 0 || keepLine ? line : INTRO_EMPTY_LINE,
				facts: recorded.facts,
				attemptsLeft: recorded.attemptsLeft,
				due: recorded.due
			}
	}
}

/** Bookkeeping: a usage row that can't be written is logged, never a failed intro. */
async function recordUsage(
	userId: string,
	provider: ReplyProvider,
	answer: IntroResult
): Promise<void> {
	try {
		await aiUsageStore.record({
			userId,
			provider: provider.name,
			model: provider.model,
			inputTokens: answer.usage.inputTokens,
			outputTokens: answer.usage.outputTokens,
			latencyMs: answer.latencyMs,
			outcome: answer.ok ? 'replied' : answer.failure,
			intent: null,
			purpose: 'intro'
		})
	} catch (err) {
		log.error('ai usage not recorded', { source: 'intro', err })
	}
}
