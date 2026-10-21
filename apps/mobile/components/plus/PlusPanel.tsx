import { StyleSheet, View } from 'react-native'
import { BadgeCheck } from 'lucide-react-native'
import { plusFeatures } from '@/components/plus/plusFeatures'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { useColors } from '@/contexts/ThemeContext'
import { APP_NAME } from '@/lib/constants'

/**
 * Kinpaw Plus on Profile (M7, R12; the spec's "You", upgrade panel). Free: the hero card with
 * what Plus adds and "See plans". Plus: a "Plus member" badge and what it includes, no button.
 */
export function PlusPanel({
	name,
	plus,
	onSeePlans
}: {
	/** The pet's name, or "your pet" while it loads. */
	name: string
	plus: boolean
	onSeePlans: () => void
}) {
	const c = useColors()
	return (
		<Card tier={plus ? 'selected' : 'hero'} padding="spacious" style={s.card}>
			<View style={s.head}>
				<Text variant="h3" style={s.flex} accessibilityRole="header">
					{APP_NAME} Plus
				</Text>
				{plus ? (
					<View
						style={[s.badge, { backgroundColor: c.brandDim, borderColor: c.brandBorder }]}
						accessible
						accessibilityLabel="Plus member"
					>
						<BadgeCheck size={14} color={c.brandInk} strokeWidth={2.2} />
						<Text variant="caption" tone="brand">
							Plus member
						</Text>
					</View>
				) : null}
			</View>
			<View style={s.features}>
				{plusFeatures(name).map(({ icon: Icon, label }) => (
					<View key={label} style={s.feature}>
						<View style={[s.chip, { backgroundColor: c.brandDim }]}>
							<Icon size={14} color={c.brandInk} strokeWidth={2} />
						</View>
						<Text variant="bodySm" style={s.flex}>
							{label}
						</Text>
					</View>
				))}
			</View>
			{plus ? null : (
				<Button
					label="See plans"
					variant="secondary"
					size="md"
					fullWidth
					accessibilityHint={`Opens ${APP_NAME} Plus`}
					onPress={onSeePlans}
				/>
			)}
		</Card>
	)
}

const CHIP = 26

const s = StyleSheet.create({
	card: { gap: 14 },
	head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	flex: { flex: 1 },
	badge: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 999,
		borderWidth: 1
	},
	features: { gap: 10 },
	feature: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	chip: {
		width: CHIP,
		height: CHIP,
		borderRadius: CHIP / 2,
		alignItems: 'center',
		justifyContent: 'center'
	}
})
