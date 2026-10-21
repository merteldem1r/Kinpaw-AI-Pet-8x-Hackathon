/**
 * What a care action shows beside the pet's head (m5-home-core-loop-requirements.md, Decision 6):
 * at most one change per side, the biggest, and only one the eye would notice.
 */
import { careEffectsFor } from '@/lib/petEffects'

const full = { hunger: 90, happiness: 90, energy: 90, affection: 90 }

const ids = () => {
	let id = 0
	return () => ++id
}

describe('careEffectsFor', () => {
	it("shows Play's rise and fall, each on its need's side", () => {
		const effects = careEffectsFor(
			{ ...full, happiness: 50 },
			{ ...full, happiness: 70, energy: 75 },
			ids()
		)
		expect(effects).toEqual(
			expect.arrayContaining([
				{ id: expect.any(Number), need: 'happiness', up: true, side: 'right' },
				{ id: expect.any(Number), need: 'energy', up: false, side: 'left' }
			])
		)
		expect(effects).toHaveLength(2)
	})

	it('keeps only the biggest change on a side', () => {
		const effects = careEffectsFor(
			{ ...full, hunger: 40, energy: 80 },
			{ ...full, hunger: 90, energy: 70 },
			ids()
		)
		expect(effects).toEqual([{ id: 1, need: 'hunger', up: true, side: 'left' }])
	})

	it('leaves a change too small to notice to the pills', () => {
		expect(careEffectsFor(full, { ...full, happiness: 92, affection: 88 }, ids())).toEqual([])
	})
})
