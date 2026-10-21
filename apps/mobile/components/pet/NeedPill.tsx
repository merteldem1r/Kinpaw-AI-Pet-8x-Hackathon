import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { Heart, Smile, Soup, Sparkle, Zap, type LucideIcon } from 'lucide-react-native'
import { art, withAlpha } from '@app/brand'
import { isLow, type Need } from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { Easings, Springs } from '@/lib/motion'

/** Each need's name and icon, shared with the need sheet. */
export const NEED: Record<Need, { label: string; icon: LucideIcon }> = {
	hunger: { label: 'Hunger', icon: Soup },
	happiness: { label: 'Happiness', icon: Smile },
	energy: { label: 'Energy', icon: Zap },
	affection: { label: 'Affection', icon: Heart }
}

/** The pill's height, pt. */
export const NEED_PILL_HEIGHT = 32
/** Taller to the touch than to the eye: 32 + 2 × 6 = 44pt. */
const HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 }
const BAR = 5
const BAR_WIDTH = 40
/** A change this big or bigger plays the effects; the minute-by-minute decay just moves the bar. */
const NOTICEABLE = 3
/** A drop: the lost part lingers as a ghost this long, then drains away over DRAIN_MS. */
const GHOST_HOLD_MS = 450
const DRAIN_MS = 550
/** A rise: the new part glows, then settles into the fill. */
const GLOW_MS = 900
const SHINE_MS = 700
const SHINE_WIDTH = 16
/** The edge of a low pill, pt. */
const LOW_EDGE = 1.5
/** The floating "+20" / "−5". */
const FLOAT_MS = 1100
/** A tap: the icon pops this much and the edge flashes, fading over TAP_FADE_MS. */
const TAP_POP = 1.3
const TAP_FADE_MS = 650
const FLOAT_RISE = 20

type Change = { key: number; from: number; to: number }

/**
 * One need on Home, in a small pill beside the pet (docs/application/UI/
 * kinpaw-screen-spec-v1.md, "Home" → NeedPill): an icon, then a short bar in
 * `brandInk`; no name and no number on screen. Below 30 the edge, icon and bar
 * turn `errorText` and "low" follows the bar, so low never rides on colour
 * alone. VoiceOver reads "Hunger, 58 percent, low". A tap opens the sheet that
 * explains the need (`onPress`); its touch area reaches 44pt. The tap shows on
 * the pill itself: the icon pops and the edge flashes in the need's colour,
 * then fades (Reduce Motion: only the haptic).
 *
 * A change of NOTICEABLE or more shows which way it went:
 * - up: the new part of the bar glows and a light sheen runs along it, the
 *   icon bounces, and a "+20" floats up from the bar's end; reaching full pops
 *   a few sparkles there;
 * - down: the lost part stays as a faded red ghost, then drains away, the icon
 *   droops, and a "−5" floats up in red.
 * Under Reduce Motion the bar simply moves.
 */
