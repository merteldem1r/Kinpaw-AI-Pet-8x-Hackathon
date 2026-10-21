/**
 * One friend in the Friends tab (docs/application/features/v2-friends-requirements.md, R3): their
 * pet in its mood, its name, whose it is and how it feels. Opens the friend's pet page.
 */
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'
import type { Friend } from '@app/contract'
import { PetPortrait } from '@/components/pet/PetPortrait'
import { MOOD_LINE } from '@/components/pet/PetHero'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { useColors } from '@/contexts/ThemeContext'
import { friendName, friendPetCaption, friendPetLine } from '@/lib/friends'

const PORTRAIT = 56

export function FriendRow({ friend }: { friend: Friend }) {
	const c = useColors()
	const pet = friend.pet
	const label = pet
		? `${pet.name}, ${friendPetCaption(friend)}. ${friendPetLine(pet)} Opens their page`
		: `${friendName(friend)}. Opens their page`
	return (
		<Card
			tier="raised"
			padding="compact"
			onPress={() => router.push({ pathname: '/friends/[id]', params: { id: friend.id } })}
			accessibilityLabel={label}
		>
			<View style={s.row}>
				{pet ? (
					<PetPortrait appearance={pet.appearance} mood={pet.mood} size={PORTRAIT} />
				) : (
					<View style={{ width: PORTRAIT, height: PORTRAIT }} />
				)}
				<View style={s.who}>
					<Text variant="label" numberOfLines={1}>
						{pet?.name ?? friendName(friend)}
					</Text>
					<Text variant="caption" tone="secondary" numberOfLines={1}>
						{friendPetCaption(friend)}
					</Text>
					{pet ? (
						<Text variant="caption" tone="tertiary" numberOfLines={1}>
							{MOOD_LINE[pet.mood]}
						</Text>
					) : null}
				</View>
				<ChevronRight size={18} color={c.textTertiary} strokeWidth={2} />
			</View>
		</Card>
	)
}

const s = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
	who: { flex: 1, gap: 2 }
})
