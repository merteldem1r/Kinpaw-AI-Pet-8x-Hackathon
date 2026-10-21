import { z } from 'zod'
import { appearanceSchema, moodSchema } from './appearance'
import { ALL_GOOD, LOW_NEED, NEEDS, shown, timeZoneSchema, type Need, type Needs } from './needs'

// Friends (v2, docs/application/features/v2-friends-requirements.md): add a friend by their QR
// code and see their pet. Mutual on add; read-only; the server decides everything from the
// verified caller, and the app never sends a user id.

/** The most friends one person can have (R5). Checked for both people on an add. */
export const FRIENDS_MAX = 50

// ── The code (R7) ────────────────────────────────────────────────────────────

/** No look-alikes: no 0/O, 1/I/L. 31 characters, so 31⁸ codes. */
export const FRIEND_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const FRIEND_CODE_LENGTH = 8
const FRIEND_CODE_RE = new RegExp(`^[${FRIEND_CODE_ALPHABET}]{${FRIEND_CODE_LENGTH}}$`)

/**
 * A typed or scanned code as stored: upper case, without spaces or the dash. Null when it can't
 * be a code (wrong length, a character not in the alphabet).
 */
export function normalizeFriendCode(input: string): string | null {
	const code = input.toUpperCase().replace(/[\s-]/g, '')
	return FRIEND_CODE_RE.test(code) ? code : null
}

/** How a code is shown and read out: two groups of four, `KP7X-M3QD`. */
export function formatFriendCode(code: string): string {
	return `${code.slice(0, 4)}-${code.slice(4)}`
}

/** A code as an input: normalised, and refused (400) when it can't be one. */
export const friendCodeSchema = z
	.string()
	.max(32)
	.transform((input, ctx) => {
		const code = normalizeFriendCode(input)
		if (code === null) {
			ctx.addIssue({ code: 'custom', message: 'Not a friend code.' })
			return z.NEVER
		}
		return code
	})

// ── A friend's pet (R11, R13) ────────────────────────────────────────────────

/** A need as a friend sees it: words, never the number (R11). */
export const NEED_BANDS = ['low', 'okay', 'good'] as const
export const needBandSchema = z.enum(NEED_BANDS)
export type NeedBand = z.infer<typeof needBandSchema>

/** Low under `LOW_NEED`, good at `ALL_GOOD` or more, by the whole number people see. */
export function needBand(value: number): NeedBand {
	const whole = shown(value)
	if (whole < LOW_NEED) return 'low'
	return whole >= ALL_GOOD ? 'good' : 'okay'
}

export function needBands(needs: Needs): Record<Need, NeedBand> {
	return Object.fromEntries(NEEDS.map((need) => [need, needBand(needs[need])])) as Record<
		Need,
		NeedBand
	>
}

/**
 * A friend's pet, exactly what a friend may see (R13): its look, name, mood and the four needs
 * as bands, decayed to now in the viewer's time zone. Never its id, traits, preset, the exact
 * needs or anything about its owner's account. Strict, so a field added by mistake on the server
 * fails the response check (a logged 500), never reaches a friend.
 */
export const friendPetSchema = z
	.object({
		appearance: appearanceSchema,
		name: z.string(),
		mood: moodSchema,
		needs: z.object({
			hunger: needBandSchema,
			happiness: needBandSchema,
			energy: needBandSchema,
			affection: needBandSchema
		})
	})
	.strict()
export type FriendPet = z.infer<typeof friendPetSchema>

/**
 * A friend in the caller's list. `id` is the friendship's, never the friend's user id.
 * `display_name` is null when they haven't set one: the app says "{pet}'s human". `pet` is null
 * only if their pet is gone (it never is in v1: a pet goes with its account).
 */
export const friendSchema = z
	.object({
		id: z.uuid(),
		display_name: z.string().nullable(),
		since: z.iso.datetime(),
		pet: friendPetSchema.nullable()
	})
	.strict()
export type Friend = z.infer<typeof friendSchema>

/** Who a code belongs to, before adding (R8): no ids at all. */
export const friendPreviewSchema = z
	.object({
		display_name: z.string().nullable(),
		pet: friendPetSchema.nullable()
	})
	.strict()
export type FriendPreview = z.infer<typeof friendPreviewSchema>

// ── The routes (R17–R21) ─────────────────────────────────────────────────────

/** GET /api/app/v1/friends: the caller's code (made when there is none) and friends, newest first. */
export const getFriendsQuery = z.object({ time_zone: timeZoneSchema }).strict()
export const getFriendsResponse = z.object({
	code: z.string(),
	friends: z.array(friendSchema)
})
export type GetFriendsResponse = z.infer<typeof getFriendsResponse>

/** POST /api/app/v1/friends/lookup: whose code this is. Writes nothing. */
export const lookupFriendBody = z
	.object({ code: friendCodeSchema, time_zone: timeZoneSchema })
	.strict()
export const lookupFriendResponse = z.object({ friend: friendPreviewSchema })

/** How the adder's code arrived: a link (the Camera app or a shared message) or typed. */
export const FRIEND_ADD_SOURCES = ['link', 'typed'] as const
export type FriendAddSource = (typeof FRIEND_ADD_SOURCES)[number]

/** POST /api/app/v1/friends: add. 201 added, 200 already friends (`existing`). Safe to retry. */
export const addFriendBody = z
	.object({
		code: friendCodeSchema,
		source: z.enum(FRIEND_ADD_SOURCES),
		time_zone: timeZoneSchema
	})
	.strict()
export type AddFriendBody = z.input<typeof addFriendBody>
export const addFriendResponse = z.object({ friend: friendSchema, existing: z.boolean() })

/** DELETE /api/app/v1/friends/:id: for both people; 200 also when it was already gone. */
export const removeFriendParams = z.object({ id: z.uuid() }).strict()
export const removeFriendResponse = z.object({ ok: z.literal(true) })

/** POST /api/app/v1/friends/code: a new code; the old one stops working at once. An empty body. */
export const resetFriendCodeBody = z.object({}).strict()
export const resetFriendCodeResponse = z.object({ code: z.string() })
