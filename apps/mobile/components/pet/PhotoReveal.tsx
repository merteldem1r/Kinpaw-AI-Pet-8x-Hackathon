import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	cancelAnimation,
	Easing,
	FadeIn,
	ReduceMotion,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming,
	ZoomIn
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { Ear, Eye, Sparkle, Sparkles, Waves } from 'lucide-react-native'
import { art, withAlpha } from '@app/brand'
import type { PetAppearance } from '@app/contract'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { seenChips } from '@/lib/petPhoto'
import { Durations, Easings, useReducedMotion } from '@/lib/motion'

/** The rays' box, pt: wide enough to reach the stage's corners from the pet. */
const RAYS = 560
const RAY_COUNT = 14
/** One turn of the rays: slow, a backdrop. */
const RAYS_TURN_MS = 40_000
/** The burst at the reveal: how many sparkles, how far they fly (pt), how long. */
const BURST = 10
const BURST_REACH = 120
const BURST_MS = 900
/** The pet's gentle bob once it is there: how high (pt), half a bob (ms). */
const BOB = 4
const BOB_HALF_MS = 1_400
/** The traits popping in one after another, ms apart. */
const TRAIT_STAGGER_MS = 90

/**
 * Light rays turning slowly behind the revealed pet, fading in as it lands
 * (docs/application/features/v2-pet-from-photo-requirements.md, R14). Centred at `centerY` from
 * the stage's top. Still under Reduce Motion.
 */
export function RevealRays({ centerY }: { centerY: number }) {
	const { colors: c } = useTheme()
	const still = useReducedMotion()
	const turn = useSharedValue(0)
	useEffect(() => {
		if (still) return
		// Linear on purpose: an eased turn would stall once a lap.
		turn.value = withRepeat(withTiming(1, { duration: RAYS_TURN_MS, easing: Easing.linear }), -1)
		return () => cancelAnimation(turn)
	}, [turn, still])
	const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }))
	const r = RAYS / 2
	const wedge = Math.PI / RAY_COUNT
	const d = Array.from({ length: RAY_COUNT }, (_, i) => {
		const a = i * 2 * wedge
		const x1 = r + r * Math.cos(a - wedge / 2)
		const y1 = r + r * Math.sin(a - wedge / 2)
		const x2 = r + r * Math.cos(a + wedge / 2)
		const y2 = r + r * Math.sin(a + wedge / 2)
		return `M${r} ${r} L${x1} ${y1} L${x2} ${y2} Z`
	}).join(' ')
	return (
		<Animated.View
			pointerEvents="none"
			entering={FadeIn.duration(Durations.slow).reduceMotion(ReduceMotion.System)}
			style={[s.rays, { top: centerY - r }, style]}
		>
			<Svg width={RAYS} height={RAYS}>
				<Path d={d} fill={withAlpha(c.brandInk, 0.07)} />
			</Svg>
		</Animated.View>
	)
}

/** Sparkles bursting out of the pet once, as it finishes drawing itself. None under Reduce Motion. */
export function RevealBurst({ centerY }: { centerY: number }) {
	const still = useReducedMotion()
	if (still) return null
	return (
		<View pointerEvents="none" style={[s.burst, { top: centerY }]}>
			{Array.from({ length: BURST }, (_, i) => (
				<BurstSparkle key={i} angle={(i / BURST) * Math.PI * 2 + 0.3} index={i} />
			))}
		</View>
	)
}

function BurstSparkle({ angle, index }: { angle: number; index: number }) {
	const { colors: c } = useTheme()
	const t = useSharedValue(0)
	// Some fly further than others, so the burst isn't a ring.
	const reach = BURST_REACH * (index % 2 === 0 ? 1 : 0.7)
	useEffect(() => {
		t.value = withTiming(1, { duration: BURST_MS, easing: Easings.out })
	}, [t])
	const style = useAnimatedStyle(() => ({
		opacity: t.value < 0.15 ? t.value / 0.15 : 1 - (t.value - 0.15) / 0.85,
		transform: [
			{ translateX: Math.cos(angle) * reach * t.value },
			{ translateY: Math.sin(angle) * reach * t.value },
			{ scale: 0.4 + t.value * 0.8 },
			{ rotate: `${t.value * 120}deg` }
		]
	}))
	return (
		<Animated.View style={[s.burstSparkle, style]}>
			<Sparkle
				size={index % 3 === 0 ? 14 : 10}
				strokeWidth={2}
				color={c.brandInk}
				fill={c.brandInk}
			/>
		</Animated.View>
	)
}

