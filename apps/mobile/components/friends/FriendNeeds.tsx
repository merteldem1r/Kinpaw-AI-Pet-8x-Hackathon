/**
 * A friend's pet's four needs as words, never numbers (docs/application/features/
 * v2-friends-requirements.md, R11): low, okay or good. Low reads in the low-need coral, as on
 * Home.
 */
import { StyleSheet, View } from 'react-native'
import { NEEDS, type FriendPet, type NeedBand } from '@app/contract'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { NEED_LABEL } from '@/lib/friends'

const BAND_WORD: Record<NeedBand, string> = { low: 'Low', okay: 'Okay', good: 'Good' }

export function FriendNeeds({ needs }: { needs: FriendPet['needs'] }) {
	const { colors: c, radii } = useTheme()
	return (
		<View style={s.grid}>
			{NEEDS.map((need) => {
				const band = needs[need]
				const low = band === 'low'
				return (
					<View
						key={need}
						style={[
							s.cell,
							{
								backgroundColor: low ? c.errorSoft : c.surface2,
								borderColor: c.borderHairline,
								borderRadius: radii.card
							}
						]}
						accessible
						accessibilityLabel={`${NEED_LABEL[need]}: ${BAND_WORD[band]}`}
					>
						<Text variant="caption" tone="secondary">
							{NEED_LABEL[need]}
						</Text>
						<Text variant="label" style={low ? { color: c.errorText } : undefined}>
							{BAND_WORD[band]}
						</Text>
					</View>
				)
			})}
		</View>
	)
}

const s = StyleSheet.create({
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
	cell: {
		flexBasis: '47%',
		flexGrow: 1,
		gap: 2,
		paddingVertical: 12,
		paddingHorizontal: 14,
		borderWidth: StyleSheet.hairlineWidth
	}
})
