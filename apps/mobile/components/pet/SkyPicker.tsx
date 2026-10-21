import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Moon, Sun, Sunrise, Sunset, type LucideIcon } from 'lucide-react-native'
import { SKY_PHASES, type SkyPhase } from '@app/brand'
import { PressableScale } from '@/components/motion/PressableScale'
import { useTheme } from '@/contexts/ThemeContext'

/** Each button, pt. */
const BUTTON = 40

const ICON: Record<SkyPhase, LucideIcon> = {
	morning: Sunrise,
	afternoon: Sun,
	evening: Sunset,
	night: Moon
}

/**
 * A small glass row of the four times of day (sunrise, sun, sunset, moon), for
 * previewing a pet under each sky. The chosen one sits in the accent.
 */
export function SkyPicker({
	value,
	onChange,
	style
}: {
	value: SkyPhase
	onChange: (phase: SkyPhase) => void
	style?: StyleProp<ViewStyle>
}) {
	const { colors: c } = useTheme()
	return (
		<View
			accessibilityRole="radiogroup"
			accessibilityLabel="Time of day"
			style={[s.row, { backgroundColor: c.surface2, borderColor: c.borderGlass }, style]}
		>
			{SKY_PHASES.map((phase) => {
				const Icon = ICON[phase]
				const selected = phase === value
				return (
					<PressableScale
						key={phase}
						onPress={() => onChange(phase)}
						haptic="select"
						// 40pt and 2 of slop: 44pt, without reaching into the next button (M8, R1).
						hitSlop={2}
						accessibilityRole="radio"
						accessibilityLabel={`${phase[0]!.toUpperCase()}${phase.slice(1)} sky`}
						accessibilityState={{ selected }}
						style={[s.button, selected && { backgroundColor: c.brandDim }]}
					>
						<Icon size={18} strokeWidth={2} color={selected ? c.brandInk : c.textSecondary} />
					</PressableScale>
				)
			})}
		</View>
	)
}

const s = StyleSheet.create({
	row: {
		flexDirection: 'row',
		gap: 2,
		padding: 3,
		borderRadius: (BUTTON + 6) / 2,
		borderWidth: StyleSheet.hairlineWidth
	},
	button: {
		width: BUTTON,
		height: BUTTON,
		borderRadius: BUTTON / 2,
		alignItems: 'center',
		justifyContent: 'center'
	}
})
