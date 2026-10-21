import { Linking, StyleSheet } from 'react-native'
import { BadgeCheck } from 'lucide-react-native'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { useColors } from '@/contexts/ThemeContext'
import { APP_NAME } from '@/lib/constants'
import { STORE_NAME } from '@/lib/paywall'
import { MANAGE_SUBSCRIPTIONS_URL } from '@/lib/purchases'

/**
 * The paywall for someone who has Plus: when it renews or ends, and, for a store subscription,
 * where to manage it. A grant has nothing to manage in the store, so it shows no button.
 */
export function PlusMemberCard({
	renewal,
	storePremium
}: {
	renewal: string | null
	storePremium: boolean
}) {
	const c = useColors()
	return (
		<Card tier="selected" padding="spacious" style={s.gap}>
			<BadgeCheck size={24} color={c.brandInk} strokeWidth={2} />
			<Text variant="h3">You have {APP_NAME} Plus</Text>
			{renewal ? (
				<Text variant="bodySm" tone="secondary">
					{renewal}
				</Text>
			) : null}
			{storePremium ? (
				<Button
					label={`Manage in ${STORE_NAME}`}
					variant="outline"
					size="sm"
					onPress={() => Linking.openURL(MANAGE_SUBSCRIPTIONS_URL)}
					style={s.top}
				/>
			) : null}
		</Card>
	)
}

const s = StyleSheet.create({
	gap: { gap: 10 },
	top: { marginTop: 6 }
})
