import { litHints } from '../lib/introHints'

// The intro's hint chips light up as each topic is said (the spec, "Tell me about you (v2)").
// A miss only leaves a chip unlit, so these check the common ways people say each thing, and that
// ordinary words don't light the wrong one.

describe('litHints', () => {
	it('nothing said, nothing lit', () => {
		expect(litHints('')).toEqual([])
		expect(litHints('hello there')).toEqual([])
	})

	it('a full introduction lights every hint, in the chips order', () => {
		expect(
			litHints(
				"I'm Ece, I study medicine in Istanbul and I have a golden retriever called Kara. I love painting and my exam is on Friday"
			)
		).toEqual(['name', 'studyWork', 'pets', 'hobbies', 'comingUp'])
	})

	it('a name needs a capital after "I am", so a mood is not a name', () => {
		expect(litHints("I'm Mert")).toEqual(['name'])
		expect(litHints('my name is mert')).toEqual(['name'])
		// Mert's first try, 2026-10-04: a sentence's capital "My" missed it.
		expect(litHints("My name is Matthew. I'm studying computer engineering.")).toEqual([
			'name',
			'studyWork'
		])
		expect(litHints('call me Sam')).toEqual(['name'])
		expect(litHints("I'm tired")).toEqual([])
		expect(litHints('i am happy')).toEqual([])
	})

	it('whole words only: "category" is not a cat, "worker" is not work', () => {
		expect(litHints('that category')).toEqual([])
		expect(litHints('cats and dogs')).toEqual(['pets'])
		expect(litHints('a hard worker')).toEqual([])
	})

	it('something coming up, by day or by event', () => {
		expect(litHints('my interview is next week')).toEqual(['comingUp'])
		expect(litHints('see you on Tuesday')).toEqual(['comingUp'])
	})
})
