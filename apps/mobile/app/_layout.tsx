import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Platform, StyleSheet } from 'react-native'
import { Stack, useNavigationContainerRef, usePathname } from 'expo-router'
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import { palette, type Palette } from '@app/brand'
import { queryClient } from '@/lib/queryClient'
import { presetFonts } from '@/lib/fonts'
import { loadThemePref } from '@/lib/themePref'
import { loadHapticsPref } from '@/lib/haptics'
import { loadPetDraft } from '@/lib/petDraft'
import { makeStyles } from '@/lib/themedStyles'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import * as Sentry from '@sentry/react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import {
	ThemeProvider as NavigationThemeProvider,
	DarkTheme,
	DefaultTheme,
	type Theme as NavigationTheme
} from '@react-navigation/native'
import { PostHogProvider } from 'posthog-react-native'
import { I18nextProvider } from 'react-i18next'

import { supabase, isSupabaseEnabled } from '@/lib/supabase'
import { posthog, isPostHogEnabled, identify, resetIdentity, track } from '@/lib/analytics'
import { configureRevenueCat, loginRevenueCat, logoutRevenueCat } from '@/lib/purchases'
import { announceSession } from '@/lib/lifecycle'
import { SubscriptionProvider } from '@/contexts/SubscriptionContext'
import { PetDraftProvider } from '@/contexts/PetDraftContext'
import { ToastProvider, useToast } from '@/contexts/ToastContext'
import { onSessionExpired } from '@/lib/api'
import { PET_QUERY_KEY, usePet } from '@/hooks/usePet'
import { useNudges } from '@/hooks/useNudges'
import { usePendingFriendCode } from '@/hooks/usePendingFriendCode'
import { configureNotifications, resetNotesForSignOut } from '@/lib/notifications'
import { clearPendingFriendCode } from '@/lib/pendingFriendCode'
import { IntroFlow } from '@/components/intro/IntroFlow'
import { endIntroAfterSave, useIntroAfterSave } from '@/lib/introOffer'
import { QueryErrorState } from '@/components/QueryError'
import { Button } from '@/components/ui/Button'
import i18n, { initI18n } from '@/lib/i18n'
import OfflineBanner from '@/components/OfflineBanner'
import OfflineOverlay from '@/components/OfflineOverlay'
import UpdateRequiredGate from '@/components/UpdateRequiredGate'
import { LaunchScene } from '@/components/LaunchScene'
import { Text } from '@/components/ui/Text'
import { env } from '@/lib/env'
import { log } from '@/lib/logger'

// Hold the native splash until fonts, the theme preference, i18n, the session
// and (signed in) whether there is a pet are known — the first frame the user
// sees is the finished one.
SplashScreen.preventAutoHideAsync().catch(() => {})

// ES modules evaluate every import before this line runs, wherever the imports
// are written, so listing them first changes nothing about when Sentry starts.
const routingInstrumentation = Sentry.reactNavigationIntegration()

Sentry.init({
	dsn: env.EXPO_PUBLIC_SENTRY_DSN ?? '',
	environment: __DEV__ ? 'development' : 'production',
	enabled: !__DEV__ && !!env.EXPO_PUBLIC_SENTRY_DSN,
	integrations: [routingInstrumentation],
	tracesSampleRate: 0
})

// The pet's notes never show over the open app (v2-notifications R8).
configureNotifications()

// ─── Error boundary ───────────────────────────────────────────────────────────
// React requires a class component to catch render errors — hooks cannot do this.

function ErrorFallback() {
	const eb = useErrorStyles()
	return (
		<View style={eb.container}>
			<Text style={eb.title}>Something went wrong</Text>
			<Text style={eb.subtitle}>Please close and reopen the app.</Text>
		</View>
	)
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
	state = { hasError: false }

	static getDerivedStateFromError() {
		return { hasError: true }
	}

	componentDidCatch(error: Error, info: React.ErrorInfo) {
		// The console in development; in a release build the logger captures the
		// exception in Sentry with the component stack, as this did directly before.
		log.error('Uncaught render error', { error, componentStack: info.componentStack })
	}

	render() {
		if (this.state.hasError) return <ErrorFallback />
		return this.props.children
	}
}

