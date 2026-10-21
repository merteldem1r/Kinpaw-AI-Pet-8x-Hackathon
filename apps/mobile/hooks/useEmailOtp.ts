import { useCallback, useEffect, useRef, useState } from 'react'
import type { TextInput } from 'react-native'
import { track } from '@/lib/analytics'
import { haptic } from '@/lib/haptics'
import {
	CODE_LENGTH,
	emailProblem,
	normalizeEmail,
	signInErrorLine,
	signInFailure,
	type SignInStep
} from '@/lib/signIn'
import { isSupabaseEnabled, supabase } from '@/lib/supabase'

// Signing in with an emailed code (docs/application/UI/kinpaw-screen-spec-v1.md, "Save Mochi
// and sign in"): the email step, the code step, the resend cooldown and the lockout after too
// many wrong codes. The lockout is a courtesy on this phone; Supabase's own limits are the guard.

/** Seconds before a code can be sent again. */
export const RESEND_COOLDOWN_S = 60
/** Wrong codes allowed before a lockout. */
export const MAX_ATTEMPTS = 5
export const LOCKOUT_MS = 15 * 60 * 1000
/** The code boxes take focus once the code step has slid in, ms. */
const FOCUS_AFTER_MS = 350

export const SIGN_IN_NOT_SET_UP = "Sign-in isn't set up in this version of the app yet."

/** `onSignedIn`: the code was right; the session is Supabase's from here. */
export function useEmailOtp(onSignedIn: () => void) {
	const [step, setStep] = useState<SignInStep>('email')
	const [email, setEmailValue] = useState('')
	const [code, setCode] = useState('')
	const [loading, setLoading] = useState<'email' | 'code' | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [codeError, setCodeError] = useState(false)
	const [cooldown, setCooldown] = useState(0)
	const [failedAttempts, setFailedAttempts] = useState(0)
	const [lockoutEnd, setLockoutEnd] = useState<number | null>(null)
	const [lockoutLeft, setLockoutLeft] = useState(0)
	const codeRef = useRef<TextInput>(null)

	// Resend cooldown countdown
	useEffect(() => {
		if (cooldown <= 0) return
		const t = setTimeout(() => setCooldown((left) => left - 1), 1000)
		return () => clearTimeout(t)
	}, [cooldown])

	// Lockout countdown
	useEffect(() => {
		if (!lockoutEnd) return
		const tick = () => {
			const rem = Math.max(0, Math.ceil((lockoutEnd - Date.now()) / 1000))
			setLockoutLeft(rem)
			if (rem === 0) setLockoutEnd(null)
		}
		tick()
		const t = setInterval(tick, 1000)
		return () => clearInterval(t)
	}, [lockoutEnd])

	function setEmail(value: string) {
		setEmailValue(value)
		if (error) setError(null)
	}

	async function sendCode() {
		const normalized = normalizeEmail(email)
		const problem = emailProblem(normalized)
		if (problem) {
			setError(problem)
			haptic.warning()
			return
		}
		track('login_started', { method: 'email' })
		if (!isSupabaseEnabled) {
			track('login_failed', { method: 'email', reason: 'provider' })
			setError(SIGN_IN_NOT_SET_UP)
			return
		}
		setLoading('email')
		setError(null)
		const { error: err } = await supabase.auth.signInWithOtp({ email: normalized })
		setLoading(null)
		if (err) {
			setError(signInErrorLine(err))
			return
		}
		track('otp_sent')
		setStep('otp')
		setCooldown(RESEND_COOLDOWN_S)
		setTimeout(() => codeRef.current?.focus(), FOCUS_AFTER_MS)
	}

	const verify = useCallback(
		async (value: string) => {
			if (value.length < CODE_LENGTH) return
			if (lockoutEnd && Date.now() < lockoutEnd) {
				setError('Too many attempts. Wait for the timer, then try again.')
				track('login_failed', { method: 'email', reason: 'locked' })
				return
			}
			setLoading('code')
			setError(null)
			const { error: err } = await supabase.auth.verifyOtp({
				email: normalizeEmail(email),
				token: value,
				type: 'email'
			})
			setLoading(null)
			if (err && signInFailure(err) !== 'wrong_code') {
				// Not a wrong code (offline, too many requests): it doesn't count toward the lockout.
				setCode('')
				setError(signInErrorLine(err))
				track('login_failed', { method: 'email', reason: 'provider' })
				return
			}
			if (err) {
				const next = failedAttempts + 1
				setFailedAttempts(next)
				setCodeError(true)
				setCode('')
				if (next >= MAX_ATTEMPTS) {
					setLockoutEnd(Date.now() + LOCKOUT_MS)
					setError('Too many wrong codes. Wait 15 minutes, then try again.')
					track('login_failed', { method: 'email', reason: 'locked' })
				} else {
					setError(signInErrorLine(err))
					track('login_failed', { method: 'email', reason: 'invalid_code' })
				}
				return
			}
			haptic.success()
			track('login_success', { method: 'email' })
			onSignedIn()
		},
		[email, lockoutEnd, failedAttempts, onSignedIn]
	)

	/** Typing in the code boxes: clears the last mistake, and checks the code once it is whole. */
	function changeCode(next: string) {
		setCode(next)
		if (codeError) setCodeError(false)
		if (error && !lockoutEnd) setError(null)
		if (next.length === CODE_LENGTH) void verify(next)
	}

	async function resend() {
		if (cooldown > 0) return
		setLoading('email')
		setError(null)
		const { error: err } = await supabase.auth.signInWithOtp({ email: normalizeEmail(email) })
		setLoading(null)
		if (err) {
			setError(signInErrorLine(err))
			return
		}
		haptic.success()
		setCooldown(RESEND_COOLDOWN_S)
		setCode('')
		codeRef.current?.focus()
	}

	/** Back to the email step; a new address starts its attempts over. */
	function changeEmail() {
		setStep('email')
		setCode('')
		setError(null)
		setCodeError(false)
		setFailedAttempts(0)
		setLockoutEnd(null)
	}

	return {
		step,
		email,
		setEmail,
		code,
		changeCode,
		codeRef,
		loading,
		error,
		codeError,
		cooldown,
		locked: lockoutEnd !== null,
		lockoutLeft,
		sendCode,
		verify,
		resend,
		changeEmail
	}
}
