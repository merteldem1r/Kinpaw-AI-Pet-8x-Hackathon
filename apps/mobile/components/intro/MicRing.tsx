import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { MicButton } from '@/components/pet/MicButton'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import type { CancelReason } from '@/hooks/useVoice'
import { Springs } from '@/lib/motion'

/** The ring, pt across, around the 64pt mic, and its line. */
const RING = 88
const STROKE = 3
const RADIUS = (RING - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** Where the mic sits in the ring: centred. */
const MIC_INSET = (RING - 64) / 2

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/**
 * The intro's mic (the spec, "Tell me about you (v2)"): Home's MicButton inside an amber ring that
 * fills toward the word limit, with "37 / 60" on its shoulder while listening. The gestures are
 * MicButton's; the ring only shows how much is left to say.
 */
export function MicRing({
	name,
	words,
	maxWords,
	listening,
	disabled,
	onStart,
	onFinish,
	onCancel
}: {
	name: string
	/** Words heard so far. */
	words: number
	maxWords: number
	listening: boolean
	disabled: boolean
	onStart: () => void
	onFinish: () => void
	onCancel: (reason: CancelReason) => void
}) {
	const { colors: c } = useTheme()
	const progress = useSharedValue(0)
	useEffect(() => {
		progress.value = withSpring(Math.min(1, words / maxWords), Springs.smooth)
	}, [words, maxWords, progress])
	const ring = useAnimatedProps(() => ({
		strokeDashoffset: CIRCUMFERENCE * (1 - progress.value)
	}))

	return (
		<View
			style={s.ring}
			accessibilityValue={listening ? { text: `${words} of ${maxWords} words` } : undefined}
		>
			<Svg width={RING} height={RING} style={StyleSheet.absoluteFill} pointerEvents="none">
				<Circle
					cx={RING / 2}
					cy={RING / 2}
					r={RADIUS}
					stroke={c.tintTrack}
					strokeWidth={STROKE}
					fill="none"
				/>
				<AnimatedCircle
					cx={RING / 2}
					cy={RING / 2}
					r={RADIUS}
					stroke={c.brandInk}
					strokeWidth={STROKE}
					strokeLinecap="round"
					fill="none"
					strokeDasharray={CIRCUMFERENCE}
					animatedProps={ring}
					transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
				/>
			</Svg>
			<View style={s.mic}>
				<MicButton
					name={name}
					listening={listening}
					disabled={disabled}
					onStart={onStart}
					onFinish={onFinish}
					onCancel={onCancel}
					showHint={false}
				/>
			</View>
			{listening ? (
				<View
					style={[s.badge, { backgroundColor: c.surface2, borderColor: c.brandBorder }]}
					importantForAccessibility="no-hide-descendants"
				>
					<Text variant="caption" tone="brand" style={s.count}>
						{`${words} / ${maxWords}`}
					</Text>
				</View>
			) : null}
		</View>
	)
}

const s = StyleSheet.create({
	ring: { width: RING, height: RING },
	mic: { position: 'absolute', top: MIC_INSET, left: 0, right: 0, alignItems: 'center' },
	badge: {
		position: 'absolute',
		top: -2,
		left: RING - 22,
		height: 22,
		borderRadius: 11,
		borderWidth: 1,
		paddingHorizontal: 7,
		justifyContent: 'center'
	},
	count: { fontWeight: '700', fontVariant: ['tabular-nums'] }
})
