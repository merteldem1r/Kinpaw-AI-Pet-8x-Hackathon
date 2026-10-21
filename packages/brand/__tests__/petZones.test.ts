/**
 * Where a touch lands (docs/application/features/v3-pet-looks-requirements.md, R7): on every
 * kind of pet, each part is found where it is drawn, and a point on the screen maps to the pet.
 */
import { describe, expect, it } from '@jest/globals'
import {
	ATTRIBUTE_KEYS,
	LOOKS,
	optionsFor,
	randomAppearance,
	SPECIES,
	withAttribute,
	type PetAppearance
} from '@app/contract'
import { petParts, toPetSpace, zoneAt } from '../index'

/** Every option of every attribute, on both species, and the ready-made looks. */
const PETS: PetAppearance[] = [
	...LOOKS.map((look) => look.appearance),
	...SPECIES.flatMap((species) => {
		const base = randomAppearance(species, { random: () => 0 })
		return ATTRIBUTE_KEYS.flatMap((key) =>
			optionsFor(key, species).map((option) => withAttribute(base, key, option.id))
		)
	})
]

/** The middle of a polygon's points. */
const centreOf = (points: string) => {
	const corners = points.split(' ').map((pair) => pair.split(',').map(Number))
	const x = corners.reduce((sum, [cx]) => sum + cx!, 0) / corners.length
	const y = corners.reduce((sum, [, cy]) => sum + cy!, 0) / corners.length
	return { x, y }
}

describe('zoneAt', () => {
	it('finds the nose, the chin, the head, a paw, the belly and the back where they are drawn', () => {
		for (const pet of PETS) {
			const p = petParts(pet)
			expect(zoneAt(p, 0, -33)).toBe('nose')
			// Low on the muzzle, under the mouth.
			expect(zoneAt(p, 0, p.muzzle.cy + p.muzzle.ry * 0.7)).toBe('chin')
			// The forehead, between the eyes and the top of the head.
			expect(zoneAt(p, 0, p.head.cy - p.head.r * 0.7)).toBe('head')
			for (const paw of p.paws) expect(zoneAt(p, paw.cx, paw.cy)).toBe('paw')
			expect(zoneAt(p, p.belly.cx, p.belly.cy)).toBe('belly')
			// The flank, beside the belly, under the head.
			expect(zoneAt(p, -(p.body.rx - 3), p.body.cy)).toBe('back')
		}
	})

	it("finds each ear: a cat's above its head, a dog's where it hangs", () => {
		for (const pet of PETS) {
			const p = petParts(pet)
			if (p.catEars) {
				for (const outer of p.catEars.outer) {
					// Between the middle and the tip: clear of the head the ear stands behind.
					const { x, y } = centreOf(outer)
					expect(zoneAt(p, x, y - 4)).toBe('ear')
				}
			} else {
				const ears = { floppy: [26, -42], button: [19, -60], rose: [28, -49] } as const
				const at = p.dogEars === 'perky' || p.dogEars === 'bat' ? null : ears[p.dogEars!]
				const [x, y] = at ?? [p.dogEars === 'bat' ? 19 : 21, p.dogEars === 'bat' ? -62 : -58]
				expect(zoneAt(p, x, y)).toBe('ear')
				expect(zoneAt(p, -x, y)).toBe('ear')
			}
		}
	})

	it('finds a long tail at its tip, beside the body', () => {
		for (const pet of PETS) {
			const p = petParts(withAttribute(pet, 'tail', 'long'))
			// The long tail's tip (PET_PATHS.tailLong ends at 46 -12), moved for a Tiny body.
			expect(zoneAt(p, 46 + p.tail.x, -12)).toBe('tail')
		}
	})

	it('treats a touch beside the pet as its back', () => {
		const p = petParts(LOOKS[0]!.appearance)
		expect(zoneAt(p, -70, 30)).toBe('back')
	})
})

describe('toPetSpace', () => {
	it("maps the screen to the pet: the drawing's centre, at any size", () => {
		// translate(96 118) scale(1.25) in a 200-unit box: the pet's origin is at (96, 118).
		for (const size of [200, 260, 130]) {
			const k = size / 200
			const origin = toPetSpace(96 * k, 118 * k, size)
			expect(origin.x).toBeCloseTo(0)
			expect(origin.y).toBeCloseTo(0)
			const nose = toPetSpace((96 + 0 * 1.25) * k, (118 - 33 * 1.25) * k, size)
			expect(nose.y).toBeCloseTo(-33)
		}
	})
})
