import type { Prisma, PrismaClient } from '@prisma/client'
import { INTRO_ATTEMPTS_MAX, type NewMemory } from '@app/contract'
import { db } from './client'
import { keepFact, toRecord, type MemoryRecord } from './memory'

// "Tell me about you" (prisma/schema/memory.prisma: pet_intro_attempts; pets.intro_finished_at),
// for the intro route (docs/application/features/v2-memory-requirements.md, R21–R24). Every method
// takes the user id the route verified and reaches the rows through that person's pet.
//
// The step is open while `intro_finished_at` is null and fewer than INTRO_ATTEMPTS_MAX calls have
// answered. One row per answered call, keyed by the phone's message id: a retry finds its row and
// never calls the model again. A call that failed writes nothing, so it uses no attempt.

/**
 * Before a model call:
 * - `open`: the step is open; the call may go ahead.
 * - `retried`: this message was already answered: the intro facts the pet still keeps.
 * - `closed`: skipped, kept a fact, or used both attempts. No call.
 * - `no_pet`: the person has no pet.
 */
export type IntroStatus =
	| { kind: 'open'; attemptsLeft: number }
	| { kind: 'retried'; facts: MemoryRecord[]; attemptsLeft: number; due: boolean }
	| { kind: 'closed' }
	| { kind: 'no_pet' }

/**
 * After a model call, or for someone under 13 without one (`end`):
 * - `saved`: the attempt is recorded and its facts kept (maybe none).
 * - `retried`, `closed`: as above; another request got there first, so nothing was written.
 * - `conflict`: the message id is another pet's.
 */
export type IntroRecordResult =
	| { kind: 'saved'; facts: MemoryRecord[]; attemptsLeft: number; due: boolean }
	| Exclude<IntroStatus, { kind: 'open' }>
	| { kind: 'conflict' }

export type IntroRecord = {
	messageId: string
	/** Already checked (`checkFact`), at most INTRO_FACTS_MAX. */
	facts: readonly NewMemory[]
	/** MEMORY_CAP_FREE or MEMORY_CAP_PLUS, from the server's premium check. */
	cap: number
	/** YYYY-MM-DD in the person's time zone. */
	today: string
	/** Ends the step whatever was kept (someone under 13, R4). */
	end?: boolean
	now?: Date
}

type IntroPet = { id: string; introFinishedAt: Date | null }

const attemptsLeft = (finished: boolean, used: number) =>
	finished ? 0 : Math.max(0, INTRO_ATTEMPTS_MAX - used)

async function introFacts(tx: Prisma.TransactionClient | PrismaClient, petId: string) {
	const rows = await tx.petMemory.findMany({
		where: { petId, source: 'intro' },
		orderBy: { createdAt: 'asc' }
	})
	return rows.map(toRecord)
}

/** Where the step stands for this message, read in the caller's transaction or client. */
async function statusOf(
	tx: Prisma.TransactionClient | PrismaClient,
	pet: IntroPet,
	messageId: string
): Promise<IntroStatus | { kind: 'conflict' }> {
	const [mine, used] = await Promise.all([
		tx.petIntroAttempt.findUnique({ where: { id: messageId }, select: { petId: true } }),
		tx.petIntroAttempt.count({ where: { petId: pet.id } })
	])
	const finished = pet.introFinishedAt !== null
	if (mine) {
		if (mine.petId !== pet.id) return { kind: 'conflict' }
		return {
			kind: 'retried',
			facts: await introFacts(tx, pet.id),
			attemptsLeft: attemptsLeft(finished, used),
			due: !finished && used < INTRO_ATTEMPTS_MAX
		}
	}
	if (finished || used >= INTRO_ATTEMPTS_MAX) return { kind: 'closed' }
	return { kind: 'open', attemptsLeft: INTRO_ATTEMPTS_MAX - used }
}

const PET_FIELDS = { id: true, introFinishedAt: true } as const

