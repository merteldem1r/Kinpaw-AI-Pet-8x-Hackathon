import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	Easing,
	runOnJS,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated'
import Svg, { Circle, G, Line, Path } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { art, withAlpha, type SkyPhase } from '@app/brand'
import { useMountEffect } from '@/hooks/useMountEffect'
import { Easings, Springs } from '@/lib/motion'
import { moonPath, moonPhaseAt } from '@/lib/sky'

/**
 * What is in the sky at each part of day: the sun low on the left in the
 * morning, high on the right in the afternoon, setting in the evening; the
 * crescent moon at night; clouds by day, thin ones in the evening; stars in the
 * evening and at night (docs/application/UI/kinpaw-screen-spec-v1.md, "Home" →
 * SkyBand). Positions are fractions of the width and points from the top.
 *
 * Ambient motion, all in-out: stars twinkle (25–100%, 3.2 s, staggered), the
 * moon bobs 2 pt over 6 s, sun rays breathe (50–100%, 4 s), clouds drift ±6 pt
 * over 18 s. The moon shows tonight's real phase.
 *
 * Life in the sky: light motes rise in the morning, birds cross in the
 * afternoon, fireflies glow low at dusk (fewer at night), and now and then a
 * shooting star at night. `poke` changing makes the sun or moon answer a tap.
 * Under Reduce Motion everything holds still and the sky life is not drawn.
 */

const SUN_RADIUS = 20
const RAY_FROM = 28
const RAY_TO = 36
const MOON_RADIUS = 23
const TWINKLE_MS = 1600
const BOB_MS = 3000
const RAYS_MS = 2000
const DRIFT_MS = 9000
const DRIFT = 6
/** The moon's unlit part, faintly there (earthshine). */
const EARTHSHINE = 0.14
/** A shooting star now and then at night, ms apart. */
const SHOOTING_EVERY: [number, number] = [20000, 60000]
const SHOOTING_MS = 850
const STREAK = 70
/** Birds cross the afternoon sky every so often, ms apart, each flight this long. */
const BIRDS_EVERY: [number, number] = [8000, 18000]
const FLIGHT_MS = 9000
const FLAP_MS = 170

export type Point = { x: number; y: number }
type Star = Point & { r: number }

const NIGHT_STARS: Star[] = [
	{ x: 0.11, y: 44, r: 1.6 },
	{ x: 0.38, y: 30, r: 1.1 },
	{ x: 0.58, y: 62, r: 1.3 },
	{ x: 0.95, y: 58, r: 1.6 },
	{ x: 0.18, y: 112, r: 1.1 },
	{ x: 0.7, y: 92, r: 1.2 },
	{ x: 0.08, y: 170, r: 1.2 },
	{ x: 0.51, y: 150, r: 1.4 },
	{ x: 0.28, y: 205, r: 1.3 },
	{ x: 0.92, y: 196, r: 1.1 }
]
const EVENING_STARS: Star[] = NIGHT_STARS.slice(0, 6)

const SCENE: Record<
	SkyPhase,
	{
		sun?: Point
		moon?: Point
		clouds: (Point & { scale: number })[]
		cloudOpacity: number
		stars: Star[]
		starOpacity: number
	}
> = {
	morning: {
		sun: { x: 0.18, y: 222 },
		clouds: [
			{ x: 0.62, y: 132, scale: 1.1 },
			{ x: 0.2, y: 112, scale: 0.85 }
		],
		cloudOpacity: 0.95,
		stars: [],
		starOpacity: 0
	},
	afternoon: {
		sun: { x: 0.81, y: 98 },
		clouds: [
			{ x: 0.62, y: 150, scale: 1.1 },
			{ x: 0.17, y: 196, scale: 0.85 }
		],
		cloudOpacity: 0.95,
		stars: [],
		starOpacity: 0
	},
	evening: {
		sun: { x: 0.16, y: 300 },
		clouds: [
			{ x: 0.62, y: 136, scale: 1.1 },
			{ x: 0.17, y: 196, scale: 0.85 }
		],
		cloudOpacity: 0.4,
		stars: EVENING_STARS,
		starOpacity: 0.5
	},
	night: {
		moon: { x: 0.17, y: 212 },
		clouds: [],
		cloudOpacity: 0,
		stars: NIGHT_STARS,
		starOpacity: 0.9
	}
}

