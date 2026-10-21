import { looksLikeEmail, type Mood } from '@app/contract'

// Signing in with an emailed code (app/(auth)/login.tsx): which address the code goes to, which
// addresses are refused before anything is sent, and the words for what Supabase answers. The
// person never sees Supabase's own error text (docs/rules/error-handling.md).

// ─── The address ──────────────────────────────────────────────────────────────

/**
 * The address the code is sent to: what was typed, trimmed and lower-cased, nothing more. A
 * `+tag` or a dot is part of the address on most mail servers, so removing one could send the
 * code to someone else's inbox.
 */
export function normalizeEmail(raw: string): string {
	return raw.trim().toLowerCase()
}

/** Digits in the emailed sign-in code (Supabase's OTP length in supabase/config.toml). */
export const CODE_LENGTH = 6

/** Throwaway inboxes: an account on one can't be got back into. */
const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
	'mailinator.com',
	'guerrillamail.com',
	'10minutemail.com',
	'tempmail.com',
	'temp-mail.org',
	'yopmail.com',
	'trashmail.com',
	'trashmail.me',
	'maildrop.cc',
	'mailnesia.com',
	'discard.email',
	'throwaway.email',
	'getnada.com',
	'fakeinbox.com',
	'getairmail.com',
	'spam4.me',
	'spamgourmet.com',
	'dispostable.com',
	'filzmail.com'
])

/** Why an address is refused before a code is sent, as the line to show; null when it is fine. */
export function emailProblem(email: string): string | null {
	if (!looksLikeEmail(email)) return 'Enter a valid email address.'
	const domain = email.slice(email.lastIndexOf('@') + 1)
	if (DISPOSABLE_DOMAINS.has(domain)) {
		return 'Temporary email addresses are not allowed. Use one you keep.'
	}
	return null
}

// ─── What Supabase answers ────────────────────────────────────────────────────

export type SignInFailure =
	/** The code was wrong, or expired: Supabase answers both the same way. */
	| 'wrong_code'
	/** Too many codes or attempts in a short time. */
	| 'too_many'
	/** Supabase couldn't be reached. */
	| 'unreachable'
	/** Anything else: a provider not set up, an address Supabase refuses, its own fault. */
	| 'other'

/** Supabase's error codes for a code that didn't match or ran out (auth-js ErrorCode). */
const WRONG_CODE = new Set(['otp_expired', 'invalid_credentials'])
const TOO_MANY = new Set([
	'over_email_send_rate_limit',
	'over_request_rate_limit',
	'over_sms_send_rate_limit'
])

/** What kind of failure a Supabase auth error is. */
export function signInFailure(error: unknown): SignInFailure {
	const { name, code, status } = (error ?? {}) as {
		name?: unknown
		code?: unknown
		status?: unknown
	}
	// Supabase's own isAuthRetryableFetchError checks this name; only lib/supabase.ts may import it.
	if (name === 'AuthRetryableFetchError') return 'unreachable'
	if (typeof code === 'string' && WRONG_CODE.has(code)) return 'wrong_code'
	if ((typeof code === 'string' && TOO_MANY.has(code)) || status === 429) return 'too_many'
	return 'other'
}

const LINES: Record<SignInFailure, string> = {
	wrong_code: "That code didn't match. Try again or send a new one.",
	too_many: 'Too many tries for now. Wait a minute, then try again.',
	unreachable: "We couldn't reach the sign-in server. Check your connection, then try again.",
	other: "Signing in didn't work. Try again in a moment."
}

/** The line to show for a failed sign-in step. Never Supabase's own message. */
export function signInErrorLine(error: unknown): string {
	return LINES[signInFailure(error)]
}

// ─── What the pet says ────────────────────────────────────────────────────────

/** Which step the sheet is on. */
export type SignInStep = 'email' | 'otp'

/** After the code: signed in, then saving the pet or finding it, or that failed. */
export type AfterSignIn = 'none' | 'saving' | 'finding' | 'save_failed' | 'find_failed'

/** While going home, the pet's line changes every this many ms, through these. */
export const GOING_HOME_LINE_MS = 1100
const GOING_HOME_LINES = [
	"Yay! Let's go home.",
	'Packing my favourite toy…',
	"Is it far? I'm ready!"
] as const

/** What the pet on the sheet says, and how it looks, at each moment (the spec's states table). */
export function petLine(
	step: SignInStep,
	codeError: boolean,
	after: AfterSignIn,
	tick: number
): [Mood, string] {
	if (after === 'save_failed' || after === 'find_failed')
		return ['sad', "Oops. Let's try that again."]
	if (after !== 'none') return ['happy', GOING_HOME_LINES[tick % GOING_HOME_LINES.length]!]
	if (codeError) return ['sad', "Hmm, that's not the one."]
	if (step === 'otp') return ['content', "I'll wait by the door."]
	return ['happy', "Don't lose me! Save me here."]
}
