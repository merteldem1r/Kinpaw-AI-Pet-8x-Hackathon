import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import * as SplashScreen from 'expo-splash-screen'
import Animated, {
	runOnJS,
	useAnimatedProps,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withSpring,
	withTiming,
	type SharedValue
} from 'react-native-reanimated'
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg'
import { art } from '@app/brand'
import { RoomGlow } from '@/components/pet/RoomGlow'
import { Text } from '@/components/ui/Text'
import { APP_NAME } from '@/lib/constants'
import { Easings, Springs } from '@/lib/motion'

/** The native splash draws the mark 200 pt wide, centred (app.json, expo-splash-screen). */
const MARK = 200
/** The mark's art box (assets/icon/source/splash.svg's viewBox). */
const VIEW_BOX = '162 200 700 700'

/** When things happen, ms from the moment the scene is on screen. */
const STARS_IN_MS = 350
const EYES_OPEN_AT = 420
const EYES_OPEN_MS = 260
const BLINK_AT = 950
/** The name rises in letter by letter after the eyes open. */
const NAME_AT = 620
const NAME_MS = 700
/** The gap between the face and the name, pt. */
const NAME_GAP = 22
/** The name's size, pt, and where it turns gold: "Kin" in white, "paw" in the face's gold. */
const NAME_SIZE = 46
const GOLD_FROM = APP_NAME.toLowerCase().endsWith('paw') ? APP_NAME.length - 3 : 0
const LEAVE_AT = 1750
const LEAVE_MS = 380

/** Stars around the mark, as shares of the screen, with a size and a twinkle offset. */
const STARS: { x: number; y: number; r: number; delay: number }[] = [
	{ x: 0.14, y: 0.18, r: 1.6, delay: 0 },
	{ x: 0.82, y: 0.14, r: 1.3, delay: 300 },
	{ x: 0.3, y: 0.3, r: 1.1, delay: 600 },
	{ x: 0.72, y: 0.32, r: 1.7, delay: 150 },
	{ x: 0.1, y: 0.62, r: 1.2, delay: 450 },
	{ x: 0.88, y: 0.58, r: 1.4, delay: 700 },
	{ x: 0.24, y: 0.78, r: 1.5, delay: 250 },
	{ x: 0.66, y: 0.84, r: 1.1, delay: 550 },
	{ x: 0.5, y: 0.1, r: 1.2, delay: 400 },
	{ x: 0.92, y: 0.86, r: 1.3, delay: 100 }
]

/** The eyes, in the art box: where each sits and how big it opens. */
const EYES = [418, 606] as const
const EYE_Y = 606
const EYE_RX = 30
const EYE_RY = 36

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedG = Animated.createAnimatedComponent(G)

/**
 * The launch: an exact copy of the native splash (the sleeping moon face on the
 * midnight ground) takes over from it the moment it is drawn, so the hand-over
 * can't be seen, then wakes up. Stars fade in and twinkle, a warm glow rises
 * behind the face, its eyes open, it blinks and bounces, and the scene swells
 * and fades into the app (`onDone`). Under Reduce Motion the eyes are open at
 * once and it fades quickly. Decorative: VoiceOver skips it.
 */
