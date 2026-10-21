/**
 * A pet under the sky outside right now, breathing, with its mood on a glass pill: the hero of a
 * pet's page, your own (app/pet/[id].tsx) or a friend's (app/friends/[id].tsx).
 */
import { useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { art } from '@app/brand'
import { describeAppearance, type Mood, type PetAppearance } from '@app/contract'
import { PetArt } from '@/components/pet/PetArt'
import { RiseAndBreathe } from '@/components/pet/RiseAndBreathe'
import { RoomGlow } from '@/components/pet/RoomGlow'
import { SkyScene } from '@/components/pet/SkyScene'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { useSkyPhase } from '@/lib/sky'

/** The hero's height, for a loading skeleton of the same size. */
export const HERO_HEIGHT = 290
const HERO_PET = 220
/** The sun or moon in the hero: upper right, clear of the pet. */
const HERO_BODY = { x: 0.84, y: 62 }
export const MOOD_LINE: Record<Mood, string> = {
	happy: 'Feeling happy',
	content: 'Feeling content',
	sad: 'Feeling a bit low',
	sleepy: 'Feeling sleepy'
}

export function PetHero({
	name,
	appearance,
	mood
}: {
	name: string
	appearance: PetAppearance
	mood: Mood
}) {
	const { colors: c, radii } = useTheme()
	const phase = useSkyPhase()
	const [width, setWidth] = useState(0)
	const night = phase === 'evening' || phase === 'night'
	return (
		<View
			onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
			style={[s.hero, { borderRadius: radii.card + 6, borderColor: c.borderGlass }]}
			accessible
			accessibilityRole="image"
			accessibilityLabel={`${name}, ${describeAppearance(appearance, mood)}`}
		>
			<LinearGradient colors={art.sky[phase].stops} style={StyleSheet.absoluteFill} />
			{width > 0 ? (
				<SkyScene phase={phase} width={width} height={HERO_HEIGHT} body={HERO_BODY} />
			) : null}
			{night ? (
				<View style={s.heroGlow} pointerEvents="none">
					<RoomGlow size={340} />
				</View>
			) : null}
			<RiseAndBreathe style={s.heroPet}>
				<PetArt appearance={appearance} mood={mood} size={HERO_PET} />
			</RiseAndBreathe>
			<View style={[s.moodPill, { backgroundColor: c.surface2, borderColor: c.borderGlass }]}>
				<View style={[s.moodDot, { backgroundColor: c.brandInk }]} />
				<Text variant="caption" style={{ color: c.textPrimary }}>
					{MOOD_LINE[mood]}
				</Text>
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	hero: {
		height: HERO_HEIGHT,
		overflow: 'hidden',
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: 'center',
		justifyContent: 'flex-end'
	},
	heroGlow: { position: 'absolute', bottom: HERO_PET / 2 - 170, alignSelf: 'center' },
	heroPet: { marginBottom: 4 },
	moodPill: {
		position: 'absolute',
		top: 14,
		left: 14,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		paddingHorizontal: 10,
		paddingVertical: 5,
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth
	},
	moodDot: { width: 6, height: 6, borderRadius: 3 }
})
