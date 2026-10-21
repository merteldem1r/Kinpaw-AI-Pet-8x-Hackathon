import type { ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { PressableScale } from '@/components/motion/PressableScale'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { SpeakingBadge } from '@/components/voice/SpeakingBadge'
import { VoiceRing, type BubbleVoice } from '@/components/voice/VoiceRing'
import { useTheme } from '@/contexts/ThemeContext'

/** The corner nearest the pet, pt: the bubble's "tail". */
const TAIL_RADIUS = 6

/** A row under the line that turns the whole bubble into one button ("Try again"). */
export type BubbleAction = {
	label: string
	/** Receives the colour to draw in. */
	icon?: (color: string) => ReactNode
	onPress: () => void
}

/**
 * A question under the line with two answers, each its own button (the pet asking to send its
 * notes: v2-notifications R13). The bubble itself is not a button then.
 */
export type BubbleChoice = {
	prompt: string
	yes: { label: string; onPress: () => void }
	no: { label: string; onPress: () => void }
}

/**
 * What the pet says, in its own voice (Inter, `body`): a card with its lower-left
 * corner tucked in, pointing down at the pet. `children`, when given, stand in for
 * the line (the thinking paws while a reply is on its way). `action` adds a row
 * under it and makes the whole bubble one button; `choice` adds a question with two
 * buttons of its own, and wins over `action`. `voice` shows the pet's voice on the bubble's edge:
 * a light running around it while the voice is on its way, the brand gradient and a badge on the
 * top corner while it plays.
 */
export function PetBubble({
	line,
	action,
	choice,
	compact = false,
	voice,
	name,
	style,
	children
}: {
	line: string
	action?: BubbleAction
	choice?: BubbleChoice
	/** Smaller text and padding, for a bubble beside a smaller pet (Save, sign-in). */
	compact?: boolean
	/** The pet's voice for this line: on its way, or playing. */
	voice?: BubbleVoice | null
	/** The pet's name, for the speaking badge's label. */
	name?: string
	style?: StyleProp<ViewStyle>
	children?: ReactNode
}) {
	const { colors: c, radii, elevation } = useTheme()
	const corners = { borderRadius: radii.card, borderBottomLeftRadius: TAIL_RADIUS }
	const bubbleStyle = [
		s.bubble,
		compact && s.compact,
		corners,
		// With a voice, the ring draws the edge and the fill.
		voice ? s.voiced : { backgroundColor: c.surface2, borderColor: c.borderHairline },
		elevation.card,
		style
	]
	const content = (
		<>
			{voice ? <VoiceRing voice={voice} corners={corners} /> : null}
			{voice === 'speaking' && name ? <SpeakingBadge name={name} /> : null}
			{children ?? (
				<Text variant={compact ? 'bodySm' : 'body'} accessibilityLiveRegion="polite">
					{line}
				</Text>
			)}
			{choice ? (
				<View style={s.choice}>
					<Text variant="label" tone="brand">
						{choice.prompt}
					</Text>
					<View style={s.choiceRow}>
						<Button label={choice.yes.label} size="sm" onPress={choice.yes.onPress} />
						<Button label={choice.no.label} size="sm" variant="ghost" onPress={choice.no.onPress} />
					</View>
				</View>
			) : action ? (
				<View style={s.action}>
					{action.icon?.(c.brandInk)}
					<Text variant="label" tone="brand">
						{action.label}
					</Text>
				</View>
			) : null}
		</>
	)
	if (action && !choice) {
		return (
			<PressableScale
				onPress={action.onPress}
				accessibilityRole="button"
				accessibilityLabel={`${line} ${action.label}`}
				style={bubbleStyle}
			>
				{content}
			</PressableScale>
		)
	}
	return <View style={bubbleStyle}>{content}</View>
}

const s = StyleSheet.create({
	bubble: {
		maxWidth: 220,
		paddingHorizontal: 16,
		paddingVertical: 14,
		gap: 8,
		borderWidth: StyleSheet.hairlineWidth
	},
	voiced: { backgroundColor: 'transparent', borderColor: 'transparent' },
	compact: { maxWidth: 176, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
	action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	choice: { gap: 8 },
	choiceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }
})
