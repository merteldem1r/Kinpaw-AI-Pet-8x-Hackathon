/**
 * Signing in with an emailed code (kinpaw-screen-spec-v1.md, "Save Mochi and sign in"): the
 * address checks before anything is sent, the resend cooldown, wrong codes and the lockout, a
 * failure that isn't a wrong code, and changing the address.
 */
import { act, renderHook } from '@testing-library/react-native'
import {
	LOCKOUT_MS,
	MAX_ATTEMPTS,
	RESEND_COOLDOWN_S,
	SIGN_IN_NOT_SET_UP,
	useEmailOtp
} from '@/hooks/useEmailOtp'
import { track } from '@/lib/analytics'

jest.mock('@/lib/supabase', () => ({
	isSupabaseEnabled: true,
	supabase: { auth: { signInWithOtp: jest.fn(), verifyOtp: jest.fn() } }
}))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/lib/haptics', () => ({ haptic: { success: jest.fn(), warning: jest.fn() } }))

const mockSupabase = jest.requireMock('@/lib/supabase') as {
	isSupabaseEnabled: boolean
	supabase: { auth: { signInWithOtp: jest.Mock; verifyOtp: jest.Mock } }
}
const { signInWithOtp, verifyOtp } = mockSupabase.supabase.auth
const mockTrack = jest.mocked(track)

/** Supabase's answer to a wrong or expired code, and to an unreachable server. */
const wrongCode = Object.assign(new Error('Token has expired or is invalid'), {
	name: 'AuthApiError',
	code: 'otp_expired',
	status: 403
})
const unreachable = Object.assign(new Error('fetch failed'), {
	name: 'AuthRetryableFetchError',
	status: 0
})

beforeEach(() => {
	jest.useFakeTimers()
	jest.clearAllMocks()
	mockSupabase.isSupabaseEnabled = true
	signInWithOtp.mockResolvedValue({ error: null })
	verifyOtp.mockResolvedValue({ error: null })
})
afterEach(() => jest.useRealTimers())

/** On the code step, for ann@example.com. */
async function atCodeStep(onSignedIn = jest.fn()) {
	const hook = renderHook(() => useEmailOtp(onSignedIn))
	act(() => hook.result.current.setEmail('  Ann@Example.com '))
	await act(() => hook.result.current.sendCode())
	return { ...hook, onSignedIn }
}

