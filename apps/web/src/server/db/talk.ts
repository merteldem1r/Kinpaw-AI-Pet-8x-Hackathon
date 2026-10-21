import type { Prisma, PrismaClient } from '@prisma/client'
import { applyTalk, NO_GAINS, type Intent, type TalkGains, type TalkInput } from '@app/contract'
import { db } from './client'
import { changeNeeds, type PetRecord } from './pets'

// The replies that counted (prisma/schema/talk.prisma: pet_talks), for POST /api/app/v1/pet/talk
// (docs/application/features/m6-talk-requirements.md, R7–R12). They decide the daily limit and
// the daily caps. No words are ever stored: only the message id, the day, the intent and what
// the reply changed. Every method takes the user id the route verified, never one from the
// request.

/** A day's counted replies for one pet, and what talking has already added (rises only). */
export type TalkDay = { counted: number; gained: TalkGains }

/** The day so far, and whether this message id has already counted (a retry). */
export type TalkStatus = TalkDay & { alreadyCounted: boolean }

export type NewTalk = {
	/** Generated on the phone: the row's key, so a retry never counts twice. */
	messageId: string
	intent: Intent
	input: TalkInput
	timeZone: string
	/** YYYY-MM-DD in `timeZone`, from `localDay`. */
	day: string
	/** Counted replies allowed today: FREE_TALKS_PER_DAY, or null for Plus. */
	dailyLimit: number | null
	now?: Date
}

/**
 * - `replied`: counted now; the needs moved by the intent.
 * - `retried`: this message id had already counted; nothing changed.
 * - `limit_reached`: the day was full by the time the reply arrived (two messages raced for the
 *   last one); nothing changed.
 */
export type TalkOutcome = 'replied' | 'retried' | 'limit_reached'

export type AppliedTalk = {
	row: PetRecord
	outcome: TalkOutcome
	added: TalkGains
	/** Counted replies today, this one included. */
	countedToday: number
	/** This was the account's first counted reply ever (activation). */
	first: boolean
}

type Reader = PrismaClient | Prisma.TransactionClient

/** A date column holds the day itself; Prisma passes it as midnight UTC. */
const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`)

async function dayOf(reader: Reader, petId: string, day: string): Promise<TalkDay> {
	const [row] = await reader.$queryRaw<{ counted: bigint; happiness: bigint; affection: bigint }[]>`
		select count(*) as counted,
			coalesce(sum(greatest(happiness_added, 0)), 0) as happiness,
			coalesce(sum(greatest(affection_added, 0)), 0) as affection
		from public.pet_talks
		where pet_id = ${petId}::uuid and local_day = ${day}::date`
	return {
		counted: Number(row?.counted ?? 0),
		gained: { happiness: Number(row?.happiness ?? 0), affection: Number(row?.affection ?? 0) }
	}
}

export function createTalkStore(client: PrismaClient) {
	return {
		/**
		 * The day so far for the person's pet, read before the model is called, so a full day
		 * costs no model call. Null when the person has no pet.
		 */
		async status(userId: string, messageId: string, day: string): Promise<TalkStatus | null> {
			const pet = await client.pet.findUnique({ where: { userId }, select: { id: true } })
			if (!pet) return null
			const [today, counted] = await Promise.all([
				dayOf(client, pet.id, day),
				client.petTalk.findFirst({
					where: { messageId, petId: pet.id },
					select: { messageId: true }
				})
			])
			return { ...today, alreadyCounted: counted !== null }
		},

		/**
		 * A reply this person's pet counted under `messageId` at or after `since`, with what picks
		 * its spoken voice (v2-voice-requirements.md, R2–R4): the intent, and the pet's species
		 * and preset. Null when there is none: someone else's message, too old, or never counted.
		 */
		async countedReply(
			userId: string,
			messageId: string,
			since: Date
		): Promise<{ intent: string; species: string; preset: string } | null> {
			const row = await client.petTalk.findFirst({
				where: { messageId, createdAt: { gte: since }, pet: { userId } },
				select: { intent: true, pet: { select: { species: true, preset: true } } }
			})
			return row ? { intent: row.intent, species: row.pet.species, preset: row.pet.preset } : null
		},

		/**
		 * Counts a reply and applies its intent, under the needs lock (`changeNeeds`), so the
		 * limit, the caps and a retry are decided one message at a time. Null when the person has
		 * no pet.
		 */
		async apply(userId: string, talk: NewTalk): Promise<AppliedTalk | null> {
			const now = talk.now ?? new Date()
			const applied = await changeNeeds(
				client,
				userId,
				talk.timeZone,
				now,
				async (current, petId, tx) => {
					const unchanged = (outcome: TalkOutcome, countedToday: number) => ({
						needs: current,
						result: { outcome, added: NO_GAINS, countedToday, first: false }
					})
					const today = await dayOf(tx, petId, talk.day)
					// A message id is a random uuid from the phone; one already stored is a retry.
					const seen = await tx.petTalk.findUnique({
						where: { messageId: talk.messageId },
						select: { messageId: true }
					})
					if (seen) return unchanged('retried', today.counted)
					if (talk.dailyLimit !== null && today.counted >= talk.dailyLimit) {
						return unchanged('limit_reached', today.counted)
					}

					const first =
						(await tx.petTalk.findFirst({ where: { petId }, select: { messageId: true } })) === null
					const { needs, added } = applyTalk(current, talk.intent, today.gained)
					await tx.petTalk.create({
						data: {
							messageId: talk.messageId,
							petId,
							localDay: asDate(talk.day),
							intent: talk.intent,
							input: talk.input,
							happinessAdded: added.happiness,
							affectionAdded: added.affection,
							createdAt: now
						}
					})
					return {
						needs,
						result: { outcome: 'replied' as const, added, countedToday: today.counted + 1, first }
					}
				}
			)
			return applied && { row: applied.row, ...applied.result }
		}
	}
}

export type TalkStore = ReturnType<typeof createTalkStore>

export const talkStore = createTalkStore(db)
