import { useEffect, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, {
	cancelAnimation,
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useColors } from '@/contexts/ThemeContext'
import { Easings, useReducedMotion } from '@/lib/motion'

/** The pet's voice, as the bubble shows it: on its way, or playing. */
export type BubbleVoice = 'preparing' | 'speaking'

/** The ring's width, pt. */
const RING = 1.5
/** One lap of the light around the bubble while the voice is on its way. */
const LAP_MS = 1_400
/** One breath of the glow while the pet speaks. */
const BREATH_MS = 1_100
/** How far the glow reaches past the bubble's edge, pt. */
const GLOW_SPREAD = 5

export type RingCorners = {
	borderRadius: number
	borderBottomLeftRadius: number
}

/**
 * The bubble's edge while the pet has a voice for its line (v2 voice). `preparing`: a light runs
 * around the edge while the voice is fetched, so the wait after the text reads as "about to
 * speak". `speaking`: the edge turns the brand gradient and a soft glow breathes around it.
 * Sits behind the bubble's content, filling it (the bubble draws no fill of its own then).
 * Reduce Motion keeps the ring still: dim while preparing, the gradient while speaking.
 */
export function VoiceRing({ voice, corners }: { voice: BubbleVoice; corners: RingCorners }) {
	const c = useColors()
	const still = useReducedMotion()
	const [size, setSize] = useState<{ width: number; height: number } | null>(null)
	const turn = useSharedValue(0)
	const breath = useSharedValue(0)

	useEffect(() => {
		if (still || voice !== 'preparing') return
		turn.value = 0
		// Linear on purpose: an eased lap would stall at the end of every turn.
		turn.value = withRepeat(withTiming(1, { duration: LAP_MS, easing: Easing.linear }), -1)
		return () => cancelAnimation(turn)
	}, [still, voice, turn])

	useEffect(() => {
		if (still || voice !== 'speaking') {
			breath.value = withTiming(0, { duration: 200 })
			return
		}
		const half = { duration: BREATH_MS / 2, easing: Easings.inOut }
		breath.value = withRepeat(withSequence(withTiming(1, half), withTiming(0.35, half)), -1)
		return () => cancelAnimation(breath)
	}, [still, voice, breath])

	const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }))
	const glow = useAnimatedStyle(() => ({ opacity: breath.value }))

	function onLayout(e: LayoutChangeEvent) {
		const { width, height } = e.nativeEvent.layout
		setSize((prev) => (prev?.width === width && prev.height === height ? prev : { width, height }))
	}

	// A square that covers the bubble at every angle as it turns.
	const sweep = size ? Math.ceil(Math.hypot(size.width, size.height)) : 0
	const inner = {
		borderRadius: Math.max(0, corners.borderRadius - RING),
		borderBottomLeftRadius: Math.max(0, corners.borderBottomLeftRadius - RING)
	}

	return (
		<View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
			{voice === 'speaking' ? (
				<Animated.View
					style={[
						s.glow,
						{
							borderRadius: corners.borderRadius + GLOW_SPREAD,
							borderBottomLeftRadius: corners.borderBottomLeftRadius + GLOW_SPREAD,
							backgroundColor: c.brandGlow,
							shadowColor: c.brandFill
						},
						still ? s.glowStill : glow
					]}
				/>
			) : null}
			<View style={[StyleSheet.absoluteFill, s.clip, corners, { backgroundColor: c.brandBorder }]}>
				{voice === 'speaking' ? (
					<LinearGradient
						colors={c.brandGradient}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={StyleSheet.absoluteFill}
					/>
				) : size && !still ? (
					<Animated.View
						style={[
							s.sweep,
							{
								width: sweep,
								height: sweep,
								left: (size.width - sweep) / 2,
								top: (size.height - sweep) / 2
							},
							spin
						]}
					>
						{/* Clear across most of the square, then the light: one bright side of the turn. */}
						<LinearGradient
							colors={['transparent', 'transparent', c.brandFill, c.brandInk]}
							locations={[0, 0.55, 0.85, 1]}
							style={StyleSheet.absoluteFill}
						/>
					</Animated.View>
				) : null}
				<View style={[s.fill, inner, { backgroundColor: c.surface2 }]} />
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	glow: {
		position: 'absolute',
		top: -GLOW_SPREAD,
		right: -GLOW_SPREAD,
		bottom: -GLOW_SPREAD,
		left: -GLOW_SPREAD,
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0.6,
		shadowRadius: 14
	},
	glowStill: { opacity: 0.6 },
	clip: { overflow: 'hidden' },
	sweep: { position: 'absolute' },
	fill: { position: 'absolute', top: RING, right: RING, bottom: RING, left: RING }
})
