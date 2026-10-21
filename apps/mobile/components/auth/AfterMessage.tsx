import { StyleSheet, View } from 'react-native'
import { Check } from 'lucide-react-native'
import { PawTrail } from '@/components/pet/PawTrail'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import type { AfterSignIn } from '@/lib/signIn'

/** The line under the code boxes: a wrong code, signing in, or a save that didn't go through. */
export function AfterMessage({
	after,
	name,
	error,
	onRetry
}: {
	after: AfterSignIn
	name: string
	error: string | null
	onRetry: () => void
}) {
	const { colors: c } = useTheme()
	if (after === 'saving' || after === 'finding') {
		return (
			<View
				style={s.goingHome}
				accessible
				accessibilityLiveRegion="polite"
				accessibilityLabel={
					after === 'saving' ? `Signed in. Taking ${name} home.` : 'Signed in. Finding your pet.'
				}
			>
				<View style={s.signedIn}>
					<Check size={16} color={c.successText} strokeWidth={2.4} />
					<Text variant="label" tone="success">
						Signed in
					</Text>
				</View>
				<View style={s.walking}>
					<PawTrail />
					<Text variant="bodySm" tone="secondary">
						{after === 'saving' ? `Taking ${name} home…` : 'Sniffing out your pet…'}
					</Text>
				</View>
			</View>
		)
	}
	if (after === 'save_failed' || after === 'find_failed') {
		return (
			<View style={s.failed}>
				<Text variant="bodySm" tone="error" accessibilityLiveRegion="polite">
					{after === 'save_failed'
						? `Couldn't save ${name} yet. Check your connection and try again.`
						: "Couldn't reach your pet. Check your connection and try again."}
				</Text>
				<Button label="Try again" variant="secondary" size="md" onPress={onRetry} />
			</View>
		)
	}
	if (!error) return null
	return (
		<Text variant="bodySm" tone="error" accessibilityLiveRegion="polite">
			{error}
		</Text>
	)
}

const s = StyleSheet.create({
	goingHome: { gap: 8 },
	signedIn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	walking: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	failed: { gap: 12, alignItems: 'flex-start' }
})
