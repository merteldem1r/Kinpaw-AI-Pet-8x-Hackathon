import { StyleSheet, View } from 'react-native'
import { CalendarClock, Check } from 'lucide-react-native'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { useColors } from '@/contexts/ThemeContext'

/**
 * What the trial becomes, told plainly on the paywall: today, and the day it turns into a paid
 * subscription. No promise of a reminder the app does not send.
 */
export function TrialTimeline({ days, price }: { days: number; price: string }) {
	const c = useColors()
	const steps = [
		{ icon: Check, title: 'Today', body: 'Full access starts. Nothing is charged.' },
		{
			icon: CalendarClock,
			title: `Day ${days}`,
			body: `The trial ends and ${price} begins, unless you cancel before.`
		}
	]
	return (
		<Card tier="well" padding="spacious">
			<Text variant="eyebrow" tone="secondary" style={s.title}>
				How the free trial works
			</Text>
			{steps.map((step, i) => {
				const Icon = step.icon
				const lastStep = i === steps.length - 1
				return (
					<View key={step.title} style={s.step}>
						<View style={s.rail}>
							<View style={[s.node, { backgroundColor: i === 0 ? c.brandFill : c.surface3 }]}>
								<Icon size={14} color={i === 0 ? c.onBrand : c.textSecondary} strokeWidth={2.4} />
							</View>
							{lastStep ? null : <View style={[s.line, { backgroundColor: c.borderActive }]} />}
						</View>
						<View style={[s.flex, !lastStep && s.stepGap]}>
							<Text variant="label">{step.title}</Text>
							<Text variant="bodySm" tone="secondary">
								{step.body}
							</Text>
						</View>
					</View>
				)
			})}
		</Card>
	)
}

const s = StyleSheet.create({
	title: { marginBottom: 14 },
	step: { flexDirection: 'row', gap: 12 },
	rail: { alignItems: 'center', width: 28 },
	node: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
	line: { width: 2, flex: 1, marginVertical: 4, borderRadius: 1 },
	flex: { flex: 1 },
	stepGap: { paddingBottom: 16 }
})