const useErrorStyles = makeStyles((c) => ({
	container: {
		flex: 1,
		backgroundColor: c.bg,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 32
	},
	title: {
		color: c.textPrimary,
		fontSize: 18,
		fontWeight: '700',
		marginBottom: 10,
		textAlign: 'center'
	},
	subtitle: { color: c.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 22 }
}))

// ─── Theme ────────────────────────────────────────────────────────────────────
// React Navigation draws some chrome itself (card backgrounds during
// transitions, default headers); give it the palette so nothing flashes a
// stock white or black between screens.

const navigationThemes = new Map<Palette, NavigationTheme>()

function navigationTheme(c: Palette): NavigationTheme {
	let t = navigationThemes.get(c)
	if (!t) {
		const base = c.scheme === 'dark' ? DarkTheme : DefaultTheme
		t = {
			...base,
			dark: c.scheme === 'dark',
			colors: {
				...base.colors,
				primary: c.brandInk,
				background: c.bg,
				card: c.surface,
				text: c.textPrimary,
				border: c.borderSoft,
				notification: c.error
			}
		}
		navigationThemes.set(c, t)
	}
	return t
}

// ─── Transitions ──────────────────────────────────────────────────────────────
// A pushed screen slides in from the side (the system's own gesture-driven
// transition, so the back swipe tracks the finger); the paywall rises from the
// bottom as a modal.

const PUSH = { animation: 'slide_from_right' } as const
const MODAL = { animation: 'slide_from_bottom', gestureEnabled: true } as const
/** "Tell me about you": over the tabs, no swipe away; Skip and Go home are the ways out. */
const INTRO = { presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false } as const

// ─── Conditional PostHog provider ─────────────────────────────────────────────
// PostHogProvider requires a valid client instance. When the API key is missing
// we skip the provider entirely so no errors are thrown.

function MaybePostHogProvider({ children }: { children: React.ReactNode }) {
	if (isPostHogEnabled && posthog) {
		return <PostHogProvider client={posthog}>{children}</PostHogProvider>
	}
	return <>{children}</>
}

// ─── Session expiry ──────────────────────────────────────────────────────────
// When the server refuses a session for good, lib/api.ts signs this device out
// (the auth listener below routes to the signed-out screens). This says why,
// once, instead of the app simply dropping the person at the welcome screen.

function SessionExpiredNotice() {
	const { showToast } = useToast()
	useEffect(
		() => onSessionExpired(() => showToast('Your session has expired. Sign in again.', 'info')),
		[showToast]
	)
	return null
}

// ─── Screen tracking ─────────────────────────────────────────────────────────
// Rendered inside the navigator so usePathname has routing context.

function ScreenTracker() {
	const pathname = usePathname()
	useEffect(() => {
		track('screen_viewed', { screen: pathname })
	}, [pathname])
	return null
}

// A friend link that came before the pet: opened once Home has shown (v2-friends R10). Rendered
// inside the navigator, like ScreenTracker, for usePathname and router.
function PendingFriendCode({ ready }: { ready: boolean }) {
	usePendingFriendCode(ready)
	return null
}

// ─── Root layout ──────────────────────────────────────────────────────────────

