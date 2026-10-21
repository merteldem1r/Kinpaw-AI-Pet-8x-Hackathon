import { z } from 'zod'
import { actionSchema, LOW_NEED, NEED_MAX, timeZoneSchema, type Needs } from './needs'
import { petSchema } from './pets'
import { rememberedSchema } from './memory'

// Talking to the pet (M6, docs/application/features/m6-talk-requirements.md): the fixed list of
// intents the model chooses from, what each one does to the needs, the daily limit, and the
// shape of POST /api/app/v1/pet/talk. The model only names an intent; what an intent does is
// decided here (product.md, "Talking"), and the app and the server run the same rules.

/**
 * What the person said, as the model names it. `affectionate` is about the pet ("I love you");
 * an everyday happy remark is `kind`; `upset` is the person's own distress and is never
 * answered as `harsh`.
 */
export const INTENTS = [
	'affectionate',
	'kind',
	'playful',
	'neutral',
	'harsh',
	'apology',
	'upset'
] as const
export const intentSchema = z.enum(INTENTS)
export type Intent = z.infer<typeof intentSchema>

/** How the words reached the pet: spoken into the mic, or typed instead. */
export const TALK_INPUTS = ['voice', 'typed'] as const
export const talkInputSchema = z.enum(TALK_INPUTS)
export type TalkInput = z.infer<typeof talkInputSchema>

/** The most a person can send in one message, once trimmed (the type-instead field's limit). */
export const TALK_TEXT_MAX = 280
/**
 * The most words in one message, spoken or typed (Mert, 2026-10-02: fair to everyone, and keeps
 * each reply cheap). Listening stops by itself at the last one; the field takes no more.
 */
export const TALK_WORDS_MAX = 20

/** The words in `text`: runs of non-space characters. */
export function countWords(text: string): number {
	const trimmed = text.trim()
	return trimmed ? trimmed.split(/\s+/).length : 0
}

/** `text` cut to its first `max` words, single-spaced; unchanged when it has no more than that. */
export function firstWords(text: string, max: number): string {
	if (countWords(text) <= max) return text
	return text.trim().split(/\s+/).slice(0, max).join(' ')
}

/** The longest reply the bubble shows; a longer one is cut at a sentence boundary. */
export const TALK_REPLY_MAX = 200
/** How many earlier exchanges the phone sends along, so the pet can follow a conversation. */
export const RECENT_EXCHANGES_MAX = 3

/** One earlier exchange: what was said, and what the pet answered. Kept on the phone only. */
export const exchangeSchema = z.object({
	said: z.string().trim().min(1).max(TALK_TEXT_MAX),
	reply: z.string().trim().min(1).max(TALK_REPLY_MAX)
})
export type Exchange = z.infer<typeof exchangeSchema>

// ── What talking does to the needs ───────────────────────────────────────────

/** The two needs talking can move. Hunger and energy never change from talking. */
export type TalkGains = { happiness: number; affection: number }
const TALKED_NEEDS = ['happiness', 'affection'] as const satisfies readonly (keyof TalkGains)[]

export const NO_GAINS: TalkGains = { happiness: 0, affection: 0 }

/** Each intent's change (product.md, "Talking"; the starting values, tune freely). */
export const TALK_EFFECTS: Record<Intent, TalkGains> = {
	affectionate: { happiness: 3, affection: 6 },
	kind: { happiness: 2, affection: 4 },
	playful: { happiness: 4, affection: 2 },
	neutral: { happiness: 0, affection: 2 },
	harsh: { happiness: -6, affection: 0 },
	apology: { happiness: 4, affection: 2 },
	upset: { happiness: 0, affection: 3 }
}

/** Talking alone never takes a need below this: low (below 30) is for neglect, not words. */
export const TALK_FLOOR = LOW_NEED

/**
 * The most talking can add in one local day; past it the pet still answers, the numbers stay.
 * Raised with the daily rhythm (needs-rhythm R8, 2026-10-02; were 15 and 20).
 */
export const TALK_DAILY_CAP: TalkGains = { happiness: 25, affection: 30 }

/**
 * The needs after a reply with this intent, and what actually changed. `gainedToday` is what
 * talking has already added today (rises only: a harsh word earlier never makes room for more
 * kindness). A rise stops at the daily cap and at 100; a drop stops at the floor, and a need
 * already at or below the floor doesn't drop at all.
 *
 * The needs are fractions, but what talking adds stays a whole number (it is recorded in
 * pet_talks as one): a rise stops at the last whole point under 100, a drop at the last whole
 * point above the floor.
 */
