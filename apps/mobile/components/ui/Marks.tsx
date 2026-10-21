import { useId, useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { parseColor } from '@app/brand'
import { useTheme } from '@/contexts/ThemeContext'
import { Text } from './Text'

const LOGO_MARK = require('@/assets/icon/logo-mark.png')

/**
 * The app's mark: the moon face on its midnight tile, a small cut of the app
 * icon. It is a logo, so it is the same in both schemes. The art is
 * assets/icon/logo-mark.png (🎨 REPLACE with the final icon; its source is
 * assets/icon/source/).
 */
export function LogoMark({ size = 40 }: { size?: number }) {
	const { elevation } = useTheme()
	return (
		<View
			style={[{ width: size, height: size, borderRadius: size * 0.28 }, elevation.soft]}
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		>
			<Image source={LOGO_MARK} style={{ width: size, height: size }} contentFit="contain" />
		</View>
	)
}

/**
 * The person: their photo when there is one (`uri`), else their initials on the accent tint.
 * The initials stay underneath, so they show while the photo loads and if it fails, never an
 * empty circle. `cacheKey` keeps a photo cached across its signed URL's hourly token
 * (lib/avatar.ts); a local file just picked needs none.
 */
export function Avatar({
	initials,
	size = 64,
	uri,
	cacheKey
}: {
	initials: string
	size?: number
	uri?: string | null
	cacheKey?: string | null
}) {
	const c = useTheme().colors
	const [failed, setFailed] = useState<string | null>(null)
	const showPhoto = !!uri && failed !== uri
	return (
		<View
			style={[
				s.center,
				{
					width: size,
					height: size,
					borderRadius: size / 2,
					// Opaque under the tint: on a sky or a photo the initials never show what's behind.
					backgroundColor: c.surface2,
					borderColor: c.brandBorder,
					borderWidth: StyleSheet.hairlineWidth,
					overflow: 'hidden'
				}
			]}
		>
			<View style={[StyleSheet.absoluteFill, { backgroundColor: c.brandDim }]} />
			<Text
				variant="h3"
				style={{ color: c.brandInk, fontSize: size * 0.36, lineHeight: size * 0.44 }}
				maxFontSizeMultiplier={1}
			>
				{initials}
			</Text>
			{showPhoto ? (
				<Image
					source={cacheKey ? { uri, cacheKey } : { uri }}
					style={StyleSheet.absoluteFill}
					contentFit="cover"
					transition={150}
					cachePolicy="memory-disk"
					recyclingKey={cacheKey ?? uri}
					onError={() => setFailed(uri)}
					accessibilityIgnoresInvertColors
				/>
			) : null}
		</View>
	)
}

/**
 * A soft radial wash of the accent — atmosphere behind a hero moment, never a
 * halo around a control. Drawn as an SVG gradient so it fades to nothing with
 * no hard edge.
 */
export function Glow({
	size,
	color,
	strength = 1,
	style
}: {
	size: number
	/** Defaults to the palette's brandGlow. */
	color?: string
	/** Scales the colour's own alpha. */
	strength?: number
	style?: StyleProp<ViewStyle>
}) {
	const c = useTheme().colors
	const id = useId().replace(/:/g, '')
	const rgba = parseColor(color ?? c.brandGlow)
	const rgb = `rgb(${rgba.r},${rgba.g},${rgba.b})`
	const alpha = Math.min(1, rgba.a * strength)
	return (
		<View pointerEvents="none" style={[{ width: size, height: size }, style]}>
			<Svg width={size} height={size}>
				<Defs>
					<RadialGradient id={id} cx="50%" cy="50%" r="50%">
						<Stop offset="0" stopColor={rgb} stopOpacity={alpha} />
						<Stop offset="0.55" stopColor={rgb} stopOpacity={alpha * 0.35} />
						<Stop offset="1" stopColor={rgb} stopOpacity={0} />
					</RadialGradient>
				</Defs>
				<Rect width={size} height={size} fill={`url(#${id})`} />
			</Svg>
		</View>
	)
}

const s = StyleSheet.create({
	center: { alignItems: 'center', justifyContent: 'center' }
})
