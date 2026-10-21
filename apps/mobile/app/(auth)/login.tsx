/**
 * Save {name} / Welcome back — signing in with a one-time code by email
 * (docs/application/UI/kinpaw-screen-spec-v1.md, "Save Mochi and sign in"; the canvas's
 * "Save Mochi · Email", "· Code", "· Wrong code" and "Sign in · Welcome back").
 *
 * The sky at the top, the pet sitting on the sheet's edge, the form in the sheet. Two modes:
 * - save: from Meet, with the pet that is being saved and its line;
 * - welcome_back: "I already have an account", with the Welcome trio and no bubble.
 *
 * The sign-in flow is the template's (email code, resend cooldown, lockout, its events:
 * hooks/useEmailOtp.ts). What happens after it is Kinpaw's (hooks/useAfterSignIn.ts): save the
 * draft (the root layout then moves to My pet and drops this screen), or for Welcome back find
 * the pet, or start one.
 *
 * Apple and Google: their code is kept (hooks/useThirdPartySignIn.ts), their buttons hidden while
 * they aren't configured (docs/application/product.md, "Sign-in"). Turning them on is
 * THIRD_PARTY_SIGN_IN below plus the provider setup:
 *   1. Supabase → Auth → Providers: enable Apple and Google. For Apple, add the app's bundle
 *      identifier (app.json → ios.bundleIdentifier) to the provider's Client IDs, and the
 *      Services ID, key and team for the web flow.
 *   2. Apple Developer: the App ID gets the Sign in with Apple capability.
 *   3. Add the redirect URL `${APP_SCHEME}://auth/callback` in Supabase for the browser flows.
 *   Keep Apple while any other third-party login remains (Apple 4.8).
 */
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import Animated, { FadeInRight, FadeOut, ReduceMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { AfterMessage } from '@/components/auth/AfterMessage'
import { CodeStep } from '@/components/auth/CodeStep'
import { EmailStep } from '@/components/auth/EmailStep'
import { ProviderButtons } from '@/components/auth/ProviderButtons'
import { SHEET_EDGE, SheetPets } from '@/components/auth/SheetPets'
import { SkyBand } from '@/components/pet/SkyBand'
import { IconButton } from '@/components/ui/IconButton'
import { LogoMark } from '@/components/ui/Marks'
import { Text } from '@/components/ui/Text'
import { TextLink } from '@/components/ui/TextLink'
import { usePetDraft } from '@/contexts/PetDraftContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useAfterSignIn } from '@/hooks/useAfterSignIn'
import { useEmailOtp } from '@/hooks/useEmailOtp'
import { useThirdPartySignIn } from '@/hooks/useThirdPartySignIn'
import { track } from '@/lib/analytics'
import { APP_NAME } from '@/lib/constants'
import { Durations, Easings } from '@/lib/motion'
import type { PetDraft } from '@/lib/petDraft'
import { normalizeEmail, petLine } from '@/lib/signIn'
import { useSkyPhase } from '@/lib/sky'
import { makeStyles } from '@/lib/themedStyles'

/** Apple and Google sign-in: hidden until they are configured (see the header). */
const THIRD_PARTY_SIGN_IN = false

const stepIn = FadeInRight.duration(Durations.enter)
	.easing(Easings.out)
	.reduceMotion(ReduceMotion.System)
const stepOut = FadeOut.duration(Durations.exit).reduceMotion(ReduceMotion.System)

type Mode = 'save' | 'welcome_back'

export default function LoginScreen() {
	const insets = useSafeAreaInsets()
	const { colors: c, layout, radii, elevation } = useTheme()
	const s = useStyles()
	const skyPhase = useSkyPhase()
	const { draft } = usePetDraft()
	const params = useLocalSearchParams<{ mode?: string }>()

	// Fixed for this visit: saving clears the draft, and the screen must not change its mind
	// about what it is while the root layout moves on.
	const [mode] = useState<Mode>(() =>
		params.mode === 'welcome_back' || !draft ? 'welcome_back' : 'save'
	)
	const [saving] = useState<PetDraft | null>(() => (mode === 'save' ? draft : null))
	const name = saving?.name.trim() || 'your pet'

	const afterSignIn = useAfterSignIn(saving)
	const otp = useEmailOtp(afterSignIn.signedIn)
	const thirdParty = useThirdPartySignIn(afterSignIn.signedIn)
	const { after } = afterSignIn
	const verified = after !== 'none'
	// One way in at a time: whatever is on its way, the others wait.
	const loading = otp.loading ?? thirdParty.loading
	const error = otp.error ?? thirdParty.error

	useEffect(() => {
		track('pet_save_viewed', { mode })
	}, [mode])

	function changeEmail(value: string) {
		otp.setEmail(value)
		thirdParty.clearError()
	}

	function sendCode() {
		thirdParty.clearError()
		void otp.sendCode()
	}

	function goBack() {
		if (router.canGoBack()) router.back()
		else router.replace('/')
	}

	const [mood, line] = petLine(otp.step, otp.codeError, after, afterSignIn.tick)

	return (
		<KeyboardAvoidingView
			style={[s.root, { backgroundColor: c.surface }]}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<ScrollView
				contentContainerStyle={s.scroll}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
				bounces={false}
			>
				{/* ── The sky and the lockup, behind the sheet ── */}
				<View style={{ height: SHEET_EDGE + radii.sheet, backgroundColor: c.bg }}>
					<SkyBand phase={skyPhase} height={SHEET_EDGE + radii.sheet} />
					<View
						style={[s.topBar, { paddingTop: insets.top + 6, paddingHorizontal: layout.gutter }]}
					>
						<View style={s.side}>
							{verified ? null : (
								<IconButton
									onPress={goBack}
									accessibilityLabel="Back"
									icon={(color) => <ChevronLeft size={22} color={color} strokeWidth={2} />}
								/>
							)}
						</View>
						<View style={s.lockup} accessibilityRole="header" accessibilityLabel={APP_NAME}>
							<LogoMark size={32} />
							<Text variant="h3" style={s.wordmark}>
								{APP_NAME}
							</Text>
						</View>
						<View style={s.side} />
					</View>
				</View>

				{/* ── The sheet ── */}
				<View
					style={[
						s.sheet,
						elevation.raised,
						{
							marginTop: -radii.sheet,
							borderTopLeftRadius: radii.sheet,
							borderTopRightRadius: radii.sheet,
							borderColor: c.borderGlass,
							paddingHorizontal: layout.gutterWide,
							paddingBottom: insets.bottom + 18
						}
					]}
				>
					{otp.step === 'email' ? (
						<Animated.View key="email" entering={stepIn} exiting={stepOut} style={s.step}>
							<EmailStep
								mode={mode}
								name={name}
								email={otp.email}
								onEmailChange={changeEmail}
								error={error}
								onSend={sendCode}
								sending={loading === 'email'}
								busy={loading !== null && loading !== 'email'}
								providers={
									THIRD_PARTY_SIGN_IN ? (
										<ProviderButtons
											nativeApple={thirdParty.nativeApple}
											loading={loading}
											onApple={() => void thirdParty.signInWithApple()}
											onProvider={(provider) => void thirdParty.signInWithProvider(provider)}
										/>
									) : null
								}
							/>
						</Animated.View>
					) : (
						<Animated.View key="otp" entering={stepIn} exiting={stepOut} style={s.step}>
							<CodeStep
								sentTo={normalizeEmail(otp.email)}
								code={otp.code}
								onCodeChange={otp.changeCode}
								codeRef={otp.codeRef}
								verifying={loading === 'code'}
								codeError={otp.codeError}
								verified={verified}
								lockoutLeft={otp.locked ? otp.lockoutLeft : null}
								message={
									<AfterMessage
										after={after}
										name={name}
										error={error}
										onRetry={afterSignIn.signedIn}
									/>
								}
								onVerify={() => void otp.verify(otp.code)}
								cooldown={otp.cooldown}
								busy={loading !== null}
								onResend={() => void otp.resend()}
								onChangeEmail={otp.changeEmail}
							/>
						</Animated.View>
					)}

					<View style={s.legal}>
						<TextLink
							label="Privacy Policy"
							tone="tertiary"
							onPress={() => router.push('/privacy')}
						/>
						<TextLink
							label="Terms of Service"
							tone="tertiary"
							onPress={() => router.push('/terms')}
						/>
					</View>
				</View>

				{/* ── The pet (or Welcome back's trio) on the sheet's edge, above both ── */}
				<SheetPets
					saving={saving}
					name={name}
					mood={mood}
					line={line}
					hearts={afterSignIn.hearts}
				/>
			</ScrollView>
		</KeyboardAvoidingView>
	)
}

const useStyles = makeStyles((c) => ({
	root: { flex: 1 },
	scroll: { flexGrow: 1 },
	topBar: { flexDirection: 'row', alignItems: 'center' },
	side: { width: 52 },
	lockup: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 10
	},
	wordmark: { fontSize: 22 },
	sheet: {
		flex: 1,
		zIndex: 1,
		backgroundColor: c.surface,
		borderTopWidth: StyleSheet.hairlineWidth,
		paddingTop: 28,
		gap: 24
	},
	step: { gap: 20 },
	legal: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 28,
		marginTop: 'auto',
		paddingTop: 12
	}
}))
