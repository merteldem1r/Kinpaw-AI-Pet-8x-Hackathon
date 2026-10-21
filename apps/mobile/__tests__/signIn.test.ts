/**
 * Signing in with an emailed code: the address the code goes to is the one typed, refused
 * addresses are refused before anything is sent, and Supabase's errors become plain lines.
 */
import { emailProblem, normalizeEmail, petLine, signInErrorLine, signInFailure } from '@/lib/signIn'

describe('normalizeEmail', () => {
	it('trims and lower-cases, and changes nothing else', () => {
		expect(normalizeEmail('  Ann@Example.COM ')).toBe('ann@example.com')
	})

	it('keeps a +tag and dots, so the code reaches the inbox that was typed', () => {
		expect(normalizeEmail('ann+kinpaw@company.com')).toBe('ann+kinpaw@company.com')
		expect(normalizeEmail('first.last@gmail.com')).toBe('first.last@gmail.com')
	})
})

describe('emailProblem', () => {
	it('accepts an ordinary address', () => {
		expect(emailProblem('ann@example.com')).toBeNull()
	})

	it('refuses something that is not an address', () => {
		expect(emailProblem('ann')).toMatch(/valid email/)
		expect(emailProblem('ann@example')).toMatch(/valid email/)
		expect(emailProblem('')).toMatch(/valid email/)
	})

	it('refuses a throwaway inbox', () => {
		expect(emailProblem('ann@mailinator.com')).toMatch(/Temporary/)
	})
})

describe('signInFailure and signInErrorLine', () => {
	// The shapes supabase-js throws (AuthApiError, AuthRetryableFetchError): only lib/supabase.ts
	// may import it, so they are built here.
	const api = (code: string, status: number) =>
		Object.assign(new Error('raw supabase text'), { name: 'AuthApiError', code, status })
	const unreachable = () =>
		Object.assign(new Error('fetch failed'), { name: 'AuthRetryableFetchError', status: 0 })

	it('reads a wrong or expired code', () => {
		expect(signInFailure(api('otp_expired', 403))).toBe('wrong_code')
		expect(signInErrorLine(api('otp_expired', 403))).toMatch(/didn't match/)
	})

	it('reads too many requests, by code or by status', () => {
		expect(signInFailure(api('over_email_send_rate_limit', 429))).toBe('too_many')
		expect(signInFailure(api('unexpected_failure', 429))).toBe('too_many')
	})

	it('reads an unreachable server', () => {
		expect(signInFailure(unreachable())).toBe('unreachable')
	})

	it("never shows Supabase's own message", () => {
		for (const error of [
			api('otp_expired', 403),
			api('email_address_invalid', 400),
			unreachable(),
			new Error('raw supabase text'),
			undefined
		]) {
			expect(signInErrorLine(error)).not.toContain('raw supabase text')
		}
		expect(signInFailure(new Error('x'))).toBe('other')
	})
})

describe('petLine: what the pet on the sheet says', () => {
	it('asks to be saved on the email step, and waits on the code step', () => {
		expect(petLine('email', false, 'none', 0)).toEqual(['happy', "Don't lose me! Save me here."])
		expect(petLine('otp', false, 'none', 0)).toEqual(['content', "I'll wait by the door."])
	})

	it('is sad after a wrong code', () => {
		expect(petLine('otp', true, 'none', 0)[0]).toBe('sad')
	})

	it('is happy going home, through its lines in turn, over a code mark', () => {
		const lines = [0, 1, 2, 3].map((tick) => petLine('otp', true, 'saving', tick))
		expect(lines.every(([mood]) => mood === 'happy')).toBe(true)
		expect(new Set(lines.slice(0, 3).map(([, line]) => line)).size).toBe(3)
		expect(lines[3]).toEqual(lines[0])
		expect(petLine('otp', false, 'finding', 0)).toEqual(lines[0])
	})

	it('is sad when saving or finding failed', () => {
		for (const after of ['save_failed', 'find_failed'] as const) {
			expect(petLine('otp', false, after, 0)).toEqual(['sad', "Oops. Let's try that again."])
		}
	})
})