export function NeedPill({
	need,
	value,
	onPress
}: {
	need: Need
	value: number
	onPress: () => void
}) {
	const { colors: c, elevation } = useTheme()
	const reduceMotion = useReducedMotion()
	const { label, icon: Icon } = NEED[need]
	const low = isLow(value)
	const color = low ? c.errorText : c.brandInk
	const clamped = Math.min(100, Math.max(0, value))

	const [change, setChange] = useState<Change | null>(null)
	const previous = useRef(clamped)

	const fill = useSharedValue(clamped)
	const ghost = useSharedValue(clamped)
	const glow = useSharedValue(0)
	const shine = useSharedValue(0)
	const iconLift = useSharedValue(0)
	const iconTurn = useSharedValue(0)
	const iconScale = useSharedValue(1)
	const tapped = useSharedValue(0)

	useEffect(() => {
		const from = previous.current
		previous.current = clamped
		fill.value = withSpring(clamped, Springs.smooth)
		const delta = clamped - from
		if (reduceMotion || Math.abs(delta) < NOTICEABLE) {
			// Never ahead of the springing fill, or a sliver of red would show on a rise.
			ghost.value = Math.min(from, clamped)
			return
		}
		setChange((current) => ({ key: (current?.key ?? 0) + 1, from, to: clamped }))
		if (delta > 0) {
			ghost.value = from
			glow.value = withSequence(
				withTiming(1, { duration: 120 }),
				withTiming(0, { duration: GLOW_MS })
			)
			shine.value = 0
			shine.value = withDelay(150, withTiming(1, { duration: SHINE_MS, easing: Easings.inOut }))
			iconScale.value = withSequence(
				withTiming(1.35, { duration: 140 }),
				withSpring(1, Springs.settle)
			)
			iconTurn.value = withSequence(
				withTiming(-12, { duration: 90 }),
				withTiming(12, { duration: 120 }),
				withSpring(0, Springs.settle)
			)
		} else {
			ghost.value = from
			ghost.value = withDelay(
				GHOST_HOLD_MS,
				withTiming(clamped, { duration: DRAIN_MS, easing: Easings.inOut })
			)
			iconLift.value = withSequence(
				withTiming(3, { duration: 180, easing: Easings.out }),
				withDelay(500, withSpring(0, Springs.settle))
			)
			iconTurn.value = withSequence(
				withTiming(-14, { duration: 180 }),
				withDelay(500, withSpring(0, Springs.settle))
			)
		}
		// The shared values never change: only a new value starts the effects.
	}, [clamped, reduceMotion, fill, ghost, glow, shine, iconLift, iconTurn, iconScale])

	const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` }))
	const ghostStyle = useAnimatedStyle(() => ({ width: `${ghost.value}%` }))
	const shineStyle = useAnimatedStyle(() => ({
		opacity: shine.value > 0 && shine.value < 1 ? 1 : 0,
		transform: [{ translateX: -SHINE_WIDTH + shine.value * (BAR_WIDTH + SHINE_WIDTH) }]
	}))
	const iconStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateY: iconLift.value },
			{ rotate: `${iconTurn.value}deg` },
			{ scale: iconScale.value }
		]
	}))

	const rising = change ? change.to > change.from : false
	const glowFrom = change && rising ? change.from : clamped
	const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }))
	const tapStyle = useAnimatedStyle(() => ({ opacity: tapped.value }))

	function press() {
		if (!reduceMotion) {
			iconScale.value = withSequence(
				withTiming(TAP_POP, { duration: 120, easing: Easings.out }),
				withSpring(1, Springs.settle)
			)
			tapped.value = withSequence(
				withTiming(1, { duration: 80 }),
				withTiming(0, { duration: TAP_FADE_MS, easing: Easings.out })
			)
		}
		onPress()
	}

	return (
		<PressableScale
			onPress={press}
			haptic="select"
			hitSlop={HIT_SLOP}
			style={[
				s.pill,
				elevation.card,
				{
					backgroundColor: c.surface2,
					borderColor: low ? c.errorText : c.borderSoft,
					borderWidth: low ? LOW_EDGE : StyleSheet.hairlineWidth
				}
			]}
			accessibilityRole="button"
			accessibilityLabel={`${label}, ${value} percent${low ? ', low' : ''}`}
			accessibilityHint={`Shows how ${label.toLowerCase()} works`}
		>
			{/* The tap's flash: the edge lit in the need's colour, with a soft glow, then gone. */}
			<Animated.View
				pointerEvents="none"
				style={[
					s.tapFlash,
					{ borderColor: color, shadowColor: color, backgroundColor: withAlpha(color, 0.14) },
					tapStyle
				]}
			/>
			<Animated.View style={iconStyle}>
				<Icon size={16} color={low ? c.errorText : c.textSecondary} strokeWidth={1.9} />
			</Animated.View>

			<View style={s.barWrap}>
				<View style={[s.track, { backgroundColor: c.tintTrack }]}>
					{/* What was lost, lingering in red before it drains (only ever wider than the fill on a drop). */}
					<Animated.View
						style={[s.bar, { backgroundColor: withAlpha(c.errorText, 0.45) }, ghostStyle]}
					/>
					<Animated.View style={[s.bar, s.fill, { backgroundColor: color }, fillStyle]}>
						<Animated.View pointerEvents="none" style={[s.shine, shineStyle]}>
							<LinearGradient
								colors={[
									withAlpha(art.cloud, 0),
									withAlpha(art.cloud, 0.75),
									withAlpha(art.cloud, 0)
								]}
								start={{ x: 0, y: 0.5 }}
								end={{ x: 1, y: 0.5 }}
								style={StyleSheet.absoluteFill}
							/>
						</Animated.View>
					</Animated.View>
					{/* What was gained, glowing for a moment over the fill. */}
					{change && rising ? (
						<Animated.View
							pointerEvents="none"
							style={[
								s.bar,
								s.gain,
								{
									left: `${glowFrom}%`,
									width: `${change.to - glowFrom}%`,
									backgroundColor: withAlpha(art.cloud, 0.6),
									shadowColor: c.brandInk
								},
								glowStyle
							]}
						/>
					) : null}
				</View>

				{change ? (
					<>
						<FloatingDelta
							key={`delta-${change.key}`}
							delta={change.to - change.from}
							at={change.to}
							color={rising ? c.brandInk : c.errorText}
						/>
						{rising && change.to >= 100 ? <FullSparkles key={`full-${change.key}`} /> : null}
					</>
				) : null}
			</View>

			{low ? (
				<Text variant="caption" style={[s.low, { color: c.errorText }]}>
					low
				</Text>
			) : null}
		</PressableScale>
	)
}

/** "+20" or "−5", floating up from where the bar now ends, then gone. */
function FloatingDelta({ delta, at, color }: { delta: number; at: number; color: string }) {
	const progress = useSharedValue(0)
	useEffect(() => {
		progress.value = withTiming(1, { duration: FLOAT_MS, easing: Easings.out })
	}, [progress])
	const style = useAnimatedStyle(() => ({
		opacity: progress.value < 0.2 ? progress.value / 0.2 : 1 - (progress.value - 0.2) / 0.8,
		transform: [{ translateY: -progress.value * FLOAT_RISE }]
	}))
	const text = delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`
	return (
		<Animated.View
			pointerEvents="none"
			style={[s.delta, { left: `${Math.min(Math.max(at, 6), 86)}%` }, style]}
		>
			<Text variant="caption" style={[s.deltaText, { color }]}>
				{text}
			</Text>
		</Animated.View>
	)
}

