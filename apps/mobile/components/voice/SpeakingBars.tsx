import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming
} from 'react-native-reanimated'
import { Volume2 } from 'lucide-react-native'
import { useColors } from '@/contexts/ThemeContext'
import { Easings, useReducedMotion } from '@/lib/motion'

/** Three bars rising and falling like a voice: 3pt wide, up to 14pt tall. */
const BAR_WIDTH = 3
const BAR_HEIGHT = 14
const LOOP_MS = 700
const STAGGER_MS = 140
const LOW = 0.35

function Bar({ index, color }: { index: number; color: string }) {
	const level = useSharedValue(LOW)

	useEffect(() => {
		const half = { duration: LOOP_MS / 2, easing: Easings.inOut }
		level.value = withDelay(
			index * STAGGER_MS,
			withRepeat(withSequence(withTiming(1, half), withTiming(LOW, half)), -1)
		)
		return () => cancelAnimation(level)
	}, [index, level])

	const style = useAnimatedStyle(() => ({ transform: [{ scaleY: level.value }] }))

	return <Animated.View style={[s.bar, { backgroundColor: color }, style]} />
}

/**
 * The pet speaking out loud (v2 voice): three bars moving like a voice, in the brand's ink. Reduce
 * Motion shows a still speaker instead. Announced as "{name} is speaking". `color` overrides the
 * ink (the bubble's speaking badge draws them on the brand fill).
 */
export function SpeakingBars({
	name,
	size = BAR_HEIGHT,
	color
}: {
	name: string
	size?: number
	color?: string
}) {
	const c = useColors()
	const ink = color ?? c.brandInk
	const still = useReducedMotion()
	return (
		<View style={[s.row, { height: size }]} accessible accessibilityLabel={`${name} is speaking`}>
			{still ? (
				<Volume2 size={size} color={ink} strokeWidth={2} />
			) : (
				[0, 1, 2].map((index) => <Bar key={index} index={index} color={ink} />)
			)}
		</View>
	)
}

const s = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
	bar: { width: BAR_WIDTH, height: BAR_HEIGHT, borderRadius: BAR_WIDTH / 2 }
})
