// Which remembered facts reach the model, and which go when the memory is full
// (v2-memory-requirements.md, R5, R7, R9): a score in plain code, never "the newest six".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	isDue,
	isExpired,
	isSoon,
	likelyWorry,
	mentionsFact,
	soundsWorried,
	MEMORY_SCORE,
	memoriesToEvict,
	pickMemories,
	scoreMemory,
	type ScoredFact
} from '../../index'

const TODAY = '2026-10-10'
const NOW = new Date('2026-10-10T12:00:00Z')
const DAY = 86_400_000

type Fact = ScoredFact & { id: string }
const fact = (id: string, over: Partial<Fact> = {}): Fact => ({
	id,
	tags: [],
	kind: 'lasting',
	importance: 1,
	followUpOn: null,
	followedUpAt: null,
	lastUsedAt: new Date(NOW.getTime() - DAY),
	createdAt: new Date('2026-10-01T00:00:00Z'),
	...over
})

test('a tag said scores, plurals either way, at most two tags count', () => {
	const exam = fact('exam', { tags: ['exam', 'test', 'final'] })
	const base = scoreMemory(exam, 'hello', TODAY, NOW)
	assert.equal(scoreMemory(exam, 'My EXAMS are tomorrow', TODAY, NOW), base + MEMORY_SCORE.tagMatch)
	assert.equal(
		scoreMemory(exam, 'the final exam test', TODAY, NOW),
		base + MEMORY_SCORE.tagMatch * MEMORY_SCORE.tagMatchesMax
	)
	assert.equal(
		scoreMemory(fact('x', { tags: ['ice cream'] }), 'I want ice cream!', TODAY, NOW),
		base + MEMORY_SCORE.tagMatch
	)
	assert.equal(scoreMemory(exam, 'examination', TODAY, NOW), base, 'a word part is not the tag')
})

test('importance, unused for days, and used just now', () => {
	assert.equal(
		scoreMemory(fact('a', { importance: 2 }), '', TODAY, NOW) -
			scoreMemory(fact('b', { importance: 0 }), '', TODAY, NOW),
		2
	)
	const old = fact('old', { lastUsedAt: new Date(NOW.getTime() - 4 * DAY) })
	const never = fact('never', { lastUsedAt: null })
	const fresh = fact('fresh', { lastUsedAt: new Date(NOW.getTime() - 10 * 60_000) })
	const base = scoreMemory(fact('base'), '', TODAY, NOW)
	assert.equal(scoreMemory(old, '', TODAY, NOW), base + MEMORY_SCORE.unused)
	assert.equal(scoreMemory(never, '', TODAY, NOW), base + MEMORY_SCORE.unused)
	assert.equal(scoreMemory(fresh, '', TODAY, NOW), base + MEMORY_SCORE.recent)
})

test('an event is due from its day until it is followed up, and expires 14 days after', () => {
	const exam = fact('exam', { kind: 'event', followUpOn: '2026-10-09' })
	assert.ok(isDue(exam, TODAY))
	assert.ok(isDue({ ...exam, followUpOn: TODAY }, TODAY))
	assert.equal(isDue({ ...exam, followUpOn: '2026-10-11' }, TODAY), false)
	assert.equal(isDue({ ...exam, followedUpAt: NOW }, TODAY), false)
	assert.equal(isDue(fact('lasting'), TODAY), false)
	assert.equal(
		scoreMemory(exam, '', TODAY, NOW) -
			scoreMemory({ ...exam, followUpOn: '2026-10-11' }, '', TODAY, NOW),
		MEMORY_SCORE.due
	)

	assert.equal(isExpired({ ...exam, followUpOn: '2026-09-26' }, TODAY), false, 'day 14')
	assert.ok(isExpired({ ...exam, followUpOn: '2026-09-25' }, TODAY), 'day 15')
	assert.equal(isExpired(fact('lasting'), TODAY), false)
})

test('the pick: what was said first, then due, then importance; never the newest six', () => {
	const sister = fact('sister', {
		importance: 2,
		tags: ['sister', 'ece'],
		createdAt: new Date('2026-09-01')
	})
	const exam = fact('exam', { tags: ['exam'], kind: 'event', followUpOn: '2026-10-09' })
	const sushi = fact('sushi', { importance: 1, tags: ['sushi'] })
	const newer = Array.from({ length: 6 }, (_, i) =>
		fact(`new${i}`, { importance: 0, createdAt: new Date(`2026-10-0${i + 2}T00:00:00Z`) })
	)
	const picked = pickMemories([sister, exam, sushi, ...newer], 'I want sushi', TODAY, NOW).map(
		(f) => f.id
	)
	assert.deepEqual(picked.slice(0, 3), ['sushi', 'exam', 'sister'])
	assert.equal(picked.length, 6)
	assert.ok(picked.includes('sister'), 'six newer facts do not push out a sister')
})

