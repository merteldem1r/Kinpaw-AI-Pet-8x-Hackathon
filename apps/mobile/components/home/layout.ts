import { useState } from 'react'
import { StyleSheet, type LayoutChangeEvent } from 'react-native'
import { PET_STAGE_SIZE } from '@/components/pet/PetStage'

/**
 * Home's layout, shared by the room and its loading and error stand-ins, so all three keep the
 * pet, its need pills and the controls in the same place (docs/application/UI/
 * kinpaw-screen-spec-v1.md, "Home" and "Fitting the screen"). Home fits one screen: the stage
 * takes the height the header and the controls leave, and the pet is sized to it.
 */

/** The sky outside fills the top of Home, behind the header and the bubble. */
export const SKY_HEIGHT = 470
/**
 * Room above the pet for its bubble: three lines, the longest any line runs. The bubble is
 * anchored to the bottom of this space and grows upward, so a longer line never moves the pet.
 */
const BUBBLE_SPACE = 112
/** The empty top of the drawing above the ears; the bubble's tail may sit over it. */
export const PET_HEADROOM = 14
/** The lamp glow behind the pet in the evening and at night, pt across. */
export const GLOW_SIZE = 420
/** The pet's size on Home: as big as the stage allows, between these, pt. */
const PET_MAX = PET_STAGE_SIZE
const PET_MIN = 180

/** The pet's size for a stage this tall: what's left under the bubble's room, within bounds. */
function petSizeFor(stageHeight: number): number {
	return Math.round(Math.min(PET_MAX, Math.max(PET_MIN, stageHeight - BUBBLE_SPACE)))
}

/**
 * The pet's size on this screen, from the stage's measured height; null until it has been
 * measured, so the pet never draws at one size and jumps to another.
 */
export function useStageSize(): {
	petSize: number | null
	onLayout: (e: LayoutChangeEvent) => void
} {
	const [petSize, setPetSize] = useState<number | null>(null)
	return {
		petSize,
		onLayout: (e) => setPetSize(petSizeFor(e.nativeEvent.layout.height))
	}
}

/** The pet and the room kept above it for the bubble; centred in the stage. */
export function roomHeight(petSize: number): number {
	return BUBBLE_SPACE + petSize
}

/** The need pills sit level with the pet's lower half, a little above its feet. */
export function pillsBottom(petSize: number): number {
	return Math.round(petSize * 0.12)
}

export const homeLayout = StyleSheet.create({
	// Grows into whatever the screen leaves; never shorter than the smallest pet and its bubble.
	// Whatever the biggest pet doesn't use is shared above and below it, not all piled on top.
	stage: {
		flex: 1,
		minHeight: BUBBLE_SPACE + PET_MIN,
		justifyContent: 'center'
	},
	// The pet at the bottom with its bubble's room above; the bubble, pills, glow and bursts are
	// placed from its bottom edge.
	room: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
	// Two need pills a side, against the content's edges, over the pet's sides.
	pills: { position: 'absolute', gap: 10, zIndex: 1 },
	pillsLeft: { left: 0, alignItems: 'flex-start' },
	pillsRight: { right: 0, alignItems: 'flex-end' },
	// The error card, in the controls' place.
	panel: { gap: 22, marginTop: 4 },
	// The care row: three slim tiles.
	row: { flexDirection: 'row', gap: 12 }
})
