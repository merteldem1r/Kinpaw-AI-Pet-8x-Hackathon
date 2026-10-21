import { useEffect, useMemo, type ReactNode } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { localDay, type Pet } from '@app/contract'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { FactOrbit } from '@/components/intro/FactOrbit'
import { PetArt } from '@/components/pet/PetArt'
import { PetBubble } from '@/components/pet/PetBubble'
import { RiseAndBreathe } from '@/components/pet/RiseAndBreathe'
import { RoomGlow } from '@/components/pet/RoomGlow'
import { SkyBand } from '@/components/pet/SkyBand'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Glow } from '@/components/ui/Marks'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import type { IntroResult } from '@/hooks/useIntroTell'
import { haptic } from '@/lib/haptics'
import { Springs } from '@/lib/motion'
import { useSkyPhase } from '@/lib/sky'
import { deviceTimeZone } from '@/lib/timeZone'

/** The pet alone in the middle when nothing was kept, pt. */
const ALONE_SIZE = 220

/**
 * "Tell me about you"'s result: the pet, big in the middle under the live sky (Home's, with its
 * sun or moon and life), its line above, and what it will remember floating around it.
 * Read-only: there is no ✕ here, so nothing is sent while the moment plays (Mert, 2026-10-04);
 * the line under Go home says where to change them.
 */
export function ResultPage({
	name,
	pet,
	result,
	onDone
}: {
	name: string
	pet: Pet | undefined
	result: IntroResult
	onDone: () => void
}) {
	const insets = useSafeAreaInsets()
	const { width, height } = useWindowDimensions()
	const { colors: c, layout } = useTheme()
	const phase = useSkyPhase()
	const night = phase === 'evening' || phase === 'night'
	const today = useMemo(() => localDay(new Date(), deviceTimeZone()), [])
	const bounce = useSharedValue(1)
	const bounceStyle = useAnimatedStyle(() => ({ transform: [{ scale: bounce.value }] }))
	const kept = result.facts.length > 0

	// The pet bounces as each fact lands; the first is the moment (a success haptic).
	function landed(first: boolean) {
		if (first) haptic.success()
		bounce.value = withSequence(withSpring(1.05, Springs.snappy), withSpring(1, Springs.settle))
	}

	useEffect(() => {
		if (!kept) haptic.success()
	}, [kept])

	const petView = (size: number): ReactNode =>
		pet ? (
			<View style={s.petWrap}>
				{/* The lamp behind the pet in the evening and at night, as at home. */}
				{night ? (
					<View style={[s.lamp, { top: -size * 0.35 }]}>
						<RoomGlow size={size * 1.9} />
					</View>
				) : null}
				<Animated.View style={bounceStyle}>
					<RiseAndBreathe>
						<PetArt appearance={pet.appearance} mood="happy" size={size} label={`${name}, happy`} />
					</RiseAndBreathe>
				</Animated.View>
			</View>
		) : null

	return (
		<View style={[s.root, { backgroundColor: c.bg }]}>
			<SkyBand phase={phase} height={height * 0.62} />
			<Glow size={width * 1.5} strength={0.9} style={[s.glow, { left: -width * 0.25 }]} />
			<View style={[s.top, { paddingTop: insets.top + 12, paddingHorizontal: layout.gutterWide }]}>
				<Eyebrow tone={night ? 'brand' : 'primary'}>
					{kept ? `${name} will remember` : 'Nice to meet you'}
				</Eyebrow>
				<FadeSlideIn index={1}>
					<PetBubble line={result.line} style={s.bubble} />
				</FadeSlideIn>
			</View>
			<View style={[s.orbit, { paddingHorizontal: layout.gutter }]}>
				{kept ? (
					<FactOrbit facts={result.facts} today={today} pet={petView} onLand={landed} />
				) : (
					<View style={s.alone}>{petView(ALONE_SIZE)}</View>
				)}
			</View>
			<View
				style={[
					s.bottom,
					{ paddingHorizontal: layout.gutterWide, paddingBottom: insets.bottom + 12 }
				]}
			>
				<Button label="Go home" size="lg" withArrow fullWidth onPress={onDone} />
				{kept ? (
					<Text variant="caption" tone="secondary" style={s.center}>
						{`Something not right? See or forget any of these on ${name}'s page, anytime.`}
					</Text>
				) : null}
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	root: { flex: 1 },
	glow: { position: 'absolute', top: '22%' },
	top: { gap: 12, alignItems: 'flex-start' },
	bubble: { maxWidth: 300 },
	petWrap: { alignItems: 'center' },
	lamp: { position: 'absolute', alignItems: 'center' },
	orbit: { flex: 1, paddingVertical: 12 },
	alone: { flex: 1, alignItems: 'center', justifyContent: 'center' },
	bottom: { gap: 10 },
	center: { textAlign: 'center' }
})
