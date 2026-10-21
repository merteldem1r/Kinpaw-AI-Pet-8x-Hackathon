import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { lookById, type Mood } from '@app/contract'
import { PetArt } from '@/components/pet/PetArt'
import { PetBubble } from '@/components/pet/PetBubble'
import { ReactionBursts } from '@/components/pet/ReactionBursts'
import { RiseAndBreathe } from '@/components/pet/RiseAndBreathe'
import { draftAppearance, type PetDraft } from '@/lib/petDraft'
import type { Burst } from '@/lib/petEffects'

// The pet on the sign-in sheet's edge (kinpaw-screen-spec-v1.md, "Save Mochi and sign in"): the
// pet being saved, with its bubble; or for Welcome back, Welcome's three pets and no bubble.

/** Where the sheet's edge is (the pets sit on it), pt from the top. */
export const SHEET_EDGE = 340
const PET_SIZE = 184
const TRIO_SIDE = 104
const TRIO_CENTRE = 140
/** The art's empty margin under the feet, as a share of its height. */
const UNDER_FEET = 0.061
/** The body's centre across the art, and where the pet stands across the screen. */
const BODY_CENTRE = 0.48
const PET_AT = 0.36
/** The bubble starts this far across the art (clear of the head and ears) and ends this high
 * above the feet (clear of the tail), as shares of the pet's size. */
const BUBBLE_FROM = 0.74
const BUBBLE_ABOVE_FEET = 0.5
const BUBBLE_MARGIN = 16
const BUBBLE_MAX = 176

type Props = {
	/** The pet being saved; null for Welcome back. */
	saving: PetDraft | null
	name: string
	mood: Mood
	line: string
	hearts: Burst[]
}

export function SheetPets({ saving, name, mood, line, hearts }: Props) {
	const { width } = useWindowDimensions()
	const petLeft = width * PET_AT - PET_SIZE * BODY_CENTRE
	const bubbleLeft = petLeft + PET_SIZE * BUBBLE_FROM

	return (
		<View style={s.layer} pointerEvents="none">
			{saving ? (
				<>
					<RiseAndBreathe style={[s.pet, { left: petLeft }]}>
						<PetArt
							appearance={draftAppearance(saving)}
							mood={mood}
							size={PET_SIZE}
							shadow={false}
							label={`${name}, ${mood}`}
						/>
						<ReactionBursts bursts={hearts} size={PET_SIZE} />
					</RiseAndBreathe>
					<PetBubble
						compact
						line={line}
						style={[
							s.bubble,
							{
								left: bubbleLeft,
								maxWidth: Math.min(BUBBLE_MAX, width - bubbleLeft - BUBBLE_MARGIN)
							}
						]}
					/>
				</>
			) : (
				<View
					style={s.trio}
					accessible
					accessibilityRole="image"
					accessibilityLabel="Three pets waiting together: a tuxedo cat, a ginger cat and a golden dog"
				>
					<RiseAndBreathe delay={90} breatheOffset={1460}>
						<PetArt
							appearance={lookById('tuxedo').appearance}
							mood="content"
							size={TRIO_SIDE}
							shadow={false}
						/>
					</RiseAndBreathe>
					<RiseAndBreathe style={s.trioCentre}>
						<PetArt
							appearance={lookById('ginger').appearance}
							mood="happy"
							size={TRIO_CENTRE}
							shadow={false}
						/>
					</RiseAndBreathe>
					<RiseAndBreathe delay={180} breatheOffset={2930}>
						<PetArt
							appearance={lookById('biscuit').appearance}
							mood="content"
							size={TRIO_SIDE}
							shadow={false}
						/>
					</RiseAndBreathe>
				</View>
			)}
		</View>
	)
}

const s = StyleSheet.create({
	// The pets stand on the sheet's edge, drawn above it; the layer ends at the edge.
	layer: { position: 'absolute', top: 0, left: 0, right: 0, height: SHEET_EDGE, zIndex: 2 },
	pet: { position: 'absolute', bottom: -PET_SIZE * UNDER_FEET },
	bubble: { position: 'absolute', bottom: PET_SIZE * BUBBLE_ABOVE_FEET },
	trio: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: -TRIO_CENTRE * UNDER_FEET,
		flexDirection: 'row',
		alignItems: 'flex-end',
		justifyContent: 'center'
	},
	trioCentre: { marginHorizontal: -32, zIndex: 1 }
})
