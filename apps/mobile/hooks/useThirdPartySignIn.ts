import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as WebBrowser from 'expo-web-browser'
import { SIGN_IN_NOT_SET_UP } from '@/hooks/useEmailOtp'
import { track } from '@/lib/analytics'
import { APP_SCHEME } from '@/lib/constants'
import { haptic } from '@/lib/haptics'
import { log } from '@/lib/logger'
import { isSupabaseEnabled, supabase } from '@/lib/supabase'

// Apple and Google sign-in (docs/application/product.md, "Sign-in"). Their buttons are hidden
// until the providers are configured (THIRD_PARTY_SIGN_IN in app/(auth)/login.tsx); the code is
// kept so that turning them on is configuration, not a rebuild of this flow. Apple stays while
// any other third-party login does (Apple 4.8).

// Required for OAuth session handling on Android
WebBrowser.maybeCompleteAuthSession()

export type Provider = 'google' | 'apple'

/** True on iOS 13+ where Apple's native sign-in sheet exists; false elsewhere. */
function useNativeAppleSignIn(): boolean {
	const [available, setAvailable] = useState(false)
	useEffect(() => {
		if (Platform.OS !== 'ios') return
		AppleAuthentication.isAvailableAsync()
			.then(setAvailable)
			.catch(() => setAvailable(false))
	}, [])
	return available
}

/** `onSignedIn`: a provider gave Supabase a session. */
export function useThirdPartySignIn(onSignedIn: () => void) {
	const nativeApple = useNativeAppleSignIn()
	const [loading, setLoading] = useState<Provider | null>(null)
	const [error, setError] = useState<string | null>(null)

	// Apple's native sheet (iOS). Its identity token is exchanged for a Supabase
	// session; no browser, no redirect.
	async function signInWithApple() {
		track('login_started', { method: 'apple' })
		if (!isSupabaseEnabled) {
			track('login_failed', { method: 'apple', reason: 'provider' })
			setError(SIGN_IN_NOT_SET_UP)
			return
		}
		setLoading('apple')
		setError(null)
		try {
			const credential = await AppleAuthentication.signInAsync({
				requestedScopes: [
					AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
					AppleAuthentication.AppleAuthenticationScope.EMAIL
				]
			})
			if (!credential.identityToken) throw new Error("Apple didn't return a sign-in token.")
			const { error: err } = await supabase.auth.signInWithIdToken({
				provider: 'apple',
				token: credential.identityToken
			})
			if (err) throw err
			// Apple shares the name on the first sign-in only, and never in the
			// token, so keep it now or lose it.
			const fullName = credential.fullName
				? AppleAuthentication.formatFullName(credential.fullName).trim()
				: ''
			if (fullName) await supabase.auth.updateUser({ data: { full_name: fullName } })
			haptic.success()
			track('login_success', { method: 'apple' })
			onSignedIn()
		} catch (e) {
			if ((e as { code?: string } | undefined)?.code === 'ERR_REQUEST_CANCELED') {
				track('login_failed', { method: 'apple', reason: 'cancelled' })
				return
			}
			log.error('apple sign-in failed', { error: e })
			track('login_failed', { method: 'apple', reason: 'provider' })
			setError("Apple sign-in didn't work. Try again.")
		} finally {
			setLoading(null)
		}
	}

	// Google, and Apple where the native sheet isn't available: the provider's page in a browser.
	async function signInWithProvider(provider: Provider) {
		const label = provider === 'google' ? 'Google' : 'Apple'
		track('login_started', { method: provider })
		if (!isSupabaseEnabled) {
			track('login_failed', { method: provider, reason: 'provider' })
			setError(SIGN_IN_NOT_SET_UP)
			return
		}
		setLoading(provider)
		setError(null)
		try {
			const redirectTo = `${APP_SCHEME}://auth/callback`
			const { data, error: err } = await supabase.auth.signInWithOAuth({
				provider,
				options: { redirectTo, skipBrowserRedirect: true }
			})
			if (err) throw err
			if (!data.url) throw new Error(`${label} sign-in isn't set up yet.`)

			const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
			if (result.type !== 'success') {
				track('login_failed', { method: provider, reason: 'cancelled' })
				return
			}
			const { error: sessionErr } = await supabase.auth.exchangeCodeForSession(result.url)
			if (sessionErr) throw sessionErr
			track('login_success', { method: provider })
			onSignedIn()
		} catch (e) {
			log.error('provider sign-in failed', { provider, error: e })
			track('login_failed', { method: provider, reason: 'provider' })
			setError(`${label} sign-in didn't work. Try again.`)
		} finally {
			setLoading(null)
		}
	}

	return {
		nativeApple,
		loading,
		error,
		clearError: () => setError(null),
		signInWithApple,
		signInWithProvider
	}
}