/** A few sparkles popping off the end of a bar that just reached full. */
const SPARKS = [
	{ dx: 4, dy: -16, size: 12, delay: 0 },
	{ dx: -10, dy: -22, size: 9, delay: 90 },
	{ dx: 14, dy: -6, size: 8, delay: 170 }
]

function FullSparkles() {
	return (
		<View pointerEvents="none" style={s.sparks}>
			{SPARKS.map((spark, i) => (
				<Spark key={i} {...spark} />
			))}
		</View>
	)
}

function Spark({ dx, dy, size, delay }: { dx: number; dy: number; size: number; delay: number }) {
	const { colors: c } = useTheme()
	const progress = useSharedValue(0)
	useEffect(() => {
		progress.value = withDelay(delay, withTiming(1, { duration: 800, easing: Easings.out }))
	}, [progress, delay])
	const style = useAnimatedStyle(() => ({
		opacity: progress.value === 0 ? 0 : 1 - progress.value,
		transform: [
			{ translateX: dx * progress.value },
			{ translateY: dy * progress.value },
			{ scale: 0.4 + progress.value * 0.8 },
			{ rotate: `${progress.value * 90}deg` }
		]
	}))
	return (
		<Animated.View style={[s.spark, style]}>
			<Sparkle size={size} color={c.brandInk} fill={c.brandInk} strokeWidth={2} />
		</Animated.View>
	)
}

const s = StyleSheet.create({
	pill: {
		height: NEED_PILL_HEIGHT,
		borderRadius: NEED_PILL_HEIGHT / 2,
		paddingHorizontal: 10,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6
	},
	low: { fontWeight: '600' },
	tapFlash: {
		position: 'absolute',
		top: -1,
		bottom: -1,
		left: -1,
		right: -1,
		borderRadius: NEED_PILL_HEIGHT / 2,
		borderWidth: LOW_EDGE,
		shadowOpacity: 0.8,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 0 }
	},
	barWrap: { width: BAR_WIDTH, height: BAR },
	track: { width: '100%', height: BAR, borderRadius: BAR / 2, overflow: 'hidden' },
	bar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: BAR / 2 },
	fill: { overflow: 'hidden' },
	gain: { shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
	shine: { position: 'absolute', top: 0, bottom: 0, left: 0, width: SHINE_WIDTH },
	delta: { position: 'absolute', bottom: BAR + 10, marginLeft: -10 },
	deltaText: { fontWeight: '700', fontSize: 13 },
	sparks: { position: 'absolute', right: 0, bottom: 0 },
	spark: { position: 'absolute', right: -4, bottom: -2 }
})
