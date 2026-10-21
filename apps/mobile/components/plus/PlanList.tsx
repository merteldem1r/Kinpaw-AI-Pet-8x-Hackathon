import { StyleSheet, View } from 'react-native'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SELECTION_ROW_HEIGHT, SelectionRow } from '@/components/ui/SelectionRow'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { periodPhrase, planSubtitle, STORE_NAME, type PlanOption } from '@/lib/paywall'

/**
 * The paywall's plans, one to choose (a radio group): skeletons while the store answers, a way to
 * try again when it returns none, and the preview note in a development build.
 */
export function PlanList({
	plans,
	selected,
	loading,
	preview,
	onSelect,
	onRetry
}: {
	plans: PlanOption[]
	selected: PlanOption | null
	loading: boolean
	preview: boolean
	onSelect: (plan: PlanOption) => void
	onRetry: () => void
}) {
	const { radii } = useTheme()
	return (
		<>
			{preview ? (
				<Text variant="caption" tone="warning">
					Preview prices — development build only. Real prices come from the store.
				</Text>
			) : null}
			{loading ? (
				<>
					{/* A plan card's own height, so nothing moves when the plans arrive. */}
					<Skeleton height={SELECTION_ROW_HEIGHT} radius={radii.row} />
					<Skeleton height={SELECTION_ROW_HEIGHT} radius={radii.row} />
				</>
			) : plans.length === 0 ? (
				<Card tier="well" style={s.gap}>
					<Text variant="label">Plans aren&apos;t available right now</Text>
					<Text variant="bodySm" tone="secondary">
						The {STORE_NAME} didn&apos;t return any plans. Check your connection and try again.
					</Text>
					<Button label="Try again" variant="outline" size="sm" onPress={onRetry} style={s.top} />
				</Card>
			) : (
				<View accessibilityRole="radiogroup" style={s.gap}>
					{plans.map((plan) => (
						<SelectionRow
							key={plan.id}
							title={plan.title}
							subtitle={planSubtitle(plan)}
							selected={plan.id === selected?.id}
							onPress={() => onSelect(plan)}
							accessibilityLabel={`${plan.title}, ${plan.price} ${periodPhrase(plan.period)}`}
							trailing={
								<View style={s.price}>
									<Text variant="label" tabular>
										{plan.price}
									</Text>
									<Text variant="caption" tone="tertiary">
										{periodPhrase(plan.period)}
									</Text>
								</View>
							}
						/>
					))}
				</View>
			)}
		</>
	)
}

const s = StyleSheet.create({
	gap: { gap: 10 },
	top: { marginTop: 6 },
	price: { alignItems: 'flex-end' }
})