/** Where the sun or moon is at a phase (a fraction of the width, pt from the top), and its size. */
export function skyBodyAt(phase: SkyPhase): Point & { r: number } {
	const scene = SCENE[phase]
	if (scene.moon) return { ...scene.moon, r: MOON_RADIUS }
	return { ...scene.sun!, r: SUN_RADIUS }
}

const between = (low: number, high: number) => low + Math.random() * (high - low)

/** The sky's life. Memoized: a builder tap or a care action never redraws it. */
export const SkyScene = memo(function SkyScene({
	phase,
	width,
	height,
	poke = 0,
	body
}: {
	phase: SkyPhase
	width: number
	/** The band's height: the low sky life (fireflies) sits near its bottom. */
	height: number
	/** Bumped when the sun or moon is tapped. */
	poke?: number
	/** Where the sun or moon sits instead of the phase's place (a smaller stage than Home's). */
	body?: Point
}) {
	const base = SCENE[phase]
	const scene = body
		? { ...base, sun: base.sun ? body : undefined, moon: base.moon ? body : undefined }
		: base
	const colour = art.sky[phase].body
	const reduceMotion = useReducedMotion()
	return (
		<View pointerEvents="none" style={StyleSheet.absoluteFill}>
			{scene.stars.map((star, i) => (
				<TwinklingStar key={i} star={star} width={width} index={i} max={scene.starOpacity} />
			))}
			{!reduceMotion && phase === 'morning' ? <Motes width={width} /> : null}
			{scene.sun ? <Sun at={scene.sun} width={width} colour={colour} poke={poke} /> : null}
			{scene.moon ? <Moon at={scene.moon} width={width} colour={colour} poke={poke} /> : null}
			{!reduceMotion && phase === 'night' ? <ShootingStars width={width} /> : null}
			{!reduceMotion && phase === 'afternoon' ? <Birds width={width} /> : null}
			{!reduceMotion && (phase === 'evening' || phase === 'night') ? (
				<Fireflies width={width} height={height} count={phase === 'evening' ? 6 : 3} />
			) : null}
			{scene.clouds.map((cloud, i) => (
				<DriftingCloud
					key={i}
					at={cloud}
					scale={cloud.scale}
					width={width}
					opacity={scene.cloudOpacity}
					index={i}
				/>
			))}
		</View>
	)
})

/** A value that eases between `from` and `to` forever, starting after `delay`. */
function useLoop(from: number, to: number, halfMs: number, delay = 0) {
	const reduceMotion = useReducedMotion()
	const value = useSharedValue(from)
	useEffect(() => {
		if (reduceMotion) return
		const ease = { duration: halfMs, easing: Easings.inOut }
		value.value = withDelay(
			delay,
			withRepeat(withSequence(withTiming(to, ease), withTiming(from, ease)), -1, false)
		)
	}, [value, from, to, halfMs, delay, reduceMotion])
	return value
}

function TwinklingStar({
	star,
	width,
	index,
	max
}: {
	star: Star
	width: number
	index: number
	max: number
}) {
	const level = useLoop(0.25, 1, TWINKLE_MS, (index * 370) % (TWINKLE_MS * 2))
	const style = useAnimatedStyle(() => ({ opacity: level.value * max }))
	const size = star.r * 2
	return (
		<Animated.View
			style={[
				s.star,
				{
					left: star.x * width - star.r,
					top: star.y - star.r,
					width: size,
					height: size,
					borderRadius: star.r,
					backgroundColor: art.star
				},
				style
			]}
		/>
	)
}

/** A tapped sun or moon: a bounce (the sun) or a wobble (the moon), on each new `poke`. */
function usePoke(poke: number) {
	const value = useSharedValue(0)
	const first = useRef(true)
	useEffect(() => {
		if (first.current) {
			first.current = false
			return
		}
		value.value = withSequence(withTiming(1, { duration: 140 }), withSpring(0, Springs.settle))
	}, [poke, value])
	return value
}

