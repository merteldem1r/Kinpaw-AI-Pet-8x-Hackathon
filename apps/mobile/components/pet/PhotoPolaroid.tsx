import { useEffect, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming
} from 'react-native-reanimated'
import { art, withAlpha } from '@app/brand'
import { useTheme } from '@/contexts/ThemeContext'
import { useReducedMotion } from '@/lib/motion'

/** The white border round the photo, pt; deeper at the bottom, as a real one. */
const FRAME = 7
const FRAME_BOTTOM = 22
/** The photo's height over its width. */
const PHOTO_RATIO = 0.9
/** One pass of the reading light, top to bottom, ms. */
const SWEEP_MS = 2400

/**
 * A photo in a polaroid frame, tilted a little (docs/application/features/v2-pet-from-photo-
 * requirements.md, R13; mockup C2). `scanning` sweeps a band of warm light down it while the photo
 * is read; still under Reduce Motion. The photo is the picker's file (`uri`), or `children` (the
 * Start card shows a drawn pet as a stand-in).
 */
export function PhotoPolaroid({
	uri,
	width,
	tilt = -4,
	scanning = false,
	children,
	style
}: {
	uri?: string
	width: number
	tilt?: number
	scanning?: boolean
	children?: ReactNode
	style?: StyleProp<ViewStyle>
}) {
	const { colors: c, elevation } = useTheme()
	const photoWidth = width - FRAME * 2
	const photoHeight = Math.round(photoWidth * PHOTO_RATIO)
	return (
		<View
			style={[
				s.frame,
				{
					width,
					padding: FRAME,
					paddingBottom: FRAME_BOTTOM,
					backgroundColor: art.cloud,
					transform: [{ rotate: `${tilt}deg` }]
				},
				elevation.card,
				style
			]}
		>
			<View
				style={[s.photo, { width: photoWidth, height: photoHeight, backgroundColor: c.surface2 }]}
			>
				{uri ? (
					<Image
						source={{ uri }}
						style={StyleSheet.absoluteFill}
						contentFit="cover"
						accessible
						accessibilityLabel="Your photo"
					/>
				) : (
					children
				)}
				{scanning ? <Sweep height={photoHeight} /> : null}
			</View>
		</View>
	)
}

function Sweep({ height }: { height: number }) {
	const { colors: c } = useTheme()
	const reduceMotion = useReducedMotion()
	const band = Math.round(height * 0.4)
	const y = useSharedValue(-band)
	useEffect(() => {
		if (reduceMotion) return
		y.value = withRepeat(
			withTiming(height, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
			-1,
			false
		)
	}, [y, height, reduceMotion])
	const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }))
	if (reduceMotion) return null
	return (
		<Animated.View pointerEvents="none" style={[s.sweep, { height: band }, style]}>
			<LinearGradient
				colors={[withAlpha(c.brandInk, 0), withAlpha(c.brandInk, 0.4), withAlpha(c.brandInk, 0)]}
				style={StyleSheet.absoluteFill}
			/>
		</Animated.View>
	)
}

const s = StyleSheet.create({
	frame: { borderRadius: 4 },
	photo: { borderRadius: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
	sweep: { position: 'absolute', left: 0, right: 0, top: 0 }
})
