import { Pressable, StyleSheet } from 'react-native'
import { Text, type TextTone } from './Text'

/** A caption line is about 18pt: this much above and below makes the touch area 44pt. */
const SLOP_Y = 13

/**
 * A short text link (Terms, Privacy Policy) inside a line of small print: its own VoiceOver
 * element with the link role, and a 44pt touch area though the text is small (M8, R2). Nest it
 * in a wrapping row, not inside another Text, so VoiceOver can reach it on its own.
 */
export function TextLink({
	label,
	onPress,
	tone = 'secondary',
	underline = false
}: {
	label: string
	onPress: () => void
	tone?: TextTone
	underline?: boolean
}) {
	return (
		<Pressable
			onPress={onPress}
			hitSlop={{ top: SLOP_Y, bottom: SLOP_Y, left: 4, right: 4 }}
			accessibilityRole="link"
			accessibilityLabel={label}
		>
			<Text variant="caption" tone={tone} style={underline && s.underline}>
				{label}
			</Text>
		</Pressable>
	)
}

const s = StyleSheet.create({ underline: { textDecorationLine: 'underline' } })
