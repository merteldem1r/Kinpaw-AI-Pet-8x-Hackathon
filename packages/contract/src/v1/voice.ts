import { z } from 'zod'
import { TALK_REPLY_MAX } from './talk'

// Mochi speaks (docs/application/features/v2-voice-requirements.md): a counted talk reply, read
// aloud in a voice the server picks from the pet's species and preset. The phone asks for it
// after the text is shown, with the message id the reply counted under.

/** A reply is spoken only within this many minutes of counting (R4). */
export const VOICE_WINDOW_MINUTES = 10
/**
 * Voiced replies a person a day (UTC), by plan, decided on the server (R5; Mert, 2026-10-06, was
 * 30 for everyone): free 5 (half of a free day's 10 messages), Plus 20. On Inworld that holds a
 * free user's voice to about $0.15 a month and a heavy Plus user's to about $0.60. Past it,
 * replies come as text only.
 */
export const VOICE_DAILY_FREE = 5
export const VOICE_DAILY_PLUS = 20
/** Voiced replies for the whole app a day: a safety switch of about $1 (R5). */
export const VOICE_DAILY_ALL = 1000

/** What a voice is for: a talk reply, or "Tell me about you"'s answer (2026-10-06). */
export const VOICE_SOURCES = ['talk', 'intro'] as const
export type VoiceSource = (typeof VOICE_SOURCES)[number]

/**
 * POST /api/app/v1/pet/voice: the words the talk or intro route just gave, and the message id
 * they were answered under. `from` unset is a talk reply (as the first builds sent it).
 */
export const voiceBody = z
	.object({
		message_id: z.uuid(),
		text: z.string().trim().min(1).max(TALK_REPLY_MAX),
		from: z.enum(VOICE_SOURCES).optional()
	})
	.strict()
export type VoiceBody = z.infer<typeof voiceBody>

/** How much faster than recorded the phone may play a voice: a pet sounds smaller played faster. */
export const VOICE_RATE_MIN = 0.5
export const VOICE_RATE_MAX = 2

/**
 * - `spoken`: play `audio_url` (an audio file on fal's storage), about `duration_ms` long (0 when
 *   the model doesn't say), at `playback_rate` without pitch correction, so above 1 the pet's
 *   voice is higher as well as quicker (varispeed).
 * - `limited`: a daily limit is reached; the text stands, nothing to play and nothing to show.
 */
export const voiceResponse = z.discriminatedUnion('outcome', [
	z.object({
		outcome: z.literal('spoken'),
		audio_url: z.url(),
		duration_ms: z.number().int().min(0),
		playback_rate: z.number().min(VOICE_RATE_MIN).max(VOICE_RATE_MAX)
	}),
	z.object({ outcome: z.literal('limited') })
])
export type VoiceResponse = z.infer<typeof voiceResponse>