function RootLayout() {
	const navigationRef = useNavigationContainerRef()
	// Only the active preset's faces (lib/fonts.ts). A font that fails to load
	// must not strand the user on the splash: fall through to system type.
	const [fontsLoaded, fontError] = useFonts(presetFonts)
	const [themeReady, setThemeReady] = useState(false)

	// null = still checking; true/false = auth state known
	const [isAuthed, setIsAuthed] = useState<boolean | null>(null)
	const [i18nReady, setI18nReady] = useState(false)

	useEffect(() => {
		initI18n().then(() => setI18nReady(true))
	}, [])

	// Read the stored light/dark choice (and the haptics switch) before first
	// paint, so the first frame is already in the right scheme; and the pet
	// draft, so a signed-out person resumes Create without a flash of Welcome.
	useEffect(() => {
		Promise.all([loadThemePref(), loadHapticsPref(), loadPetDraft()]).finally(() =>
			setThemeReady(true)
		)
	}, [])

	useEffect(() => {
		if (navigationRef.current) {
			routingInstrumentation.registerNavigationContainer(navigationRef)
		}
	}, [navigationRef])

	useEffect(() => {
		// Configure RevenueCat once at startup, before any user is known
		configureRevenueCat()

		if (!isSupabaseEnabled) {
			// No credentials — stay on landing page, no errors thrown
			setIsAuthed(false)
			return
		}

		supabase.auth
			.getSession()
			.then(({ data: { session } }) => {
				setIsAuthed(!!session)
				if (session?.user) {
					loginRevenueCat(session.user.id)
					identify(session.user.id, session.user.email ? { email: session.user.email } : undefined)
					// Emits user_signed_up and stamps last_seen_at / region server-side.
					// Idempotent, so calling it on every cold start is correct.
					void announceSession()
				}
			})
			.catch((error: unknown) => {
				log.warn('Could not reach Supabase; defaulting to signed-out', { error })
				setIsAuthed(false)
			})

		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((event, session) => {
			if (event === 'SIGNED_IN' && session?.user) {
				setIsAuthed(true)
				loginRevenueCat(session.user.id)
				identify(session.user.id, session.user.email ? { email: session.user.email } : undefined)
				void announceSession()
			}
			if (event === 'SIGNED_OUT') {
				setIsAuthed(false)
				logoutRevenueCat()
				resetIdentity()
				// Nothing one person loaded may show to the next one who signs in.
				queryClient.clear()
				// Nor any of their pet's notes (v2-notifications R19).
				void resetNotesForSignOut()
				// Nor a friend link that was waiting for their pet (v2-friends R10).
				void clearPendingFriendCode()
			}
		})

		return () => subscription.unsubscribe()
	}, [])

	const ready = (fontsLoaded || !!fontError) && themeReady && isAuthed !== null && i18nReady

	// The splash covers this; the ground colour is a fallback if it could not be held.
	// It prevents a flash of wrong content on launch. AppTree hides the splash once it
	// knows where a signed-in person belongs.
	if (!ready) return <SplashGround />

	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>
				<AppTree navigationRef={navigationRef} isAuthed={!!isAuthed} />
			</ThemeProvider>
		</QueryClientProvider>
	)
}

function SplashGround() {
	return <View style={{ flex: 1, backgroundColor: palette().bg }} />
}

// ─── Pet load error ───────────────────────────────────────────────────────────
// Signed in at launch, and the server can't say whether there is a pet: never guess (a
// person with a pet would land in Create). Say so, and offer a retry or a way out.

function PetLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
	const { colors } = useTheme()
	return (
		<View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 }}>
			<QueryErrorState error={error} title="Couldn't reach your pet" onRetry={onRetry} />
			<Button label="Sign out" variant="ghost" fullWidth onPress={() => supabase.auth.signOut()} />
		</View>
	)
}

// ─── App tree ─────────────────────────────────────────────────────────────────
// Inside the ThemeProvider, so every colour here follows the active scheme.

