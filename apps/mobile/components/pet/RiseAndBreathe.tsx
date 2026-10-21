import { type ReactNode } from 'react'
import type { StyleProp, ViewProps, ViewStyle } from 'react-native'
import Animated, {
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
import { useMountEffect } from '@/hooks/useMountEffect'
import { Easings, Springs } from '@/lib/motion'

/** How far a pet rises into place, pt. */
const RISE = 16
/** The breathing float, pt, and half its cycle (the spec's 4.4 s loop). */
const FLOAT = 4
const FLOAT_HALF_MS = 2200
/** When the breathing starts after the rise begins: roughly when the spring settles. */
const SETTLE_MS = 700

/**
 * A pet arriving and then living: it fades up 16 pt into place on the gentle
 * spring after `delay`, then floats 4 pt on a slow in-out loop. Give pets that
 * stand together different `breatheOffset`s so they never move in step
 * (docs/application/UI/kinpaw-screen-spec-v1.md, "Welcome" and "Meet Mochi").
 * Under Reduce Motion it is simply there, and still.
 */
export function RiseAndBreathe({
	delay = 0,
	breatheOffset = 0,
	breathe = true,
	onLanded,
	pointerEvents,
	style,
	children
}: {
	delay?: number
	breatheOffset?: number
	breathe?: boolean
	/** Called once, when the pet has risen into place (for the landing haptic). */
	onLanded?: () => void
	/** `box-none` where it overlaps a neighbour that should still get its own touches. */
	pointerEvents?: ViewProps['pointerEvents']
	style?: StyleProp<ViewStyle>
	children: ReactNode
}) {
	const reduceMotion = useReducedMotion()
	const rise = useSharedValue(reduceMotion ? 1 : 0)
	const float = useSharedValue(0)

	useMountEffect(() => {
		if (reduceMotion) {
			onLanded?.()
			return
		}
		rise.value = withDelay(
			delay,
			withSpring(1, Springs.gentle, (finished) => {
				if (finished && onLanded) runOnJS(onLanded)()
			})
		)
		if (breathe) {
			const ease = { duration: FLOAT_HALF_MS, easing: Easings.inOut }
			float.value = withDelay(
				delay + SETTLE_MS + breatheOffset,
				withRepeat(withSequence(withTiming(1, ease), withTiming(0, ease)), -1, false)
			)
		}
	})

	const animated = useAnimatedStyle(() => ({
		opacity: Math.min(1, rise.value * 1.4),
		transform: [{ translateY: (1 - rise.value) * RISE - float.value * FLOAT }]
	}))

	return (
		<Animated.View pointerEvents={pointerEvents} style={[style, animated]}>
			{children}
		</Animated.View>
	)
}
