import { useEffect, useState } from 'react'
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withTiming
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useColors } from '@/contexts/ThemeContext'
import { Easings } from '@/lib/motion'

/** Width of the light band that sweeps across. */
const BAND = 90
/** One sweep, ms. */
const SWEEP = 1100

/**
 * A placeholder block that reserves the EXACT size of what will replace it
 * (so nothing jumps when data lands), with a highlight sweeping across its
 * measured width. Under Reduce Motion the block is still.
 */
export function Skeleton({
	width = '100%',
	height,
	radius = 8,
	style
}: {
	width?: DimensionValue
	height: number
	radius?: number
	style?: StyleProp<ViewStyle>
}) {
	const c = useColors()
	const reduceMotion = useReducedMotion()
	const x = useSharedValue(0)
	const [track, setTrack] = useState(0)

	useEffect(() => {
		if (reduceMotion) return
		x.value = withRepeat(withTiming(1, { duration: SWEEP, easing: Easings.inOut }), -1, false)
	}, [x, reduceMotion])

	const sweep = useAnimatedStyle(() => ({
		transform: [{ translateX: x.value * (track + BAND) - BAND }]
	}))

	return (
		<View
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			onLayout={(e) => setTrack(e.nativeEvent.layout.width)}
			style={[
				{ width, height, borderRadius: radius, backgroundColor: c.shimmer, overflow: 'hidden' },
				style
			]}
		>
			{reduceMotion ? null : (
				<Animated.View style={[s.band, sweep]}>
					<LinearGradient
						colors={[c.bgFade, c.shimmerSweep, c.bgFade]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 0 }}
						style={StyleSheet.absoluteFill}
					/>
				</Animated.View>
			)}
		</View>
	)
}

const s = StyleSheet.create({
	band: { position: 'absolute', top: 0, bottom: 0, width: BAND }
})
