import { useEffect, useState } from 'react'
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
import Svg, { Circle } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { Check, PawPrint, Sparkle } from 'lucide-react-native'
import { withAlpha } from '@app/brand'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { Durations, Easings, useReducedMotion } from '@/lib/motion'

/** The portal's box, pt. */
const PORTAL = 190
const OUTER_R = 80
const INNER_R = 62
const ORBIT_R = 90
const CORE = 104
/** One turn of each ring and of the orbiting sparkles, ms; the inner ring turns the other way. */
const OUTER_TURN_MS = 9_000
const INNER_TURN_MS = 6_000
const ORBIT_TURN_MS = 4_500
/** One breath of the core and the paw. */
const BREATH_MS = 1_100
/** Dust rising into the portal: where it starts (share of the width), when, how big. */
const DUST = [
	{ x: 0.18, delay: 0, size: 4 },
	{ x: 0.34, delay: 900, size: 3 },
	{ x: 0.52, delay: 400, size: 5 },
	{ x: 0.68, delay: 1300, size: 3 },
	{ x: 0.82, delay: 700, size: 4 },
	{ x: 0.44, delay: 1700, size: 3 }
] as const
const DUST_RISE_MS = 2_200
const DUST_RISE = 150

/**
 * Where the pet will appear while the photo is read (docs/application/features/v2-pet-from-
 * photo-requirements.md, R13): a portal of two dashed rings turning opposite ways, sparkles
 * orbiting it, a paw breathing at its heart and dust rising into it. No pet shape: the photo
 * decides the species. Holds still under Reduce Motion.
 */
export function ReadingPortal() {
	const { colors: c } = useTheme()
	const still = useReducedMotion()
	return (
		<View style={s.portal} accessible accessibilityLabel="Reading your photo">
			{still ? null : DUST.map((dust, i) => <Dust key={i} {...dust} />)}
			<Turning ms={OUTER_TURN_MS} still={still}>
				<Svg width={PORTAL} height={PORTAL}>
					<Circle
						cx={PORTAL / 2}
						cy={PORTAL / 2}
						r={OUTER_R}
						stroke={withAlpha(c.brandInk, 0.55)}
						strokeWidth={2}
						strokeDasharray="1 9"
						strokeLinecap="round"
						fill="none"
					/>
				</Svg>
			</Turning>
			<Turning ms={INNER_TURN_MS} reverse still={still}>
				<Svg width={PORTAL} height={PORTAL}>
					<Circle
						cx={PORTAL / 2}
						cy={PORTAL / 2}
						r={INNER_R}
						stroke={withAlpha(c.brandInk, 0.3)}
						strokeWidth={1.5}
						strokeDasharray="16 10"
						strokeLinecap="round"
						fill="none"
					/>
				</Svg>
			</Turning>
			<Turning ms={ORBIT_TURN_MS} still={still}>
				{[0, 120, 240].map((angle, i) => (
					<View
						key={angle}
						style={[
							s.orbiter,
							{
								left: PORTAL / 2 + ORBIT_R * Math.cos((angle * Math.PI) / 180) - 6,
								top: PORTAL / 2 + ORBIT_R * Math.sin((angle * Math.PI) / 180) - 6
							}
						]}
					>
						<Sparkle size={12 - i * 2} strokeWidth={2} color={c.brandInk} fill={c.brandInk} />
					</View>
				))}
			</Turning>
			<Core still={still} />
		</View>
	)
}

/** Its children, turning round the portal's centre forever. */
function Turning({
	ms,
	reverse = false,
	still,
	children
}: {
	ms: number
	reverse?: boolean
	still: boolean
	children: React.ReactNode
}) {
	const turn = useSharedValue(0)
	useEffect(() => {
		if (still) return
		// Linear on purpose: an eased turn would stall once a lap.
		turn.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1)
		return () => cancelAnimation(turn)
	}, [turn, ms, still])
	const style = useAnimatedStyle(() => ({
		transform: [{ rotate: `${(reverse ? -360 : 360) * turn.value}deg` }]
	}))
	return <Animated.View style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>
}

/** The portal's heart: a warm disc breathing, with a paw in it. */
function Core({ still }: { still: boolean }) {
	const { colors: c } = useTheme()
	const breath = useSharedValue(0.5)
	useEffect(() => {
		if (still) return
		const half = { duration: BREATH_MS, easing: Easings.inOut }
		breath.value = withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1)
		return () => cancelAnimation(breath)
	}, [breath, still])
	const disc = useAnimatedStyle(() => ({
		opacity: 0.55 + breath.value * 0.45,
		transform: [{ scale: 0.92 + breath.value * 0.1 }]
	}))
	const paw = useAnimatedStyle(() => ({
		opacity: 0.6 + breath.value * 0.4,
		transform: [{ scale: 0.95 + breath.value * 0.08 }]
	}))
	return (
		<View style={s.center} pointerEvents="none">
			<Animated.View style={[s.core, { borderColor: c.brandBorder }, disc]}>
				<LinearGradient
					colors={[withAlpha(c.brandFill, 0.35), withAlpha(c.brandFill, 0.05)]}
					start={{ x: 0.5, y: 0 }}
					end={{ x: 0.5, y: 1 }}
					style={[StyleSheet.absoluteFill, s.round]}
				/>
			</Animated.View>
			<Animated.View style={[s.paw, paw]}>
				<PawPrint size={34} strokeWidth={2} color={c.brandInk} />
			</Animated.View>
		</View>
	)
}

