/**
 * Welcome — the first thing a new person sees: the sky at the real time of day,
 * three pets waiting together, one promise and one way forward
 * (docs/application/UI/kinpaw-screen-spec-v1.md, "Welcome"). The pets are alive
 * (components/welcome/WelcomePets.tsx).
 *
 * The first screen on every launch for anyone without a saved pet: signed out,
 * or signed in before saving one. A pet in progress keeps its choices: "Meet
 * your pet" continues it from Start. Signed in, there is no "I already have an
 * account".
 */
import { useState } from 'react'
import { View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated'
import { useMountEffect } from '@/hooks/useMountEffect'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { SkyBand } from '@/components/pet/SkyBand'
import { Button } from '@/components/ui/Button'
import { LogoMark } from '@/components/ui/Marks'
import { Text } from '@/components/ui/Text'
import { TextLink } from '@/components/ui/TextLink'
import { WelcomePets } from '@/components/welcome/WelcomePets'
import { usePetDraftActions } from '@/contexts/PetDraftContext'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from '@/lib/constants'
import { Durations, Easings } from '@/lib/motion'
import { useSkyPhase } from '@/lib/sky'
import { isSupabaseEnabled, supabase } from '@/lib/supabase'
import { makeStyles } from '@/lib/themedStyles'

/** Delay between headline words, ms. */
const WORD_STEP = 45
const SKY_HEIGHT = 480

export default function WelcomeScreen() {
	const { start } = usePetDraftActions()
	const [signedIn, setSignedIn] = useState(false)
	const phase = useSkyPhase()
	const insets = useSafeAreaInsets()
	const { layout } = useTheme()
	const s = useStyles()
	const words = APP_TAGLINE.split(' ')
	const copyBase = words.length * WORD_STEP + 120

	useMountEffect(() => {
		if (isSupabaseEnabled) {
			void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session))
		}
		track('welcome_viewed', { time_of_day: phase })
		// Once per visit, with the phase it opened on.
	})

	function meetYourPet() {
		track('welcome_start_tapped')
		// Keeps a pet in progress (its choices are kept), or starts one.
		start()
		router.push('/start')
	}

	function signIn() {
		track('welcome_signin_tapped')
		router.push({ pathname: '/(auth)/login', params: { mode: 'welcome_back' } })
	}

	return (
		<View style={s.root}>
			<SkyBand phase={phase} height={SKY_HEIGHT} />

			<View style={[s.top, { paddingTop: insets.top + 12, paddingHorizontal: layout.gutterWide }]}>
				<LogoMark size={32} />
				<Text variant="h3">{APP_NAME}</Text>
			</View>

			<View
				style={s.stage}
				accessible
				accessibilityRole="image"
				accessibilityLabel="Three pets waiting together: a tuxedo cat, a ginger cat and a golden dog"
			>
				<WelcomePets phase={phase} />
			</View>

			<View style={[s.copy, { paddingHorizontal: layout.gutterWide }]}>
				<View style={s.headline} accessibilityRole="header" accessibilityLabel={APP_TAGLINE}>
					{words.map((word, i) => (
						<Animated.View
							key={`${word}-${i}`}
							entering={FadeInDown.delay(260 + i * WORD_STEP)
								.duration(Durations.enter)
								.easing(Easings.out)
								.reduceMotion(ReduceMotion.System)}
						>
							<Text variant="display">{word} </Text>
						</Animated.View>
					))}
				</View>
				<FadeSlideIn index={0} base={copyBase}>
					<Text variant="lead" tone="secondary">
						{APP_DESCRIPTION}
					</Text>
				</FadeSlideIn>
			</View>

			<FadeSlideIn
				index={1}
				base={copyBase}
				style={[
					s.actions,
					{ paddingBottom: insets.bottom + 16, paddingHorizontal: layout.gutterWide }
				]}
			>
				<Button label="Meet your pet" size="lg" withArrow fullWidth onPress={meetYourPet} />
				{signedIn ? null : (
					<Button label="I already have an account" variant="ghost" fullWidth onPress={signIn} />
				)}
				{/* Each link its own element with a 44pt touch area; the line wraps as words (M8, R2). */}
				<View style={s.legal}>
					<Text variant="caption" tone="tertiary">
						By continuing you agree to the
					</Text>
					<TextLink label="Terms" underline onPress={() => router.push('/terms')} />
					<Text variant="caption" tone="tertiary">
						and
					</Text>
					<TextLink label="Privacy Policy" underline onPress={() => router.push('/privacy')} />
				</View>
			</FadeSlideIn>
		</View>
	)
}

const useStyles = makeStyles((c) => ({
	root: { flex: 1, backgroundColor: c.bg },
	top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	stage: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 200 },
	copy: { gap: 14, paddingTop: 12, paddingBottom: 24 },
	headline: { flexDirection: 'row', flexWrap: 'wrap' },
	actions: { gap: 6 },
	legal: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		justifyContent: 'center',
		columnGap: 4,
		marginTop: 8
	}
}))
