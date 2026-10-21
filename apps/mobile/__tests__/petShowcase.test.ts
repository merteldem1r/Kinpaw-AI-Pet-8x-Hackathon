/**
 * The pets on Create · Start's "Make your own" card show what anyone can build: each is a valid
 * look for its species, uses no Kinpaw Plus option, and each card's four are different coats.
 */
import { appearanceSchema, premiumOptionsIn } from '@app/contract'
import { SHOWCASE } from '@/lib/petShowcase'

describe('the Make your own showcase', () => {
	for (const species of ['cat', 'dog'] as const) {
		describe(species, () => {
			const looks = SHOWCASE[species]

			it('has four looks of its own species', () => {
				expect(looks).toHaveLength(4)
				for (const look of looks) expect(look.species).toBe(species)
			})

			it('shows only looks the contract accepts', () => {
				for (const look of looks) expect(appearanceSchema.safeParse(look).success).toBe(true)
			})

			it('uses no Kinpaw Plus option, so anyone can build what it shows', () => {
				for (const look of looks) expect(premiumOptionsIn(look)).toEqual([])
			})

			it('gives each look its own fur, since the swatches are keyed by it', () => {
				expect(new Set(looks.map((look) => look.fur)).size).toBe(looks.length)
			})
		})
	}
})