/** A speck of light rising into the portal and fading, again and again. */
function Dust({ x, delay, size }: { x: number; delay: number; size: number }) {
	const { colors: c } = useTheme()
	const t = useSharedValue(0)
	useEffect(() => {
		t.value = withDelay(
			delay,
			withRepeat(withTiming(1, { duration: DUST_RISE_MS, easing: Easings.out }), -1)
		)
		return () => cancelAnimation(t)
	}, [t, delay])
	const style = useAnimatedStyle(() => ({
		opacity: Math.sin(t.value * Math.PI) * 0.9,
		transform: [{ translateY: -DUST_RISE * t.value }, { scale: 1 - t.value * 0.5 }]
	}))
	return (
		<Animated.View
			pointerEvents="none"
			style={[
				s.dust,
				{
					left: `${x * 100}%`,
					width: size,
					height: size,
					borderRadius: size / 2,
					backgroundColor: c.brandInk
				},
				style
			]}
		/>
	)
}

/** What the photo is read for, in order: done, the one being read, then the rest. */
const STEPS = [
	{ label: 'Fur', reading: 'Looking at the fur…' },
	{ label: 'Markings', reading: 'Finding the markings…' },
	{ label: 'Eyes', reading: 'Matching the eyes…' },
	{ label: 'Ears and tail', reading: 'Shaping the ears and tail…' }
] as const
/** How long each step shows as being read before the next. The last waits for the answer. */
const STEP_MS = 1_500

/**
 * The reading, step by step, under the portal: each part of the pet ticks off in turn, and the
 * last stays in progress until the answer comes (`finished` ticks them all). Paced, not measured:
 * the model reads the photo in one go. Read out as each step starts.
 */
export function ReadingSteps({ finished }: { finished: boolean }) {
	const { colors: c, radii } = useTheme()
	const [current, setCurrent] = useState(0)
	useEffect(() => {
		if (finished || current >= STEPS.length - 1) return
		const id = setTimeout(() => setCurrent((i) => i + 1), STEP_MS)
		return () => clearTimeout(id)
	}, [current, finished])
	const active = finished ? STEPS.length : current
	return (
		<View
			style={[
				s.steps,
				{ backgroundColor: c.surface2, borderColor: c.borderHairline, borderRadius: radii.card }
			]}
			accessible
			accessibilityLiveRegion="polite"
			accessibilityLabel={finished ? 'Drawing your pet' : STEPS[active]!.reading}
		>
			{STEPS.map((step, i) => (
				<View key={step.label} style={s.step}>
					<StepMark state={i < active ? 'done' : i === active ? 'reading' : 'waiting'} />
					<Animated.View
						key={i === active ? 'reading' : 'idle'}
						entering={FadeIn.duration(Durations.base).reduceMotion(ReduceMotion.System)}
					>
						<Text
							variant="bodySm"
							tone={i < active ? 'secondary' : i === active ? 'primary' : 'tertiary'}
						>
							{i === active ? step.reading : step.label}
						</Text>
					</Animated.View>
				</View>
			))}
		</View>
	)
}

const MARK = 22

function StepMark({ state }: { state: 'done' | 'reading' | 'waiting' }) {
	const { colors: c } = useTheme()
	if (state === 'done') {
		return (
			<Animated.View entering={ZoomIn.springify().reduceMotion(ReduceMotion.System)} style={s.mark}>
				<LinearGradient
					colors={c.brandGradient}
					start={{ x: 0, y: 0 }}
					end={{ x: 1, y: 1 }}
					style={[StyleSheet.absoluteFill, s.mark]}
				/>
				<Check size={13} strokeWidth={3} color={c.onBrand} />
			</Animated.View>
		)
	}
	if (state === 'reading') return <Spinner />
	return <View style={[s.mark, s.waiting, { borderColor: c.borderActive }]} />
}

/** A small arc turning, in the brand ink: the step being read. A still ring under Reduce Motion. */
function Spinner() {
	const { colors: c } = useTheme()
	const still = useReducedMotion()
	const turn = useSharedValue(0)
	useEffect(() => {
		if (still) return
		turn.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1)
		return () => cancelAnimation(turn)
	}, [turn, still])
	const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }))
	const r = MARK / 2 - 2
	return (
		<Animated.View style={[s.mark, style]}>
			<Svg width={MARK} height={MARK}>
				<Circle
					cx={MARK / 2}
					cy={MARK / 2}
					r={r}
					stroke={c.brandDim}
					strokeWidth={2.5}
					fill="none"
				/>
				<Circle
					cx={MARK / 2}
					cy={MARK / 2}
					r={r}
					stroke={c.brandInk}
					strokeWidth={2.5}
					strokeDasharray={`${Math.PI * r * 0.6} ${Math.PI * r * 2}`}
					strokeLinecap="round"
					fill="none"
				/>
			</Svg>
		</Animated.View>
	)
}

const s = StyleSheet.create({
	portal: { width: PORTAL, height: PORTAL, marginBottom: 30 },
	orbiter: { position: 'absolute' },
	center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
	core: {
		width: CORE,
		height: CORE,
		borderRadius: CORE / 2,
		borderWidth: StyleSheet.hairlineWidth
	},
	paw: { position: 'absolute' },
	round: { borderRadius: CORE / 2 },
	dust: { position: 'absolute', bottom: 0 },
	steps: { borderWidth: StyleSheet.hairlineWidth, paddingVertical: 8, paddingHorizontal: 16 },
	step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
	mark: {
		width: MARK,
		height: MARK,
		borderRadius: MARK / 2,
		alignItems: 'center',
		justifyContent: 'center'
	},
	waiting: { borderWidth: 1.5 }
})