test('ties go to the newer fact; expired events are never picked', () => {
	const older = fact('older', { createdAt: new Date('2026-09-01') })
	const newer = fact('newer', { createdAt: new Date('2026-10-05') })
	const expired = fact('expired', {
		kind: 'event',
		followUpOn: '2026-09-01',
		importance: 2,
		tags: ['trip']
	})
	assert.deepEqual(
		pickMemories([older, newer, expired], 'my trip', TODAY, NOW).map((f) => f.id),
		['newer', 'older']
	)
	assert.deepEqual(
		pickMemories([older, newer], '', TODAY, NOW, 1).map((f) => f.id),
		['newer']
	)
})

test('full: the lowest worth goes, ties to the older; nothing goes with room', () => {
	const keep = fact('keep', { importance: 2 })
	const small = fact('small', { importance: 0, createdAt: new Date('2026-10-05') })
	const smallOlder = fact('smallOlder', { importance: 0, createdAt: new Date('2026-09-05') })
	const facts = [keep, small, smallOlder]
	assert.deepEqual(
		memoriesToEvict(facts, 3, 1, TODAY, NOW).map((f) => f.id),
		['smallOlder']
	)
	assert.deepEqual(
		memoriesToEvict(facts, 2, 1, TODAY, NOW).map((f) => f.id),
		['smallOlder', 'small']
	)
	assert.deepEqual(memoriesToEvict(facts, 4, 1, TODAY, NOW), [])
	assert.deepEqual(memoriesToEvict(facts, 30, 8, TODAY, NOW), [])
})

test('over the cap after Plus ends: new facts evict until it is back at the cap (R8)', () => {
	const facts = Array.from({ length: 35 }, (_, i) => fact(`f${i}`, { importance: i % 3 }))
	assert.equal(memoriesToEvict(facts, 30, 1, TODAY, NOW).length, 6)
})

test('worried words, an event coming up, and which one it is most likely about', () => {
	for (const said of ["I'm a bit nervous today", 'so stressed', 'I am worried', "I can't sleep"]) {
		assert.ok(soundsWorried(said), said)
	}
	for (const said of ['I had a nice dinner', 'hello', 'the stressball is red']) {
		assert.equal(soundsWorried(said), false, said)
	}
	const soon = (id: string, followUpOn: string, over: Partial<Fact> = {}) =>
		fact(id, { kind: 'event', followUpOn, ...over })
	assert.ok(isSoon(soon('a', TODAY), TODAY))
	assert.ok(isSoon(soon('a', '2026-10-12'), TODAY))
	assert.equal(isSoon(soon('a', '2026-10-13'), TODAY), false, 'three days out')
	assert.equal(isSoon(soon('a', '2026-10-09'), TODAY), false, 'already past')
	assert.equal(isSoon(soon('a', TODAY, { followedUpAt: NOW }), TODAY), false)

	const exam = soon('exam', '2026-10-11')
	const trip = soon('trip', '2026-10-12', { importance: 2 })
	assert.equal(likelyWorry([trip, exam], 'so nervous', TODAY)?.id, 'exam', 'the nearest')
	assert.equal(likelyWorry([trip, exam], 'hello', TODAY), null)
	assert.equal(likelyWorry([fact('lasting')], 'so nervous', TODAY), null)

	const base = scoreMemory(exam, 'hello', TODAY, NOW)
	assert.equal(scoreMemory(exam, "I'm nervous", TODAY, NOW), base + MEMORY_SCORE.tagMatch)
})

test('a reply mentions a fact by a tag or a real word of it, plurals either way', () => {
	const exam = { text: 'Has an exam on Friday', tags: ['exam', 'test'] }
	assert.ok(mentionsFact('How did the exam go?', exam))
	assert.ok(mentionsFact('Good luck with your tests!', exam))
	assert.ok(mentionsFact('Is it Friday already?', exam))
	assert.equal(mentionsFact('Purr! Tell me everything.', exam), false)
	assert.equal(
		mentionsFact('He has a toy', { text: 'Has a dog called Kara', tags: ['kara'] }),
		false,
		'plain words'
	)
	assert.ok(mentionsFact('Say hi to Kara for me', { text: 'Has a dog called Kara', tags: ['dog'] }))
})
