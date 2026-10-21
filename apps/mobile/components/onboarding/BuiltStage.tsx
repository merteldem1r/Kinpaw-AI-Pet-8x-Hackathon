import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import Animated, {
	FadeInDown,
	ReduceMotion,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming
} from 'react-native-reanimated'
import { Sparkle } from 'lucide-react-native'
import { art } from '@app/brand'
import { optionLabel, type Species } from '@app/contract'
import { CARD_STAGE } from '@/components/onboarding/PathCard'
import { PetArt } from '@/components/pet/PetArt'
import { RoomGlow } from '@/components/pet/RoomGlow'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { Durations, Easings } from '@/lib/motion'
import { SHOWCASE } from '@/lib/petShowcase'

// The "Make your own" card's stage on Create · Start: a pet changing through looks someone could
// build (lib/petShowcase.ts), on a lit pedestal with sparkles, its fur swatch and two chips.

/** How long each built pet shows, ms. */
const CYCLE_MS = 1700
/** The spotlight behind the built pet, pt across. */
const SPOTLIGHT = 230
/** Sparkles around the built pet: where (share of the stage), how big, when they twinkle. */
const SPARKLES: { x: number; y: number; size: number; delay: number }[] = [
	{ x: 0.28, y: 0.24, size: 12, delay: 0 },
	{ x: 0.22, y: 0.58, size: 9, delay: 1300 },
	{ x: 0.5, y: 0.04, size: 8, delay: 1000 },
	{ x: 0.64, y: 0.74, size: 11, delay: 400 },
	{ x: 0.34, y: 0.8, size: 8, delay: 700 }
]
const TWINKLE_HALF_MS = 900

/**
 * One pet changing every 1.7 s through four built looks, rising in on each change, with a
 * column of fur swatches and two chips that follow it. Under Reduce Motion it holds still, and
 * it waits while Start is covered: Start stays mounted under the next steps, and a new pet
 * drawn there every 1.7 s made Make your own stutter.
 */
export function BuiltStage({ species }: { species: Species }) {
	const { colors: c } = useTheme()
	const reduceMotion = useReducedMotion()
	const [index, setIndex] = useState(0)
	const [focused, setFocused] = useState(true)
	const pets = SHOWCASE[species]

	useFocusEffect(
		useCallback(() => {
			setFocused(true)
			return () => setFocused(false)
		}, [])
	)

	useEffect(() => setIndex(0), [species])

	useEffect(() => {
		if (reduceMotion || !focused) return
		const id = setInterval(() => setIndex((i) => (i + 1) % pets.length), CYCLE_MS)
		return () => clearInterval(id)
	}, [reduceMotion, focused, pets.length])

	const pet = pets[index] ?? pets[0]!
	return (
		<>
			<View style={s.spotlight} pointerEvents="none">
				<RoomGlow size={SPOTLIGHT} />
			</View>
			<View style={[s.pedestal, { backgroundColor: c.brandDim, borderColor: c.brandBorder }]} />
			{!reduceMotion ? <Poof key={`poof-${species}-${index}`} /> : null}
			{SPARKLES.map((sparkle, i) => (
				<TwinkleSparkle key={i} {...sparkle} still={reduceMotion} />
			))}
			<View style={[s.swatches, { backgroundColor: c.surface, borderColor: c.borderSoft }]}>
				{pets.map((p, i) => (
					<View
						key={p.fur}
						style={[
							s.swatch,
							{ backgroundColor: art.pet.fur[p.fur].base },
							i === index && { borderColor: c.brandInk, borderWidth: 2 }
						]}
					/>
				))}
			</View>
			<Animated.View
				key={`${species}-${index}`}
				entering={FadeInDown.duration(Durations.base)
					.easing(Easings.out)
					.reduceMotion(ReduceMotion.System)}
				style={s.built}
			>
				<PetArt appearance={pet} mood="happy" size={128} />
			</Animated.View>
			<View style={s.chips}>
				<Chip label={optionLabel('pattern', pet.pattern, species)} />
				<Chip label={`${optionLabel('eyes', pet.eyes, species)} eyes`} />
			</View>
		</>
	)
}

/** A ring puffing out behind the pet as it changes into a new look. */
function Poof() {
	const { colors: c } = useTheme()
	const progress = useSharedValue(0)
	useEffect(() => {
		progress.value = withTiming(1, { duration: 650, easing: Easings.out })
	}, [progress])
	const style = useAnimatedStyle(() => ({
		opacity: 0.55 * (1 - progress.value),
		transform: [{ scale: 0.5 + progress.value * 0.9 }]
	}))
	return <Animated.View pointerEvents="none" style={[s.poof, { borderColor: c.brandInk }, style]} />
}

/** One sparkle near the built pet, twinkling on its own beat; a dim still one under Reduce Motion. */
function TwinkleSparkle({
	x,
	y,
	size,
	delay,
	still
}: {
	x: number
	y: number
	size: number
	delay: number
	still: boolean
}) {
	const { colors: c } = useTheme()
	const level = useSharedValue(still ? 0.6 : 0)
	useEffect(() => {
		if (still) return
		const ease = { duration: TWINKLE_HALF_MS, easing: Easings.inOut }
		level.value = withDelay(
			delay,
			withRepeat(withSequence(withTiming(1, ease), withTiming(0, ease)), -1, false)
		)
	}, [level, delay, still])
	const style = useAnimatedStyle(() => ({
		opacity: level.value,
		transform: [{ scale: 0.6 + level.value * 0.4 }, { rotate: `${level.value * 45}deg` }]
	}))
	return (
		<Animated.View
			pointerEvents="none"
			style={[s.sparkle, { left: `${x * 100}%`, top: `${y * 100}%` }, style]}
		>
			<Sparkle size={size} strokeWidth={2} color={c.brandInk} fill={c.brandInk} />
		</Animated.View>
	)
}

function Chip({ label }: { label: string }) {
	const { colors: c } = useTheme()
	return (
		<View style={[s.chip, { backgroundColor: c.surface, borderColor: c.borderSoft }]}>
			<Text variant="caption" style={{ color: c.textPrimary }} numberOfLines={1}>
				{label}
			</Text>
		</View>
	)
}

const s = StyleSheet.create({
	spotlight: {
		position: 'absolute',
		top: CARD_STAGE - 64 - SPOTLIGHT / 2,
		alignSelf: 'center'
	},
	pedestal: {
		position: 'absolute',
		bottom: 2,
		alignSelf: 'center',
		width: 128,
		height: 20,
		borderRadius: 64,
		borderWidth: StyleSheet.hairlineWidth
	},
	poof: {
		position: 'absolute',
		top: CARD_STAGE - 64 - 60,
		alignSelf: 'center',
		width: 120,
		height: 120,
		borderRadius: 60,
		borderWidth: 2
	},
	sparkle: { position: 'absolute' },
	swatches: {
		position: 'absolute',
		left: 16,
		top: 16,
		bottom: 16,
		width: 34,
		borderRadius: 17,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'space-evenly'
	},
	swatch: { width: 20, height: 20, borderRadius: 10, borderColor: 'transparent' },
	built: { position: 'absolute', bottom: -6, alignSelf: 'center' },
	chips: { position: 'absolute', right: 14, top: 18, gap: 8, alignItems: 'flex-end' },
	chip: {
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 14,
		paddingHorizontal: 12,
		paddingVertical: 6
	}
})
