import { z } from 'zod'
import { memoryItemSchema } from './memory'
import { timeZoneSchema } from './needs'
import { countWords, talkInputSchema, TALK_REPLY_MAX } from './talk'

// "Tell me about you" (docs/application/features/v2-memory-requirements.md, R18–R25): a one-time
// step after sign-in where the person tells the pet about themselves, and one model call turns it
// into up to INTRO_FACTS_MAX facts and a line from the pet. The facts go through the same checks
// as talking's (`checkFact`); the attempts are counted on the server.

/** The most words the intro takes, spoken or typed (Mert, 2026-10-04: about 20–25 seconds). */
export const INTRO_WORDS_MAX = 60
/** The most characters, once trimmed: 60 long words, with room for names. */
export const INTRO_TEXT_MAX = 480
/** The most facts one intro keeps (R21). */
export const INTRO_FACTS_MAX = 8
/** Answered model calls per pet (R22). A call that failed uses none. */
export const INTRO_ATTEMPTS_MAX = 2

/** Where the person left when they skipped (R24): before recording, at review, or after 0 facts. */
export const INTRO_SKIP_STEPS = ['record', 'review', 'empty_result'] as const
export type IntroSkipStep = (typeof INTRO_SKIP_STEPS)[number]

/**
 * POST /api/app/v1/pet/intro. Either what the person said, with a message id made on the phone
 * (a retry is recognised and never calls the model twice), or Skip, which ends the step for good.
 */
export const introSendBody = z
	.object({
		message_id: z.uuid(),
		text: z
			.string()
			.trim()
			.min(1)
			.max(INTRO_TEXT_MAX)
			.refine((text) => countWords(text) <= INTRO_WORDS_MAX, {
				message: `At most ${INTRO_WORDS_MAX} words`
			}),
		input: talkInputSchema,
		time_zone: timeZoneSchema
	})
	.strict()
export const introSkipBody = z
	.object({ skip: z.literal(true), step: z.enum(INTRO_SKIP_STEPS) })
	.strict()
export const introBody = z.union([introSendBody, introSkipBody])
export type IntroSendBody = z.infer<typeof introSendBody>
export type IntroBody = z.infer<typeof introBody>

/**
 * - `saved`: the model answered; `facts` are what was kept (maybe none).
 * - `retried`: this message id had already been answered: the facts it kept, no new call.
 * - `skipped`: the step is over; nothing kept.
 *
 * `line` is the pet's answer for the bubble (null on skip). `attempts_left` is how many answered
 * calls remain, and `intro_due` whether the step is still open: false once it kept a fact, was
 * skipped, or used both attempts.
 */
export const introResponse = z.object({
	outcome: z.enum(['saved', 'retried', 'skipped']),
	facts: z.array(memoryItemSchema).max(INTRO_FACTS_MAX),
	line: z.string().min(1).max(TALK_REPLY_MAX).nullable(),
	attempts_left: z.number().int().min(0).max(INTRO_ATTEMPTS_MAX),
	intro_due: z.boolean()
})
export type IntroResponse = z.infer<typeof introResponse>
