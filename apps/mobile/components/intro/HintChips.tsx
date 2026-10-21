import { StyleSheet, View } from 'react-native'
import Animated from 'react-native-reanimated'
import {
	Calendar,
	Check,
	GraduationCap,
	PawPrint,
	Puzzle,
	User,
	type LucideIcon
} from 'lucide-react-native'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { HINT_LABEL, INTRO_HINTS, type IntroHint } from '@/lib/introHints'
import { Durations, fade } from '@/lib/motion'

const HINT_ICON: Record<IntroHint, LucideIcon> = {
	name: User,
	studyWork: GraduationCap,
	pets: PawPrint,
	hobbies: Puzzle,
	comingUp: Calendar
}

/**
 * Ideas of what to tell the pet (the spec, "Tell me about you (v2)"): five small chips, not
 * buttons. A chip that has been said lights up in the accent with a check. VoiceOver reads them
 * once, as one line of ideas, and says nothing as they light, so it never talks over the person.
 */
export function HintChips({ lit }: { lit: readonly IntroHint[] }) {
	const { colors: c, radii } = useTheme()
	return (
		<View
			style={s.wrap}
			accessible
			accessibilityLabel="Ideas: your name, study or work, pets, hobbies, something coming up"
		>
			{INTRO_HINTS.map((hint) => {
				const on = lit.includes(hint)
				const Icon = on ? Check : HINT_ICON[hint]
				return (
					// Keyed by its state, so lighting up fades the new look in.
					<Animated.View
						key={`${hint}-${on}`}
						entering={on ? fade(0, Durations.base) : undefined}
						style={[
							s.chip,
							{
								borderRadius: radii.pill,
								backgroundColor: on ? c.brandDim : c.surface,
								borderColor: on ? c.brandBorder : c.borderSoft
							}
						]}
					>
						<Icon size={13} color={on ? c.brandInk : c.textSecondary} strokeWidth={2.2} />
						<Text variant="caption" tone={on ? 'brand' : 'secondary'}>
							{HINT_LABEL[hint]}
						</Text>
					</Animated.View>
				)
			})}
		</View>
	)
}

const s = StyleSheet.create({
	wrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
	chip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderWidth: 1
	}
})