export function createIntroStore(client: PrismaClient) {
	return {
		/** Whether the step is still open (`intro_due`, R18). Null without a pet. */
		async due(userId: string): Promise<boolean | null> {
			const pet = await client.pet.findUnique({
				where: { userId },
				select: { introFinishedAt: true, _count: { select: { introAttempts: true } } }
			})
			if (!pet) return null
			return pet.introFinishedAt === null && pet._count.introAttempts < INTRO_ATTEMPTS_MAX
		},

		/**
		 * An answered intro call of this person's pet, recorded under `messageId` at or after
		 * `since`, with what picks its spoken voice (v2-voice): the pet's species and preset. Null
		 * when there is none: someone else's, too old, or never answered.
		 */
		async answeredAttempt(
			userId: string,
			messageId: string,
			since: Date
		): Promise<{ species: string; preset: string } | null> {
			const row = await client.petIntroAttempt.findFirst({
				where: { id: messageId, createdAt: { gte: since }, pet: { userId } },
				select: { pet: { select: { species: true, preset: true } } }
			})
			return row ? { species: row.pet.species, preset: row.pet.preset } : null
		},

		/** Where the step stands before a model call. A message id of another pet's is `closed`. */
		async status(userId: string, messageId: string): Promise<IntroStatus> {
			const pet = await client.pet.findUnique({ where: { userId }, select: PET_FIELDS })
			if (!pet) return { kind: 'no_pet' }
			const status = await statusOf(client, pet, messageId)
			return status.kind === 'conflict' ? { kind: 'closed' } : status
		},

		/**
		 * Records an answered call and keeps its facts (R21–R24), in one transaction that holds this
		 * person's intro lock, so two calls at once can't both take the last attempt. The step is
		 * checked again under the lock: a call that lost the race keeps nothing. Each fact goes
		 * through the memory rules (no duplicates, the cap); the step ends once a fact is kept,
		 * both attempts are used, or `end` says so.
		 */
		async record(userId: string, attempt: IntroRecord): Promise<IntroRecordResult> {
			const { messageId, facts, cap, today, end = false, now = new Date() } = attempt
			return client.$transaction(async (tx) => {
				// Locked before the pet is read, so its intro_finished_at is the latest.
				await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`pet_intro:${userId}`}))`
				const pet = await tx.pet.findUnique({ where: { userId }, select: PET_FIELDS })
				if (!pet) return { kind: 'no_pet' }
				const status = await statusOf(tx, pet, messageId)
				if (status.kind !== 'open') return status

				const kept: MemoryRecord[] = []
				for (const fact of facts) {
					const saved = await keepFact(
						tx,
						pet.id,
						{ action: 'add', fact },
						{ cap, source: 'intro', today, now }
					)
					if (saved.kind === 'saved') kept.push(saved.memory)
				}
				await tx.petIntroAttempt.create({
					data: { id: messageId, petId: pet.id, factsSaved: kept.length, createdAt: now }
				})
				const used = INTRO_ATTEMPTS_MAX - status.attemptsLeft + 1
				const finished = end || kept.length > 0 || used >= INTRO_ATTEMPTS_MAX
				if (finished) {
					await tx.pet.update({ where: { id: pet.id }, data: { introFinishedAt: now } })
				}
				return {
					kind: 'saved',
					facts: kept,
					attemptsLeft: attemptsLeft(finished, used),
					due: !finished
				}
			})
		},

		/** Skip (R24): ends the step for good. False without a pet. Skipping twice changes nothing. */
		async skip(userId: string, now: Date = new Date()): Promise<boolean> {
			const pet = await client.pet.findUnique({ where: { userId }, select: PET_FIELDS })
			if (!pet) return false
			await client.pet.updateMany({
				where: { id: pet.id, introFinishedAt: null },
				data: { introFinishedAt: now }
			})
			return true
		}
	}
}

export type IntroStore = ReturnType<typeof createIntroStore>

export const introStore = createIntroStore(db)
