/**
 * Home's lines (docs/application/UI/kinpaw-screen-spec-v1.md, "Header and
 * bubble lines"): the lowest need picks header and bubble, all good wins at 70
 * and up, reactions cycle, cat and dog differ where the spec says, and the
 * eyebrow names the weekday and the part of day.
 */
import type { Needs } from '@app/contract'
import {
	cantHelpLine,
	eyebrowLine,
	headerLine,
	needsLine,
	reactionLine,
	hugLine,
	returnLine,
	strokeLine,
	tapLine,
	touchLine
} from '@/lib/petLines'
import { ZONES } from '@app/brand'

const base: Needs = { hunger: 60, happiness: 60, energy: 60, affection: 60 }

describe('header and bubble', () => {
	it('speak about the lowest need', () => {
		expect(headerLine({ ...base, affection: 20 }, 'Mochi')).toBe('Mochi missed you')
		expect(needsLine({ ...base, affection: 20 }, 'cat')).toBe("You're back! I kept your spot warm.")
		expect(headerLine({ ...base, hunger: 20 }, 'Mochi')).toBe("Mochi's tummy is rumbling")
		expect(headerLine({ ...base, energy: 20 }, 'Mochi')).toBe("Mochi's getting sleepy")
		expect(headerLine({ ...base, happiness: 20 }, 'Mochi')).toBe("Mochi's a little bored")
	})

	it('break a tie towards missing you', () => {
		expect(headerLine(base, 'Mochi')).toBe('Mochi missed you')
	})

	it('are all good at 70 and up, with a cat and a dog line', () => {
		const good: Needs = { hunger: 70, happiness: 90, energy: 70, affection: 100 }
		expect(headerLine(good, 'Biscuit')).toBe("Biscuit's happy you're here")
		expect(needsLine(good, 'cat')).toMatch(/other cats/)
		expect(needsLine(good, 'dog')).toMatch(/tail/)
		expect(headerLine({ ...good, hunger: 69 }, 'Biscuit')).toBe("Biscuit's tummy is rumbling")
	})
})

describe('reactions', () => {
	it('cycle through each action’s lines', () => {
		expect(reactionLine('feed', 'cat', 0)).toBe('Mmm. Crunchy. Thank you.')
		expect(reactionLine('feed', 'cat', 3)).toBe('Mmm. Crunchy. Thank you.')
		expect(reactionLine('play', 'dog', 1)).toBe('I almost caught it. Almost.')
	})

	it('differ for cat and dog on the third Pet', () => {
		expect(reactionLine('pet', 'cat', 2)).toMatch(/purred/)
		expect(reactionLine('pet', 'dog', 2)).toMatch(/wagging/)
	})

	it("have a line for an action that can't help", () => {
		expect(cantHelpLine('feed', 'cat', 0)).toBe("I couldn't eat another bite.")
		expect(cantHelpLine('play', 'cat', 0)).toBe('Too sleepy to play. Tomorrow?')
	})
})

describe('tapping the pet', () => {
	it('never says the same line twice in a row', () => {
		let previous: string | null = null
		for (let i = 0; i < 50; i++) {
			const line = tapLine(previous)
			expect(line).not.toBe(previous)
			previous = line
		}
	})
})

describe('the eyebrow', () => {
	it('is the weekday and the part of day, by local clock hours', () => {
		// 1 October 2026 is a Thursday.
		expect(eyebrowLine(new Date(2026, 9, 1, 8, 0))).toBe('Thursday morning')
		expect(eyebrowLine(new Date(2026, 9, 1, 12, 0))).toBe('Thursday afternoon')
		expect(eyebrowLine(new Date(2026, 9, 1, 17, 0))).toBe('Thursday evening')
		expect(eyebrowLine(new Date(2026, 9, 1, 23, 30))).toBe('Thursday night')
	})
})

describe('the return line ("I missed you")', () => {
	const first = () => 0
	const last = () => 0.99

	it('says nothing under 6 hours with nothing to ask', () => {
		expect(returnLine('none', null, 'cat', 'Mert')).toBeNull()
	})

	it('speaks for each bucket, with the name only when there is one', () => {
		for (const away of ['6-24h', '1-3d', '3d+'] as const) {
			expect(returnLine(away, null, 'cat', null, first)).toBeTruthy()
			expect(returnLine(away, null, 'dog', 'Mert Eldemir', last)).toMatch(/^Mert! /)
			// Without a name, a line with {you} is never picked, and {you} never shows.
			expect(returnLine(away, null, 'cat', null, last)).not.toContain('{you}')
		}
	})

	it('differs for cat and dog where the line does', () => {
		expect(returnLine('1-3d', null, 'cat', null, () => 0.5)).not.toBe(
			returnLine('1-3d', null, 'dog', null, () => 0.5)
		)
	})

	it('asks a due question, after any time away, with a lead by bucket', () => {
		const q = 'How did the exam go?'
		expect(returnLine('none', q, 'cat', null)).toBe('Oh, hi! How did the exam go?')
		expect(returnLine('1-3d', q, 'cat', 'Mert')).toBe('I missed you, Mert! How did the exam go?')
		expect(returnLine('3d+', q, 'dog', 'averyveryverylongusername')).toBe(
			'You came back! How did the exam go?'
		)
	})
})

// v3 pet looks (docs/application/features/v3-pet-looks-requirements.md, R7): where it is touched,
// it answers its own way.
describe('touch lines', () => {
	it('gives every zone its own lines, never the one it just said', () => {
		for (const species of ['cat', 'dog'] as const) {
			for (const zone of ZONES) {
				let previous: string | null = null
				for (let i = 0; i < 12; i++) {
					const line = touchLine(zone, species, previous)
					expect(line).not.toBe(previous)
					expect(line.length).toBeGreaterThan(0)
					previous = line
				}
			}
		}
	})

	it('says hello for a tap on its back, as a tap always did', () => {
		const always = () => 0
		expect(touchLine('back', 'cat', null, always)).toBe(tapLine(null, always))
	})

	it('says something different for a nose than for a paw', () => {
		const first = () => 0
		expect(touchLine('nose', 'dog', null, first)).not.toBe(touchLine('paw', 'dog', null, first))
	})

	it("has a cat's belly and a dog's belly say different things", () => {
		const first = () => 0
		expect(touchLine('belly', 'cat', null, first)).not.toBe(touchLine('belly', 'dog', null, first))
	})

	it('answers a chin scratch and a belly rub with their own stroke lines', () => {
		expect(strokeLine('cat', 0, 'chin')).not.toBe(strokeLine('cat', 0, 'head'))
		expect(strokeLine('dog', 0, 'belly')).not.toBe(strokeLine('dog', 0, 'back'))
		expect(strokeLine('cat', 0)).toBe(strokeLine('cat', 0, 'head'))
	})

	it('answers a hug, never the same way twice in a row', () => {
		let previous: string | null = null
		for (let i = 0; i < 6; i++) {
			const line = hugLine(previous)
			expect(line).not.toBe(previous)
			previous = line
		}
	})
})
