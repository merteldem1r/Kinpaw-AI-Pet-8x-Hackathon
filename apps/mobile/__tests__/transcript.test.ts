import { createTranscript, joinWords } from '../lib/transcript'

// What the mic heard in one session (lib/transcript.ts): iOS 18 starts a fresh transcript after a
// pause, and the words said before it must stay (Mert's first intro, 2026-10-04).

describe('createTranscript', () => {
	it('interim results replace each other', () => {
		const t = createTranscript()
		expect(t.add('My name', false)).toBe('My name')
		expect(t.add('My name is Matthew', false)).toBe('My name is Matthew')
	})

	it('after a pause, the next segment is added to what came before', () => {
		const t = createTranscript()
		t.add('My name is Matthew.', false)
		expect(t.add('My name is Matthew.', true)).toBe('My name is Matthew.')
		expect(t.add("I'm studying", false)).toBe("My name is Matthew. I'm studying")
		expect(t.add("I'm studying computer engineering.", true)).toBe(
			"My name is Matthew. I'm studying computer engineering."
		)
		expect(t.add('I love football', false)).toBe(
			"My name is Matthew. I'm studying computer engineering. I love football"
		)
	})

	it('a recognizer that keeps the whole transcript is not doubled', () => {
		const t = createTranscript()
		t.add('My name is Matthew.', true)
		expect(t.add("My name is Matthew. I'm studying", false)).toBe(
			"My name is Matthew. I'm studying"
		)
	})
})

describe('joinWords', () => {
	it('joins with one space, and leaves out an empty side', () => {
		expect(joinWords('a', 'b')).toBe('a b')
		expect(joinWords('', 'b')).toBe('b')
		expect(joinWords('a', '')).toBe('a')
	})
})
