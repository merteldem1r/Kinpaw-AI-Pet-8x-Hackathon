import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { art, type SkyPhase } from '@app/brand'
import { useTheme } from '@/contexts/ThemeContext'
import { SkyScene } from './SkyScene'

/** Where the art's four stops sit; the band then ends on the screen's `bg`. */
const LOCATIONS = [0, 0.28, 0.5, 0.74, 1] as const

const DAY: Record<SkyPhase, boolean> = {
	morning: true,
	afternoon: true,
	evening: false,
	night: false
}

/**
 * The sky outside at the current part of day: one soft gradient from the top
 * of the screen that ends exactly on `bg`, so whatever stands below it is in
 * the room (docs/application/UI/kinpaw-screen-spec-v1.md, "Home" → SkyBand).
 *
 * A day sky over the dark ground, or a night sky over the light one, swaps its
 * last stop for the art's bridge tone, so the fade never jumps.
 *
 * The sun, moon, stars and clouds, and their motion, are SkyScene.
 */
export function SkyBand({
	phase,
	height,
	endColor,
	poke,
	style
}: {
	phase: SkyPhase
	height: number
	/** Bumped when the sun or moon is tapped, so it answers. */
	poke?: number
	/** What the band fades into; the screen's `bg` unless it ends on something else (a sheet). */
	endColor?: string
	style?: StyleProp<ViewStyle>
}) {
	const { colors: c, isDark } = useTheme()
	const { width } = useWindowDimensions()
	const sky = art.sky[phase]
	const crossed = DAY[phase] === isDark
	const [s0, s1, s2, s3] = sky.stops
	return (
		<View pointerEvents="none" style={[s.band, { height }, style]}>
			<LinearGradient
				colors={[s0, s1, s2, crossed ? sky.bridge : s3, endColor ?? c.bg]}
				locations={LOCATIONS}
				style={StyleSheet.absoluteFill}
			/>
			<SkyScene phase={phase} width={width} height={height} poke={poke} />
		</View>
	)
}

const s = StyleSheet.create({
	band: { position: 'absolute', top: 0, left: 0, right: 0 }
})