function AppTree({
	navigationRef,
	isAuthed
}: {
	navigationRef: ReturnType<typeof useNavigationContainerRef>
	isAuthed: boolean
}) {
	const { colors } = useTheme()
	const navTheme = useMemo(() => navigationTheme(colors), [colors])

	// Where a signed-in person belongs: a pet on the server → the tabs; none (or not known
	// yet, mid sign-in) → sign-in and Create stay reachable, so the sign-in screen can save the
	// draft. Saving puts the pet in the cache, which flips this and drops Create and sign-in
	// from the stack (docs/application/features/m4-save-your-pet-requirements.md, R5).
	const pet = usePet(isAuthed)
	const introAfterSave = useIntroAfterSave()
	// Signed out mid-intro: it never comes back for another account's pet.
	useEffect(() => {
		if (!isAuthed) endIntroAfterSave()
	}, [isAuthed])
	const queryClient = useQueryClient()
	// Once the stack has shown, a later failure (mid sign-in) is the screen's to handle.
	const routedOnce = useRef(false)
	const hasPet = isAuthed && pet.data !== undefined ? pet.data !== null : null
	// The pet's daily notes: scheduled on leaving, cancelled on return (v2-notifications R8).
	useNudges(isAuthed && hasPet === true)
	const known = !isAuthed || pet.isSuccess || pet.isError
	const [shown, setShown] = useState(false)
	// The animated launch scene takes over from the native splash and hides it once drawn.
	const [launching, setLaunching] = useState(true)
	useEffect(() => {
		if (!known || shown) return
		setShown(true)
	}, [known, shown])

	if (!shown) return <SplashGround />
	// Shown only at launch (a pet is known by then unless the load failed), and kept up
	// through a retry, so a person with a pet never lands in Create while it reloads.
	const loadFailedAtLaunch = isAuthed && hasPet === null && !routedOnce.current
	if (!loadFailedAtLaunch) routedOnce.current = true

	return (
		<SafeAreaProvider>
			<ErrorBoundary>
				<I18nextProvider i18n={i18n}>
					<MaybePostHogProvider>
						<SubscriptionProvider>
							<PetDraftProvider>
								<GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
									<ToastProvider>
										<StatusBar
											style={colors.statusBarStyle}
											translucent={Platform.OS === 'android'}
											backgroundColor={Platform.OS === 'android' ? colors.bg : undefined}
										/>
										<NavigationThemeProvider value={navTheme}>
											<View style={{ flex: 1, backgroundColor: colors.bg }}>
												{loadFailedAtLaunch ? (
													<PetLoadError error={pet.error} onRetry={() => pet.refetch()} />
												) : (
													<Stack
														ref={navigationRef}
														screenOptions={{
															headerShown: false,
															// Switching between the signed-out, onboarding and signed-in
															// worlds cross-fades; pushed screens slide (below).
															animation: 'fade',
															contentStyle: { backgroundColor: colors.bg }
														}}
													>
														{/* No pet yet: Welcome, Create and sign-in. Signed out, or signed in without a pet
														    (or before the server has said). Welcome comes first, so it is where everyone
														    without a pet starts, on every launch. */}
														<Stack.Protected guard={!isAuthed || hasPet !== true}>
															<Stack.Screen name="index" />
															<Stack.Screen name="(create)" />
															<Stack.Screen name="(auth)" options={PUSH} />
														</Stack.Protected>

														{/* With a pet: the tabs. When the pet arrives the screens above leave the stack,
														    so Back can't return to Create or sign-in. */}
														<Stack.Protected guard={isAuthed && hasPet === true}>
															<Stack.Screen name="(tabs)" />
															<Stack.Screen name="support" options={PUSH} />
															<Stack.Screen name="pet/[id]" options={PUSH} />
															<Stack.Screen name="memories" options={PUSH} />
															<Stack.Screen name="change-look" options={PUSH} />
															<Stack.Screen name="profile-edit" options={PUSH} />
															<Stack.Screen name="intro" options={INTRO} />
															<Stack.Screen name="friends/[id]" options={PUSH} />
															<Stack.Screen name="friends/add" options={PUSH} />
														</Stack.Protected>

														{/* ── Always-public screens — declared LAST so they don't become
                        the default redirect target when a protected group flips. ── */}
														<Stack.Screen name="upgrade" options={MODAL} />
														<Stack.Screen name="privacy" options={PUSH} />
														<Stack.Screen name="terms" options={PUSH} />
													</Stack>
												)}
												{/* "Tell me about you" right after a new pet is saved, before Home: over
												    everything, and simply gone when it ends (lib/introOffer.ts). */}
												{isAuthed && introAfterSave ? (
													<View style={StyleSheet.absoluteFill}>
														<IntroFlow
															entry="after_signup"
															pet={introAfterSave}
															onClose={() => {
																// The pet into the cache: this is what opens Home.
																const saved = endIntroAfterSave()
																if (saved) queryClient.setQueryData(PET_QUERY_KEY, saved)
															}}
														/>
													</View>
												) : null}
												<ScreenTracker />
												<PendingFriendCode ready={isAuthed && hasPet === true && !introAfterSave} />
												<SessionExpiredNotice />
												<OfflineBanner />
												<OfflineOverlay />
												<UpdateRequiredGate />
												{launching ? <LaunchScene onDone={() => setLaunching(false)} /> : null}
											</View>
										</NavigationThemeProvider>
									</ToastProvider>
								</GestureHandlerRootView>
							</PetDraftProvider>
						</SubscriptionProvider>
					</MaybePostHogProvider>
				</I18nextProvider>
			</ErrorBoundary>
		</SafeAreaProvider>
	)
}

export default Sentry.wrap(RootLayout)
