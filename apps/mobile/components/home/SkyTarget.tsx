import { Pressable, StyleSheet } from 'react-native'
import { skyBodyAt } from '@/components/pet/SkyScene'
import type { useSkyPhase } from '@/lib/sky'

/** The tap target over the sun or moon, pt square. */
const SKY_TARGET = 72

/** The sun or moon, tappable: a target over it, above Home's scrolling content. */
export function SkyTarget({
	phase,
	width,
	onPress
}: {
	phase: ReturnType<typeof useSkyPhase>
	width: number
	onPress: () => void
}) {
	const body = skyBodyAt(phase)
	const night = phase === 'night'
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={night ? 'Moon, night sky' : `Sun, ${phase} sky`}
			accessibilityHint="Your pet says something about it"
			style={[s.target, { left: body.x * width - SKY_TARGET / 2, top: body.y - SKY_TARGET / 2 }]}
		/>
	)
}

const s = StyleSheet.create({
	target: { position: 'absolute', width: SKY_TARGET, height: SKY_TARGET }
})