/**
 * The revealed pet, bobbing gently as if it breathes, from when `active` turns on. Wrap the pet
 * from the start, so turning it on doesn't remount what is inside. Still under Reduce Motion.
 */
export function Bobbing({ active, children }: { active: boolean; children: React.ReactNode }) {
	const still = useReducedMotion()
	const y = useSharedValue(0)
	useEffect(() => {
		if (still || !active) return
		const half = { duration: BOB_HALF_MS, easing: Easings.inOut }
		y.value = withDelay(
			BURST_MS / 2,
			withRepeat(withSequence(withTiming(-BOB, half), withTiming(0, half)), -1)
		)
		return () => cancelAnimation(y)
	}, [y, still, active])
	const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }))
	return <Animated.View style={style}>{children}</Animated.View>
}

/**
 * What was seen in the photo (R14), as a card: a "What we saw" header, then each trait popping in
 * in turn, the colours with their own swatch (fur, white markings, eyes) and the rest with an icon.
 * Read as one line by VoiceOver.
 */
export function SeenTraits({ appearance, label }: { appearance: PetAppearance; label: string }) {
	const { colors: c, radii } = useTheme()
	return (
		<View
			style={[
				s.card,
				{ backgroundColor: c.surface2, borderColor: c.borderHairline, borderRadius: radii.card }
			]}
			accessible
			accessibilityLabel={`What we saw: ${label}`}
		>
			<View style={s.header}>
				<Sparkles size={14} strokeWidth={2.2} color={c.brandInk} />
				<Text variant="caption" style={[s.headerText, { color: c.brandInk }]}>
					WHAT WE SAW
				</Text>
			</View>
			<View style={s.traits}>
				{seenChips(appearance).map((chip, i) => (
					<Animated.View
						key={chip.key}
						entering={ZoomIn.delay(i * TRAIT_STAGGER_MS)
							.springify()
							.reduceMotion(ReduceMotion.System)}
						style={[s.trait, { backgroundColor: c.surface3, borderColor: c.borderSoft }]}
					>
						<TraitMark kind={chip.key} appearance={appearance} />
						<Text variant="caption" style={{ color: c.textPrimary }} numberOfLines={1}>
							{chip.label}
						</Text>
					</Animated.View>
				))}
			</View>
		</View>
	)
}

const SWATCH = 14

function TraitMark({ kind, appearance }: { kind: string; appearance: PetAppearance }) {
	const { colors: c } = useTheme()
	const swatch = (color: string, second?: string) => (
		<View style={[s.swatch, { backgroundColor: color, borderColor: c.borderActive }]}>
			{second ? <View style={[s.swatchHalf, { backgroundColor: second }]} /> : null}
		</View>
	)
	switch (kind) {
		case 'fur':
			return swatch(art.pet.fur[appearance.fur].base)
		case 'white':
			return swatch(art.pet.white)
		case 'eyes':
			return appearance.eyes === 'odd'
				? swatch(art.pet.eyes.blue, art.pet.eyes.amber)
				: swatch(art.pet.eyes[appearance.eyes])
		case 'ears':
			return <Ear size={SWATCH} strokeWidth={2} color={c.brandInk} />
		case 'pattern':
			return <Waves size={SWATCH} strokeWidth={2} color={c.brandInk} />
		default:
			return <Eye size={SWATCH} strokeWidth={2} color={c.brandInk} />
	}
}

const s = StyleSheet.create({
	rays: { position: 'absolute', alignSelf: 'center', width: RAYS, height: RAYS },
	burst: { position: 'absolute', alignSelf: 'center', width: 0, height: 0 },
	burstSparkle: { position: 'absolute', left: -7, top: -7 },
	card: { borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
	header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	headerText: { fontWeight: '600', letterSpacing: 1.2 },
	traits: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	trait: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 7,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 16,
		paddingLeft: 9,
		paddingRight: 12,
		paddingVertical: 7
	},
	swatch: {
		width: SWATCH,
		height: SWATCH,
		borderRadius: SWATCH / 2,
		borderWidth: StyleSheet.hairlineWidth,
		overflow: 'hidden'
	},
	swatchHalf: { position: 'absolute', right: 0, top: 0, bottom: 0, width: SWATCH / 2 }
})
