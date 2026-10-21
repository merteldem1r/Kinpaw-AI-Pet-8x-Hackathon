import { useEffect, useState, type ReactNode } from 'react'
import {
	StyleSheet,
	View,
	type LayoutChangeEvent,
	type StyleProp,
	type ViewStyle
} from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { PressableScale } from '@/components/motion/PressableScale'
import { useTheme } from '@/contexts/ThemeContext'
import { haptic } from '@/lib/haptics'
import { Springs } from '@/lib/motion'
import { Text } from './Text'

const PAD = 4

export interface Segment<T extends string> {
	value: T
	label: string
	/** Receives the colour to draw in. */
	icon?: (color: string) => ReactNode
}

/**
 * A pill track with one raised segment that slides to the choice on the
 * smooth spring. For two to four mutually exclusive options shown together
 * (appearance, a list filter).
 */
export function SegmentedControl<T extends string>({
	segments,
	value,
	onChange,
	accessibilityLabel,
	dense = false,
	stacked = false,
	style
}: {
	segments: Segment<T>[]
	value: T
	onChange: (next: T) => void
	accessibilityLabel?: string
	/** Smaller labels and a 40pt track: many segments (the builder's tabs), or a compact control. */
	dense?: boolean
	/**
	 * Icon above a small label, for many segments with long words (the builder's six tabs):
	 * every label fits, and the chosen icon takes the accent.
	 */
	stacked?: boolean
	style?: StyleProp<ViewStyle>
}) {
	const { colors: c, elevation, isDark } = useTheme()
	const [width, setWidth] = useState(0)
	const index = Math.max(
		0,
		segments.findIndex((seg) => seg.value === value)
	)
	const slot = segments.length ? (width - PAD * 2) / segments.length : 0

	const x = useSharedValue(0)
	useEffect(() => {
		if (slot > 0) x.value = withSpring(index * slot, Springs.smooth)
	}, [index, slot, x])
	const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

	function onLayout(e: LayoutChangeEvent) {
		const w = e.nativeEvent.layout.width
		setWidth(w)
		x.value = index * ((w - PAD * 2) / Math.max(segments.length, 1))
	}

	return (
		<View
			onLayout={onLayout}
			accessibilityRole="tablist"
			accessibilityLabel={accessibilityLabel}
			style={[
				s.track,
				{ backgroundColor: c.well, borderColor: c.borderHairline },
				dense && s.dense,
				stacked && s.stackedTrack,
				style
			]}
		>
			{slot > 0 ? (
				<Animated.View
					pointerEvents="none"
					style={[
						s.thumb,
						stacked && s.stackedThumb,
						{
							width: slot,
							backgroundColor: isDark ? c.surface3 : c.surface,
							borderColor: c.borderSoft
						},
						elevation.soft,
						thumb
					]}
				/>
			) : null}
			{segments.map((seg) => {
				const active = seg.value === value
				const color = active ? c.textPrimary : c.textSecondary
				const iconColor = stacked && active ? c.brandInk : color
				return (
					<PressableScale
						key={seg.value}
						haptic={false}
						scaleTo={0.97}
						accessibilityRole="tab"
						accessibilityLabel={seg.label}
						accessibilityState={{ selected: active }}
						onPress={() => {
							if (active) return
							haptic.select()
							onChange(seg.value)
						}}
						style={[s.segment, stacked && s.stackedSegment]}
					>
						{seg.icon ? seg.icon(iconColor) : null}
						<Text
							variant="label"
							numberOfLines={1}
							maxFontSizeMultiplier={1.3}
							style={[s.label, { color }, dense && s.denseLabel, stacked && s.stackedLabel]}
						>
							{seg.label}
						</Text>
					</PressableScale>
				)
			})}
		</View>
	)
}

const s = StyleSheet.create({
	track: {
		flexDirection: 'row',
		borderRadius: 999,
		padding: PAD,
		borderWidth: StyleSheet.hairlineWidth,
		minHeight: 44
	},
	dense: { minHeight: 40 },
	denseLabel: { fontSize: 14 },
	thumb: {
		position: 'absolute',
		top: PAD,
		bottom: PAD,
		left: PAD,
		borderRadius: 999,
		borderWidth: StyleSheet.hairlineWidth
	},
	segment: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		paddingVertical: 8,
		paddingHorizontal: 6
	},
	label: { fontSize: 14 },
	stackedTrack: { minHeight: 56, borderRadius: 20 },
	stackedThumb: { borderRadius: 16 },
	stackedSegment: { flexDirection: 'column', gap: 3, paddingVertical: 7, paddingHorizontal: 2 },
	stackedLabel: { fontSize: 12 }
})
