import { StyleSheet } from 'react-native'
import Animated from 'react-native-reanimated'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { exitFade, fade } from '@/lib/motion'

/**
 * Your words, shown back while the pet listens and thinks (the spec, "Talking (on Home)"): the
 * bubble's own solid surface with the accent border, so it reads over the pet and the sky (a
 * see-through tint didn't), small (caption type, a 20-word message at most), two lines at most,
 * the start cut off as the words grow so the newest stay in view. It fades in and out; Reduce Motion makes that a plain swap.
 */
export function WordsChip({ words }: { words: string }) {
	const { colors: c, radii, elevation } = useTheme()
	return (
		<Animated.View
			entering={fade()}
			exiting={exitFade()}
			style={[
				s.chip,
				{ backgroundColor: c.surface2, borderColor: c.brandBorder, borderRadius: radii.card },
				elevation.card
			]}
			accessible
			accessibilityLabel={`You said: ${words}`}
		>
			<Text variant="caption" numberOfLines={2} ellipsizeMode="head" style={s.text}>
				{words}
			</Text>
		</Animated.View>
	)
}

const s = StyleSheet.create({
	chip: {
		alignSelf: 'center',
		maxWidth: '78%',
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderWidth: 1
	},
	text: { textAlign: 'center' }
})
