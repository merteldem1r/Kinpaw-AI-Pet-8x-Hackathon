import { StyleSheet } from 'react-native'
import Animated, { ReduceMotion, ZoomIn, ZoomOut } from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '@/contexts/ThemeContext'
import { Springs } from '@/lib/motion'
import { SpeakingBars } from './SpeakingBars'

const HEIGHT = 26
const BARS = 12

const enter = ZoomIn.springify()
	.damping(Springs.snappy.damping ?? 14)
	.stiffness(Springs.snappy.stiffness ?? 220)
	.reduceMotion(ReduceMotion.System)
const leave = ZoomOut.duration(160).reduceMotion(ReduceMotion.System)

/**
 * The pet speaking, pinned to the bubble's top corner (v2 voice): a small brand-gradient pill
 * with the speaking bars in the on-brand colour. It pops in when the voice starts and out when
 * it ends, so the line itself stays just words.
 */
export function SpeakingBadge({ name }: { name: string }) {
	const { colors: c, elevation } = useTheme()
	return (
		<Animated.View entering={enter} exiting={leave} style={[s.badge, elevation.cta]}>
			<LinearGradient
				colors={c.brandGradient}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				style={[StyleSheet.absoluteFill, s.round]}
			/>
			<SpeakingBars name={name} size={BARS} color={c.onBrand} />
		</Animated.View>
	)
}

const s = StyleSheet.create({
	badge: {
		position: 'absolute',
		top: -HEIGHT / 2,
		right: 14,
		height: HEIGHT,
		minWidth: HEIGHT + 12,
		paddingHorizontal: 10,
		borderRadius: HEIGHT / 2,
		alignItems: 'center',
		justifyContent: 'center'
	},
	round: { borderRadius: HEIGHT / 2 }
})
