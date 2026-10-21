/**
 * How the pet's parts move (docs/application/features/v3-pet-looks-requirements.md, R3–R5): a
 * cat and a dog move their tails as their species does, ears droop when sad, and nothing turns
 * so far that a part comes away from the pet.
 */
import {
	CAT_EAR_IDS,
	DOG_EAR_IDS,
	MOODS,
	SPECIES,
	TAIL_IDS,
	type Mood,
	type Species
} from '@app/contract'
import { earMotion, tailMotion } from '@/lib/petMotion'

/** The furthest any part may turn from where it is drawn, degrees: past it, the joint shows. */
const MAX_TURN = 25

describe('tailMotion', () => {
	/** A long tail's motion: the tail every species' numbers are written for. */
	const every = (species: Species, mood: Mood) => tailMotion({ species, tail: 'long' }, mood)

	// Mert, 2026-10-09: a happy dog's tail wagging fast all the time looked wrong. A fast wag is a
	// burst; between bursts, the tail moves slowly or not at all.
	it('never moves a tail fast between bursts', () => {
		for (const species of SPECIES) {
			for (const tail of TAIL_IDS) {
				for (const mood of MOODS) {
					const { calm } = tailMotion({ species, tail }, mood)
					if (calm.swing > 0) expect(calm.halfMs).toBeGreaterThanOrEqual(800)
				}
			}
		}
	})

	it("wags a happy dog's tail in bursts, wider and more often than a content dog's", () => {
		const happy = every('dog', 'happy').burst!
		const content = every('dog', 'content').burst!
		expect(happy.swing).toBeGreaterThan(content.swing)
		expect(happy.every[1]).toBeLessThan(content.every[0])
		expect(happy.halfMs).toBeLessThan(300)
		expect(happy.count[0]).toBeGreaterThan(0)
	})

	it("holds a happy cat's tail up, the tip quivering in small bursts", () => {
		const happy = every('cat', 'happy')
		expect(happy.rest).toBeLessThan(0)
		expect(happy.burst!.swing).toBeLessThan(every('cat', 'content').calm.swing)
	})

	it('hangs the tail when sad, rests it still when sleepy, and never wags then', () => {
		for (const species of SPECIES) {
			expect(every(species, 'sad').rest).toBeGreaterThan(0)
			expect(every(species, 'sad').burst).toBeNull()
			expect(every(species, 'sleepy').calm.swing).toBe(0)
			expect(every(species, 'sleepy').burst).toBeNull()
		}
	})

	it('moves a bobtail less than a long tail', () => {
		const long = tailMotion({ species: 'dog', tail: 'long' }, 'happy')
		const bob = tailMotion({ species: 'dog', tail: 'bob' }, 'happy')
		expect(bob.burst!.swing).toBeLessThan(long.burst!.swing)
		expect(bob.calm.swing).toBeLessThan(long.calm.swing)
	})

	it('never turns a tail far enough to come away from the body', () => {
		for (const species of SPECIES) {
			for (const tail of TAIL_IDS) {
				for (const mood of MOODS) {
					const { rest, calm, burst } = tailMotion({ species, tail }, mood)
					const widest = Math.max(calm.swing, burst?.swing ?? 0)
					expect(Math.abs(rest) + widest).toBeLessThanOrEqual(MAX_TURN)
					if (burst) expect(burst.every[0]).toBeGreaterThan(1000)
				}
			}
		}
	})
})

describe('earMotion', () => {
	const allEars = [...CAT_EAR_IDS, ...DOG_EAR_IDS]

	it('droops the ears when sad, more than when sleepy, and not when content', () => {
		for (const ears of allEars) {
			const sad = earMotion({ ears }, 'sad').rest
			expect(sad).toBeGreaterThan(earMotion({ ears }, 'sleepy').rest)
			expect(earMotion({ ears }, 'content').rest).toBe(0)
		}
	})

	it('pricks the ears in and up to perk, and twitches them outward', () => {
		for (const ears of allEars) {
			const motion = earMotion({ ears }, 'content')
			expect(motion.perk).toBeLessThan(0)
			expect(motion.twitch).toBeGreaterThan(0)
		}
	})

	it('moves hanging ears less by mood, and throws them further in a hop', () => {
		const pointy = earMotion({ ears: 'pointy' }, 'sad')
		const floppy = earMotion({ ears: 'floppy' }, 'sad')
		expect(floppy.rest).toBeLessThan(pointy.rest)
		expect(floppy.hopSwing).toBeGreaterThan(pointy.hopSwing)
	})

	it('never turns an ear far enough to come away from the head', () => {
		for (const ears of allEars) {
			for (const mood of MOODS) {
				const m = earMotion({ ears }, mood)
				expect(Math.abs(m.rest) + Math.max(m.twitch, m.hopSwing)).toBeLessThanOrEqual(MAX_TURN)
				expect(Math.abs(m.perk)).toBeLessThanOrEqual(MAX_TURN)
			}
		}
	})
})