describe('the email step', () => {
	it('sends the code to the address as typed, trimmed and lower-cased', async () => {
		const { result } = await atCodeStep()
		expect(signInWithOtp).toHaveBeenCalledWith({ email: 'ann@example.com' })
		expect(result.current.step).toBe('otp')
		expect(result.current.cooldown).toBe(RESEND_COOLDOWN_S)
		expect(mockTrack).toHaveBeenCalledWith('otp_sent')
	})

	it('refuses a bad or throwaway address without sending anything', async () => {
		const { result } = renderHook(() => useEmailOtp(jest.fn()))
		act(() => result.current.setEmail('ann@'))
		await act(() => result.current.sendCode())
		expect(result.current.error).toMatch(/valid email/)
		act(() => result.current.setEmail('ann@mailinator.com'))
		expect(result.current.error).toBeNull()
		await act(() => result.current.sendCode())
		expect(result.current.error).toMatch(/Temporary/)
		expect(signInWithOtp).not.toHaveBeenCalled()
		expect(result.current.step).toBe('email')
	})

	it('says so when sign-in is not set up in this build', async () => {
		mockSupabase.isSupabaseEnabled = false
		const { result } = renderHook(() => useEmailOtp(jest.fn()))
		act(() => result.current.setEmail('ann@example.com'))
		await act(() => result.current.sendCode())
		expect(result.current.error).toBe(SIGN_IN_NOT_SET_UP)
		expect(signInWithOtp).not.toHaveBeenCalled()
	})

	it('stays on the email step with a plain line when the code cannot be sent', async () => {
		signInWithOtp.mockResolvedValueOnce({ error: unreachable })
		const { result } = renderHook(() => useEmailOtp(jest.fn()))
		act(() => result.current.setEmail('ann@example.com'))
		await act(() => result.current.sendCode())
		expect(result.current.step).toBe('email')
		expect(result.current.error).toMatch(/couldn't reach/)
		expect(result.current.error).not.toContain('fetch failed')
	})
})

describe('the code step', () => {
	it('checks the code once all six digits are in, and signs in', async () => {
		const { result, onSignedIn } = await atCodeStep()
		act(() => result.current.changeCode('12345'))
		expect(verifyOtp).not.toHaveBeenCalled()
		await act(async () => result.current.changeCode('123456'))
		expect(verifyOtp).toHaveBeenCalledWith({
			email: 'ann@example.com',
			token: '123456',
			type: 'email'
		})
		expect(onSignedIn).toHaveBeenCalledTimes(1)
	})

	it('marks a wrong code, clears the boxes, and clears the mark on the next digit', async () => {
		verifyOtp.mockResolvedValueOnce({ error: wrongCode })
		const { result, onSignedIn } = await atCodeStep()
		await act(() => result.current.verify('111111'))
		expect(result.current.codeError).toBe(true)
		expect(result.current.code).toBe('')
		expect(result.current.error).toMatch(/didn't match/)
		expect(onSignedIn).not.toHaveBeenCalled()
		act(() => result.current.changeCode('2'))
		expect(result.current.codeError).toBe(false)
		expect(result.current.error).toBeNull()
	})

	it('locks for 15 minutes after five wrong codes, then lets you try again', async () => {
		verifyOtp.mockResolvedValue({ error: wrongCode })
		const { result } = await atCodeStep()
		for (let i = 0; i < MAX_ATTEMPTS; i++) await act(() => result.current.verify('111111'))
		expect(result.current.locked).toBe(true)
		expect(result.current.lockoutLeft).toBe(LOCKOUT_MS / 1000)
		expect(mockTrack).toHaveBeenLastCalledWith('login_failed', {
			method: 'email',
			reason: 'locked'
		})

		verifyOtp.mockClear()
		await act(() => result.current.verify('222222'))
		expect(verifyOtp).not.toHaveBeenCalled()

		act(() => jest.advanceTimersByTime(LOCKOUT_MS))
		expect(result.current.locked).toBe(false)
	})

	it("doesn't count a failure that isn't a wrong code toward the lockout", async () => {
		verifyOtp.mockResolvedValue({ error: unreachable })
		const { result } = await atCodeStep()
		for (let i = 0; i < MAX_ATTEMPTS + 1; i++) await act(() => result.current.verify('111111'))
		expect(result.current.locked).toBe(false)
		expect(result.current.codeError).toBe(false)
		expect(result.current.error).toMatch(/couldn't reach/)
	})

	it('waits out the cooldown before a resend, then sends again', async () => {
		const { result } = await atCodeStep()
		await act(() => result.current.resend())
		expect(signInWithOtp).toHaveBeenCalledTimes(1)
		for (let i = 0; i < RESEND_COOLDOWN_S; i++) act(() => jest.advanceTimersByTime(1000))
		expect(result.current.cooldown).toBe(0)
		await act(() => result.current.resend())
		expect(signInWithOtp).toHaveBeenCalledTimes(2)
		expect(result.current.cooldown).toBe(RESEND_COOLDOWN_S)
	})

	it('starts over on a new address: back to the email step, attempts and lockout cleared', async () => {
		verifyOtp.mockResolvedValue({ error: wrongCode })
		const { result } = await atCodeStep()
		for (let i = 0; i < MAX_ATTEMPTS; i++) await act(() => result.current.verify('111111'))
		act(() => result.current.changeEmail())
		expect(result.current.step).toBe('email')
		expect(result.current.locked).toBe(false)
		expect(result.current.codeError).toBe(false)
		expect(result.current.error).toBeNull()
	})
})