function Sun({
	at,
	width,
	colour,
	poke
}: {
	at: Point
	width: number
	colour: string
	poke: number
}) {
	const rays = useLoop(0.5, 1, RAYS_MS)
	const bounce = usePoke(poke)
	const raysStyle = useAnimatedStyle(() => ({
		opacity: Math.min(1, rays.value + bounce.value),
		transform: [{ scale: 1 + bounce.value * 0.3 }, { rotate: `${bounce.value * 22}deg` }]
	}))
	const bodyStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + bounce.value * 0.18 }] }))
	const box = RAY_TO * 2 + 4
	const c = box / 2
	return (
		<View style={[s.abs, { left: at.x * width - c, top: at.y - c, width: box, height: box }]}>
			<Animated.View style={[StyleSheet.absoluteFill, raysStyle]}>
				<Svg width={box} height={box}>
					<G stroke={colour} strokeWidth={2.4} strokeLinecap="round">
						{Array.from({ length: 8 }, (_, i) => {
							const a = (i * Math.PI) / 4
							return (
								<Line
									key={i}
									x1={c + Math.cos(a) * RAY_FROM}
									y1={c + Math.sin(a) * RAY_FROM}
									x2={c + Math.cos(a) * RAY_TO}
									y2={c + Math.sin(a) * RAY_TO}
								/>
							)
						})}
					</G>
				</Svg>
			</Animated.View>
			<Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
				<Svg width={box} height={box}>
					<Circle cx={c} cy={c} r={SUN_RADIUS} fill={colour} />
				</Svg>
			</Animated.View>
		</View>
	)
}

function Moon({
	at,
	width,
	colour,
	poke
}: {
	at: Point
	width: number
	colour: string
	poke: number
}) {
	const bob = useLoop(0, -2, BOB_MS)
	const wobble = usePoke(poke)
	const style = useAnimatedStyle(() => ({
		transform: [
			{ translateY: bob.value },
			{ rotate: `${Math.sin(wobble.value * Math.PI * 2) * 14}deg` },
			{ scale: 1 + wobble.value * 0.12 }
		]
	}))
	const box = MOON_RADIUS * 2
	// Tonight's phase; a screen left open over midnight keeps the evening's moon.
	const d = useMemo(() => moonPath(moonPhaseAt(new Date()), MOON_RADIUS), [])
	return (
		<Animated.View
			style={[
				s.abs,
				{ left: at.x * width - MOON_RADIUS, top: at.y - MOON_RADIUS, width: box, height: box },
				style
			]}
		>
			<Svg width={box} height={box}>
				<Circle
					cx={MOON_RADIUS}
					cy={MOON_RADIUS}
					r={MOON_RADIUS}
					fill={colour}
					opacity={EARTHSHINE}
				/>
				<Path d={d} fill={colour} />
			</Svg>
		</Animated.View>
	)
}

function DriftingCloud({
	at,
	scale,
	width,
	opacity,
	index
}: {
	at: Point
	scale: number
	width: number
	opacity: number
	index: number
}) {
	const drift = useLoop(-DRIFT, DRIFT, DRIFT_MS, index * 2500)
	const style = useAnimatedStyle(() => ({ transform: [{ translateX: drift.value }] }))
	const w = 56 * scale
	const h = 26 * scale
	return (
		<Animated.View
			style={[
				s.abs,
				{ left: at.x * width - w / 2, top: at.y - h / 2, width: w, height: h, opacity },
				style
			]}
		>
			<View
				style={[
					s.abs,
					{
						left: 0,
						bottom: 0,
						width: w,
						height: h * 0.62,
						borderRadius: h,
						backgroundColor: art.cloud
					}
				]}
			/>
			<View
				style={[
					s.abs,
					{
						left: w * 0.42,
						top: 0,
						width: h * 0.9,
						height: h * 0.9,
						borderRadius: h,
						backgroundColor: art.cloud
					}
				]}
			/>
		</Animated.View>
	)
}

// ─── Life in the sky ─────────────────────────────────────────────────────────

/** Calls `run` every so often, at random within `range`, while mounted. */
function useEvery([min, max]: [number, number], run: () => void) {
	const latest = useRef(run)
	latest.current = run
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout>
		const next = () => {
			timer = setTimeout(
				() => {
					latest.current()
					next()
				},
				between(min, max)
			)
		}
		next()
		return () => clearTimeout(timer)
	}, [min, max])
}