export function LaunchScene({ onDone }: { onDone: () => void }) {
	const reduceMotion = useReducedMotion()
	const stars = useSharedValue(0)
	const open = useSharedValue(0)
	const bounce = useSharedValue(0)
	const leave = useSharedValue(0)
	const word = useSharedValue(0)

	const started = useRef(false)

	function start() {
		if (started.current) return
		started.current = true
		// The copy is on screen: the native splash can go, nothing changes to the eye.
		SplashScreen.hideAsync().catch(() => {})
		if (reduceMotion) {
			open.value = 1
			word.value = 1
			leave.value = withDelay(
				300,
				withTiming(1, { duration: 250 }, (done) => {
					if (done) runOnJS(onDone)()
				})
			)
			return
		}
		stars.value = withTiming(1, { duration: STARS_IN_MS, easing: Easings.out })
		word.value = withDelay(NAME_AT, withTiming(1, { duration: NAME_MS, easing: Easings.out }))
		open.value = withSequence(
			withDelay(EYES_OPEN_AT, withTiming(1, { duration: EYES_OPEN_MS, easing: Easings.out })),
			withDelay(
				BLINK_AT - EYES_OPEN_AT - EYES_OPEN_MS,
				withSequence(withTiming(0.05, { duration: 70 }), withTiming(1, { duration: 120 }))
			)
		)
		bounce.value = withDelay(
			EYES_OPEN_AT + 80,
			withSequence(
				withTiming(1, { duration: 160, easing: Easings.out }),
				withSpring(0, Springs.settle)
			)
		)
		leave.value = withDelay(
			LEAVE_AT,
			withTiming(1, { duration: LEAVE_MS, easing: Easings.in }, (done) => {
				if (done) runOnJS(onDone)()
			})
		)
	}

	const sceneStyle = useAnimatedStyle(() => ({ opacity: 1 - leave.value }))
	const markStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateY: -bounce.value * 10 },
			{ scale: 1 + bounce.value * 0.04 + leave.value * 0.18 }
		]
	}))
	const glowStyle = useAnimatedStyle(() => ({ opacity: stars.value }))
	const lids = useAnimatedProps(() => ({ opacity: open.value < 0.3 ? 1 : 0 }))

	return (
		<Animated.View
			pointerEvents="none"
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
			style={[StyleSheet.absoluteFill, s.scene, { backgroundColor: art.mark.ground }, sceneStyle]}
			onLayout={start}
		>
			{STARS.map((star, i) => (
				<Star key={i} {...star} visible={stars} still={reduceMotion} />
			))}
			<Animated.View style={[s.glow, glowStyle]}>
				<RoomGlow size={MARK * 2.2} />
			</Animated.View>
			<Animated.View style={markStyle}>
				<Svg width={MARK} height={MARK} viewBox={VIEW_BOX}>
					<Path
						d="M 306 410 L 316 256 L 416 328 Z M 718 410 L 708 256 L 608 328 Z"
						fill={art.mark.face}
						stroke={art.mark.face}
						strokeWidth={40}
						strokeLinejoin="round"
					/>
					<Circle cx={512} cy={584} r={270} fill={art.mark.face} />
					<G fill={art.mark.crater} opacity={0.6}>
						<Circle cx={648} cy={476} r={30} />
						<Circle cx={390} cy={716} r={20} />
						<Circle cx={622} cy={752} r={15} />
					</G>
					{/* Asleep: the closed lids, as the native splash draws them. */}
					<AnimatedG
						fill="none"
						stroke={art.mark.ink}
						strokeWidth={22}
						strokeLinecap="round"
						animatedProps={lids}
					>
						<Path d="M 366 600 Q 418 648 470 600" />
						<Path d="M 554 600 Q 606 648 658 600" />
					</AnimatedG>
					{EYES.map((cx) => (
						<OpenEye key={cx} cx={cx} open={open} />
					))}
				</Svg>
			</Animated.View>
			<View style={s.name}>
				{Array.from(APP_NAME).map((letter, i, all) => (
					<Letter
						key={i}
						letter={letter}
						index={i}
						count={all.length}
						color={i < GOLD_FROM ? art.star : art.mark.face}
						word={word}
					/>
				))}
			</View>
		</Animated.View>
	)
}

/** One letter of the name: it rises 12 pt and fades in, a beat after the one before. */
function Letter({
	letter,
	index,
	count,
	color,
	word
}: {
	letter: string
	index: number
	count: number
	color: string
	word: SharedValue<number>
}) {
	const style = useAnimatedStyle(() => {
		// Each letter takes the first part of the run after its predecessors have started.
		const local = Math.max(0, Math.min(1, word.value * (count + 2) - index))
		return { opacity: local, transform: [{ translateY: (1 - local) * 12 }] }
	})
	return (
		<Animated.View style={style}>
			<Text variant="display" style={[s.letter, { color }]} maxFontSizeMultiplier={1}>
				{letter}
			</Text>
		</Animated.View>
	)
}

/** One open eye: an ink oval with a glint, opening top to bottom with `open`. */
function OpenEye({ cx, open }: { cx: number; open: SharedValue<number> }) {
	const eye = useAnimatedProps(() => ({
		ry: Math.max(0.01, open.value) * EYE_RY,
		opacity: open.value < 0.3 ? 0 : 1
	}))
	const glint = useAnimatedProps(() => ({ opacity: open.value > 0.7 ? 1 : 0 }))
	return (
		<>
			<AnimatedEllipse
				cx={cx}
				cy={EYE_Y}
				rx={EYE_RX}
				ry={0}
				fill={art.mark.ink}
				animatedProps={eye}
			/>
			<AnimatedCircle cx={cx + 10} cy={EYE_Y - 13} r={9} fill={art.star} animatedProps={glint} />
		</>
	)
}

function Star({
	x,
	y,
	r,
	delay,
	visible,
	still
}: {
	x: number
	y: number
	r: number
	delay: number
	visible: SharedValue<number>
	still: boolean
}) {
	const twinkle = useSharedValue(1)
	useEffect(() => {
		if (still) return
		twinkle.value = withDelay(
			delay,
			withRepeat(
				withSequence(withTiming(0.3, { duration: 500 }), withTiming(1, { duration: 500 })),
				-1,
				false
			)
		)
	}, [twinkle, delay, still])
	const style = useAnimatedStyle(() => ({ opacity: visible.value * twinkle.value * 0.9 }))
	return (
		<Animated.View
			style={[
				s.star,
				{
					left: `${x * 100}%`,
					top: `${y * 100}%`,
					width: r * 2,
					height: r * 2,
					borderRadius: r,
					backgroundColor: art.star
				},
				style
			]}
		/>
	)
}

const s = StyleSheet.create({
	scene: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
	// Below the face, without moving it: the face stays exactly where the native splash drew it.
	name: {
		position: 'absolute',
		top: '50%',
		marginTop: MARK / 2 + NAME_GAP,
		flexDirection: 'row'
	},
	letter: { fontSize: NAME_SIZE, lineHeight: NAME_SIZE * 1.15, letterSpacing: 0.5 },
	glow: { position: 'absolute' },
	star: { position: 'absolute' }
})
