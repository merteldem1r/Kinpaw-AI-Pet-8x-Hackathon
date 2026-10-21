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
import { PawPrint } from 'lucide-react-native'
import { useColors } from '@/contexts/ThemeContext'
import { Easings, useReducedMotion } from '@/lib/motion'

/** The spec's TypingPaws: three 14pt paws, each fading 30% → 100% and lifting 2pt. */
const PAW = 14
const LOOP_MS = 1200
const STAGGER_MS = 200
const LIFT = 2
const REST_OPACITY = 0.3
const STILL_OPACITY = 0.7

function Paw({ index, still }: { index: number; still: boolean }) {
	const c = useColors()
	const progress = useSharedValue(0)

	useEffect(() => {
		if (still) return
		const half = { duration: LOOP_MS / 2, easing: Easings.inOut }
		progress.value = withDelay(
			index * STAGGER_MS,
			withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1)
		)
		return () => cancelAnimation(progress)
	}, [index, progress, still])

	const style = useAnimatedStyle(() =>
		still
			? { opacity: STILL_OPACITY }
			: {
					opacity: REST_OPACITY + (1 - REST_OPACITY) * progress.value,
					transform: [{ translateY: -LIFT * progress.value }]
				}
	)

	return (
		<Animated.View style={style}>
			<PawPrint size={PAW} color={c.brandInk} strokeWidth={2} />
		</Animated.View>
	)
}

/**
 * The pet thinking of what to say, in its bubble while a reply is on its way. Reduce Motion
 * holds the paws still. Announced as "{name} is thinking".
 */
export function TypingPaws({ name }: { name: string }) {
	const still = useReducedMotion()
	return (
		<View
			style={s.row}
			accessible
			accessibilityLabel={`${name} is thinking`}
			accessibilityLiveRegion="polite"
		>
			{[0, 1, 2].map((index) => (
				<Paw key={index} index={index} still={still} />
			))}
		</View>
	)
}

const s = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 22 }
})