/** A streak across the upper night sky, now and then. */
function ShootingStars({ width }: { width: number }) {
	const [flight, setFlight] = useState<{ key: number; x: number; y: number } | null>(null)
	useEvery(SHOOTING_EVERY, () =>
		setFlight((f) => ({
			key: (f?.key ?? 0) + 1,
			x: between(0.45, 0.95) * width,
			y: between(20, 110)
		}))
	)
	if (!flight) return null
	return <ShootingStar key={flight.key} x={flight.x} y={flight.y} />
}

function ShootingStar({ x, y }: { x: number; y: number }) {
	const progress = useSharedValue(0)
	const dx = -160
	const dy = 75
	const angle = (Math.atan2(dy, dx) * 180) / Math.PI
	useEffect(() => {
		progress.value = withTiming(1, { duration: SHOOTING_MS, easing: Easing.in(Easing.quad) })
	}, [progress])
	const style = useAnimatedStyle(() => {
		const p = progress.value
		const len = Math.hypot(dx, dy)
		// The streak's centre trails its head by half its length.
		const cx = x + dx * p - (dx / len) * (STREAK / 2)
		const cy = y + dy * p - (dy / len) * (STREAK / 2)
		return {
			opacity: p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85,
			transform: [
				{ translateX: cx - STREAK / 2 },
				{ translateY: cy - 1 },
				{ rotate: `${angle}deg` }
			]
		}
	})
	return (
		<Animated.View style={[s.streak, style]}>
			<LinearGradient
				colors={[withAlpha(art.star, 0), art.star]}
				start={{ x: 0, y: 0.5 }}
				end={{ x: 1, y: 0.5 }}
				style={StyleSheet.absoluteFill}
			/>
		</Animated.View>
	)
}

/** Fireflies low in the sky at dusk: they wander a little and glow on and off. */
const FIREFLY_SPOTS: Point[] = [
	{ x: 0.08, y: 0.7 },
	{ x: 0.9, y: 0.66 },
	{ x: 0.22, y: 0.86 },
	{ x: 0.78, y: 0.84 },
	{ x: 0.14, y: 0.78 },
	{ x: 0.95, y: 0.9 }
]

function Fireflies({ width, height, count }: { width: number; height: number; count: number }) {
	return (
		<>
			{FIREFLY_SPOTS.slice(0, count).map((spot, i) => (
				<Firefly key={i} x={spot.x * width} y={spot.y * height} index={i} />
			))}
		</>
	)
}

function Firefly({ x, y, index }: { x: number; y: number; index: number }) {
	const wanderX = useLoop(-12, 12, 2600 + index * 430, index * 300)
	const wanderY = useLoop(-9, 9, 1900 + index * 370, index * 500)
	const glow = useLoop(0.05, 1, 1100 + index * 260, index * 700)
	const style = useAnimatedStyle(() => ({
		opacity: glow.value,
		transform: [{ translateX: wanderX.value }, { translateY: wanderY.value }]
	}))
	return (
		<Animated.View style={[s.abs, { left: x - 7, top: y - 7 }, style]}>
			<View style={[s.fireflyGlow, { backgroundColor: art.life.firefly }]} />
			<View style={[s.fireflyCore, { backgroundColor: art.life.firefly }]} />
		</Animated.View>
	)
}

/** Specks of light rising slowly through the morning sky, around the sun. */
const MOTE_SPOTS: (Point & { r: number; ms: number })[] = [
	{ x: 0.08, y: 270, r: 1.4, ms: 7000 },
	{ x: 0.26, y: 300, r: 1.1, ms: 8200 },
	{ x: 0.36, y: 250, r: 1.6, ms: 6400 },
	{ x: 0.14, y: 330, r: 1.2, ms: 9000 },
	{ x: 0.44, y: 320, r: 1.0, ms: 7600 },
	{ x: 0.3, y: 200, r: 1.3, ms: 8800 },
	{ x: 0.05, y: 190, r: 1.0, ms: 7300 }
]

function Motes({ width }: { width: number }) {
	return (
		<>
			{MOTE_SPOTS.map((mote, i) => (
				<Mote key={i} x={mote.x * width} y={mote.y} r={mote.r} ms={mote.ms} index={i} />
			))}
		</>
	)
}