export function applyTalk(
	needs: Needs,
	intent: Intent,
	gainedToday: TalkGains
): { needs: Needs; added: TalkGains } {
	const next = { ...needs }
	const added = { ...NO_GAINS }
	for (const need of TALKED_NEEDS) {
		const change = TALK_EFFECTS[intent][need]
		const current = needs[need]
		let delta = 0
		if (change > 0) {
			const room = Math.max(0, TALK_DAILY_CAP[need] - gainedToday[need])
			delta = Math.min(change, room, Math.floor(NEED_MAX - current))
		} else if (change < 0 && current > TALK_FLOOR) {
			delta = Math.max(change, -Math.floor(current - TALK_FLOOR))
		}
		next[need] = current + delta
		added[need] = delta
	}
	return { needs: next, added }
}

// ── The daily limit ──────────────────────────────────────────────────────────

/** Free accounts get this many counted replies per local day; Plus is unlimited. */
export const FREE_TALKS_PER_DAY = 10

/** How many a free account has left after `countedToday`. Never below 0. */
export function messagesLeft(countedToday: number): number {
	return Math.max(0, FREE_TALKS_PER_DAY - countedToday)
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>()

/**
 * The calendar day at `at` in `timeZone`, as YYYY-MM-DD: the day a reply counts for, so the
 * limit and the caps reset at the person's own midnight. The zone is the caller's to validate
 * (`isValidTimeZone`).
 */
export function localDay(at: Date, timeZone: string): string {
	let formatter = dayFormatters.get(timeZone)
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-US', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		})
		dayFormatters.set(timeZone, formatter)
	}
	const parts = formatter.formatToParts(at)
	const part = (type: string) => parts.find((p) => p.type === type)!.value
	return `${part('year')}-${part('month')}-${part('day')}`
}

/**
 * The intent as analytics may see it. `upset` hints at someone's state of mind, so events say
 * `other`; the real label stays in the server's ai_usage only (product.md, "Measurement").
 */
export function analyticsIntent(intent: Intent): Exclude<Intent, 'upset'> | 'other' {
	return intent === 'upset' ? 'other' : intent
}

// ── POST /api/app/v1/pet/talk ────────────────────────────────────────────────

/**
 * Say something to the pet. `message_id` is generated on the phone, so a retry is recognised
 * and never counts twice. `recent` is the phone's short memory, oldest first. Nothing else:
 * the needs, the count and the plan are the server's.
 */
export const talkBody = z
	.object({
		message_id: z.uuid(),
		text: z
			.string()
			.trim()
			.min(1)
			.max(TALK_TEXT_MAX)
			.refine((text) => countWords(text) <= TALK_WORDS_MAX, {
				message: `At most ${TALK_WORDS_MAX} words`
			}),
		input: talkInputSchema,
		time_zone: timeZoneSchema,
		recent: z.array(exchangeSchema).max(RECENT_EXCHANGES_MAX),
		/**
		 * The phone will speak the reply (v2 voice, on and no VoiceOver): the server starts making
		 * the voice as soon as the reply exists, for `POST /pet/voice` to pick up. Unset: no voice.
		 */
		voice: z.boolean().optional()
	})
	.strict()
export type TalkBody = z.infer<typeof talkBody>

/**
 * - `replied`: the pet answered and the reply counted.
 * - `retried`: this message id had already counted (the phone lost the first answer): a fresh
 *   reply, and nothing changed or counted again.
 * - `limit_reached`: a free account with nothing left today. No reply; the needs as they are.
 *
 * `messages_left` is null for Plus. The pet's needs are as stored, like every pet response.
 * `remembered` (v2, v2-memory-requirements.md R15) is the fact this reply kept, when it kept one;
 * `recalled` (R15b) the fact it brought up from memory. Each is absent otherwise, and ignored by
 * builds from before memory.
 */
export const talkResponse = z.discriminatedUnion('outcome', [
	z.object({
		outcome: z.enum(['replied', 'retried']),
		reply: z.string().min(1).max(TALK_REPLY_MAX),
		intent: intentSchema,
		suggested_action: actionSchema.nullable(),
		need_changed: z.boolean(),
		pet: petSchema,
		messages_left: z.number().int().min(0).nullable(),
		remembered: rememberedSchema.optional(),
		recalled: rememberedSchema.optional()
	}),
	z.object({
		outcome: z.literal('limit_reached'),
		pet: petSchema,
		messages_left: z.literal(0)
	})
])
export type TalkResponse = z.infer<typeof talkResponse>
