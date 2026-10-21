import { StyleSheet, View } from 'react-native'
import type { Pet } from '@app/contract'
import { PetBubble } from '@/components/pet/PetBubble'
import { PetPortrait } from '@/components/pet/PetPortrait'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'

/**
 * Under the name field on Edit profile: the pet saying hello with the name as it is being
 * typed, so the person sees what the name is for (the pet calls them by it when they talk,
 * profile-edit R16). A preview only: the pet's real replies use the name now and then.
 */
export function NameGreeting({ pet, name }: { pet: Pet; name: string }) {
	const { colors: c, radii } = useTheme()
	const line = name ? `Hi, ${name}! I missed you.` : 'Hi! What should I call you?'
	return (
		<View
			style={[
				s.card,
				{ backgroundColor: c.surface, borderColor: c.borderHairline, borderRadius: radii.card }
			]}
		>
			<View style={s.row}>
				<PetPortrait appearance={pet.appearance} mood="happy" size={48} />
				<PetBubble line={line} compact style={s.bubble} />
			</View>
			<Text variant="caption" tone="secondary">
				{pet.name} calls you by this name when you talk.
			</Text>
		</View>
	)
}

const s = StyleSheet.create({
	card: { gap: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth },
	row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
	bubble: { flexShrink: 1, marginBottom: 18 }
})