function Mote({
	x,
	y,
	r,
	ms,
	index
}: {
	x: number
	y: number
	r: number
	ms: number
	index: number
}) {
	const rise = useSharedValue(0)
	useEffect(() => {
		rise.value = withDelay(
			index * 900,
			withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false)
		)
	}, [rise, ms, index])
	const style = useAnimatedStyle(() => {
		const p = rise.value
		return {
			opacity: (p < 0.5 ? p * 2 : (1 - p) * 2) * 0.8,
			transform: [{ translateY: -p * 46 }, { translateX: Math.sin(p * Math.PI * 2) * 6 }]
		}
	})
	return (
		<Animated.View
			style={[
				s.abs,
				{
					left: x - r,
					top: y - r,
					width: r * 2,
					height: r * 2,
					borderRadius: r,
					backgroundColor: art.life.mote
				},
				style
			]}
		/>
	)
}

/** A small flock crossing the afternoon sky now and then, one way or the other. */
function Birds({ width }: { width: number }) {
	const [flock, setFlock] = useState<{ key: number; y: number; rightward: boolean } | null>(null)
	useEvery(BIRDS_EVERY, () =>
		setFlock((f) => ({
			key: (f?.key ?? 0) + 1,
			y: between(40, 170),
			rightward: Math.random() < 0.5
		}))
	)
	if (!flock) return null
	return (
		<Flock
			key={flock.key}
			width={width}
			y={flock.y}
			rightward={flock.rightward}
			onDone={() => setFlock(null)}
		/>
	)
}

const FLOCK: { dx: number; dy: number; scale: number }[] = [
	{ dx: 0, dy: 0, scale: 1 },
	{ dx: -22, dy: 10, scale: 0.8 },
	{ dx: -40, dy: -6, scale: 0.7 }
]

function Flock({
	width,
	y,
	rightward,
	onDone
}: {
	width: number
	y: number
	rightward: boolean
	onDone: () => void
}) {
	const progress = useSharedValue(0)
	useMountEffect(() => {
		progress.value = withTiming(1, { duration: FLIGHT_MS, easing: Easing.linear }, (finished) => {
			if (finished) runOnJS(onDone)()
		})
	})
	const style = useAnimatedStyle(() => {
		const p = progress.value
		const from = rightward ? -60 : width + 60
		const to = rightward ? width + 60 : -60
		return {
			transform: [
				{ translateX: from + (to - from) * p },
				{ translateY: y + Math.sin(p * Math.PI * 3) * 8 },
				{ scaleX: rightward ? 1 : -1 }
			]
		}
	})
	return (
		<Animated.View style={[s.flock, style]}>
			{FLOCK.map((bird, i) => (
				<Bird key={i} dx={bird.dx} dy={bird.dy} scale={bird.scale} index={i} />
			))}
		</Animated.View>
	)
}

function Bird({ dx, dy, scale, index }: { dx: number; dy: number; scale: number; index: number }) {
	const flap = useLoop(1, 0.3, FLAP_MS, index * 60)
	const style = useAnimatedStyle(() => ({ transform: [{ scale }, { scaleY: flap.value }] }))
	return (
		<Animated.View style={[s.abs, { left: dx, top: dy }, style]}>
			<Svg width={18} height={8}>
				<Path
					d="M1 6 Q5 0 9 6 Q13 0 17 6"
					stroke={art.life.bird}
					strokeWidth={1.7}
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				/>
			</Svg>
		</Animated.View>
	)
}

const s = StyleSheet.create({
	abs: { position: 'absolute' },
	star: { position: 'absolute' },
	streak: {
		position: 'absolute',
		left: 0,
		top: 0,
		width: STREAK,
		height: 2,
		borderRadius: 1,
		overflow: 'hidden'
	},
	fireflyGlow: { position: 'absolute', width: 14, height: 14, borderRadius: 7, opacity: 0.3 },
	fireflyCore: { position: 'absolute', left: 5, top: 5, width: 4, height: 4, borderRadius: 2 },
	flock: { position: 'absolute', left: 0, top: 0, width: 18, height: 8 }
})
