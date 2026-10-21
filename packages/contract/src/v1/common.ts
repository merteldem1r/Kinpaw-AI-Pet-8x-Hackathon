import { z } from 'zod'

// Shared pieces of every /api/app/v1 schema.
//
// `v1` IS A PROMISE (docs/rules/mobile-data.md). Once a store build calls a
// route, its response never loses, renames or retypes a field, and never gains
// an enum value: every installed build parses responses with these schemas, and
// a value it doesn't know fails the parse. Response objects strip unknown keys,
// so a response may GAIN a field. Inputs never get stricter: no new required
// field, no narrower type. Anything else is v2.

export const uuid = z.uuid()

/** An instant, ISO 8601 in UTC: `2026-09-24T09:14:11.831Z`. */
export const isoDateTime = z.iso.datetime()

/** A calendar date with no time zone: `2026-09-24`. */
export const isoDate = z.iso.date()

/**
 * Whether `value` looks like an email address: something, an @, a domain with a dot, no spaces.
 * Deliberately loose: the mail server is the real check. One rule for the app's sign-in and the
 * website's forms.
 */
export function looksLikeEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** An email address as a form sends it: trimmed and lower-cased, then `looksLikeEmail`. */
export const emailAddress = z.string().trim().toLowerCase().refine(looksLikeEmail)

// ── Errors ────────────────────────────────────────────────────────────────────

/**
 * Every code a v1 route answers with. The status carries the meaning; the code
 * lets the app tell two failures with one status apart. `message` is always
 * safe to show to the person, and never carries internals.
 */
export const ERROR_CODES = {
	invalid_request: 400,
	unauthorized: 401,
	not_found: 404,
	conflict: 409,
	internal: 500,
	unavailable: 503,
	not_configured: 503,
	/** The pet's voice (the AI model) can't be reached right now: the pet is "not connected". */
	talk_unavailable: 503,
	/** A body larger than its route takes (a photo over 8 MB), refused before it is read. */
	payload_too_large: 413,
	/** The photo reader (the AI model) couldn't look at the photo; no try was used. */
	photo_unavailable: 503,
	/** "Tell me about you" is over for this pet: skipped, kept a fact, or used both attempts. */
	intro_closed: 409,
	/** The pet's spoken voice (the speech model) couldn't be made; the reply's text stands. */
	voice_unavailable: 503,
	/** A friend code that is the caller's own (v2-friends-requirements.md, R9). */
	friend_own_code: 400,
	/** A friend code no one has: never made, or replaced by a new one (R9). */
	friend_code_unknown: 404,
	/** The caller already has the most friends there can be (R5). */
	friends_full: 409,
	/** The code's owner already has the most friends there can be (R5). */
	friend_friends_full: 409
} as const

export type ErrorCode = keyof typeof ERROR_CODES

/** The body of every non-2xx response from a v1 route. */
export const errorBodySchema = z.object({
	error: z.object({
		// A string, not the enum: an app must survive a code it doesn't know yet,
		// and act on the status instead.
		code: z.string(),
		message: z.string(),
		/** On a 400 only: which input failed, and why. */
		issues: z.array(z.object({ path: z.string(), message: z.string() })).optional()
	})
})

export type ErrorBody = z.infer<typeof errorBodySchema>

// ── Pagination ────────────────────────────────────────────────────────────────

export const MAX_PAGE_SIZE = 100

/**
 * `?limit=&cursor=` on every list route. `cursor` is opaque: pass a response's
 * `next_cursor` back verbatim. Query values arrive as strings, so `limit` is
 * coerced. Unknown query parameters are ignored, not rejected.
 */
export const pageQuery = z.object({
	limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
	cursor: z.string().min(1).max(512).optional()
})

/** The next page's cursor, or null on the last page. */
export const nextCursor = z.string().nullable()
