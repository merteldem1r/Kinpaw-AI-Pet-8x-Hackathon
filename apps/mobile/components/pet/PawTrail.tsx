import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withTiming
} from 'react-native-reanimated'
import { PawPrint } from 'lucide-react-native'
import { useTheme } from '@/contexts/ThemeContext'
import { Easings } from '@/lib/motion'

const STEPS = 4
/** Between one print and the next, ms. */
const STEP_MS = 260
/** One print's fade in, hold and fade out, ms. */
const FADE_MS = 320
const HOLD_MS = 700
/** A whole walk, so every print restarts together and the trail never smears. */
const WALK_MS = STEPS * STEP_MS + FADE_MS * 2 + HOLD_MS

/**
 * Little paw prints walking left to right, one after another, on a loop: the
 * pet on its way home while sign-in saves it. Decorative. Under Reduce Motion
 * the prints stand still, all shown.
 */
export function PawTrail({ size = 16 }: { size?: number }) {
	const reduceMotion = useReducedMotion()
	return (
		<View
			style={s.trail}
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
		>
			{Array.from({ length: STEPS }, (_, i) => (
				<Print key={i} index={i} size={size} still={reduceMotion} />
			))}
		</View>
	)
}

function Print({ index, size, still }: { index: number; size: number; still: boolean }) {
	const { colors: c } = useTheme()
	const opacity = useSharedValue(still ? 1 : 0)

	useEffect(() => {
		if (still) {
			opacity.value = 1
			return
		}
		const before = index * STEP_MS
		const after = WALK_MS - before - FADE_MS * 2 - HOLD_MS
		opacity.value = withRepeat(
			withSequence(
				withDelay(before, withTiming(1, { duration: FADE_MS, easing: Easings.out })),
				withDelay(HOLD_MS, withTiming(0, { duration: FADE_MS, easing: Easings.out })),
				withTiming(0, { duration: Math.max(0, after) })
			),
			-1,
			false
		)
	}, [index, opacity, still])

	const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
	// Footsteps: left and right alternate, a little up and down, turned along the walk.
	const left = index % 2 === 0
	return (
		<Animated.View
			style={[
				{ transform: [{ translateY: left ? -3 : 3 }, { rotate: left ? '78deg' : '102deg' }] },
				style
			]}
		>
			<PawPrint size={size} color={c.brandInk} strokeWidth={2} />
		</Animated.View>
	)
}

const s = StyleSheet.create({
	trail: { flexDirection: 'row', alignItems: 'center', gap: 4 }
})
