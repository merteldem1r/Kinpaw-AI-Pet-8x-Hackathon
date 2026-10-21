import { StyleSheet, View } from 'react-native'
import Animated, {
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming
} from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import { useEffect } from 'react'
import { art } from '@app/brand'
import { Easings } from '@/lib/motion'

/** How strong the glow is at its heart, and how far its flicker dips. */
const GLOW_OPACITY = 0.3
const FLICKER_LOW = 0.82
const FLICKER_HALF_MS = 2600

/**
 * A warm lamp glow in the room behind the pet, in the evening and at night: a
 * soft round light that fades to nothing, flickering very slightly like a real
 * bulb. `size` is the glow's diameter, centred where it is placed.
 */
export function RoomGlow({ size }: { size: number }) {
	const reduceMotion = useReducedMotion()
	const level = useSharedValue(1)
	useEffect(() => {
		if (reduceMotion) return
		const ease = { duration: FLICKER_HALF_MS, easing: Easings.inOut }
		level.value = withRepeat(
			withSequence(withTiming(FLICKER_LOW, ease), withTiming(1, ease)),
			-1,
			false
		)
	}, [level, reduceMotion])
	const style = useAnimatedStyle(() => ({ opacity: level.value }))
	const r = size / 2
	return (
		<View pointerEvents="none" style={{ width: size, height: size }}>
			<Animated.View style={[StyleSheet.absoluteFill, style]}>
				<Svg width={size} height={size}>
					<Defs>
						<RadialGradient id="lamp" cx="50%" cy="50%" r="50%">
							<Stop offset="0" stopColor={art.lamp} stopOpacity={GLOW_OPACITY} />
							<Stop offset="0.55" stopColor={art.lamp} stopOpacity={GLOW_OPACITY * 0.35} />
							<Stop offset="1" stopColor={art.lamp} stopOpacity={0} />
						</RadialGradient>
					</Defs>
					<Circle cx={r} cy={r} r={r} fill="url(#lamp)" />
				</Svg>
			</Animated.View>
		</View>
	)
}
