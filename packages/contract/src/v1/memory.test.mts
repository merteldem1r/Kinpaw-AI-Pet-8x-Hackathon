// Long-term memory's rules (v2-memory-requirements.md, R1–R4, R11): what a fact may be, what is
// never kept, and the dates. The server keeps only what `checkFact` returns, so a gap here is a
// sensitive fact stored.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	addDays,
	checkFact,
	daysBetween,
	FOLLOW_UP_DEFAULT_DAYS,
	FOLLOW_UP_MAX_DAYS,
	isSensitive,
	localWeekday,
	MEMORY_TAGS_MAX,
	MEMORY_TEXT_MAX,
	nextDays,
	normaliseFact,
	saysUnder13,
	type ProposedMemory
} from '../../index'

const TODAY = '2026-10-03'

const lasting = (over: Partial<ProposedMemory> = {}): ProposedMemory => ({
	text: 'Has a sister called Ece',
	follow_up: '',
	category: 'family',
	kind: 'lasting',
	importance: 2,
	tags: ['sister', 'ece', 'family'],
	follow_up_on: '',
	...over
})

const event = (over: Partial<ProposedMemory> = {}): ProposedMemory => ({
	text: 'Has an exam on Friday',
	follow_up: 'How did the exam go?',
	category: 'study',
	kind: 'event',
	importance: 1,
	tags: ['exam', 'test', 'school'],
	follow_up_on: '2026-10-09',
	...over
})

test('a lasting fact is kept as it was proposed, with no follow-up', () => {
	assert.deepEqual(checkFact(lasting(), TODAY), {
		text: 'Has a sister called Ece',
		followUp: null,
		category: 'family',
		kind: 'lasting',
		importance: 2,
		tags: ['sister', 'ece', 'family'],
		followUpOn: null
	})
})

test('a lasting fact drops a follow-up the model wrote anyway', () => {
	const kept = checkFact(lasting({ follow_up: 'How is Ece?', follow_up_on: '2026-10-05' }), TODAY)
	assert.equal(kept?.followUp, null)
	assert.equal(kept?.followUpOn, null)
})

test('an event keeps its date and question', () => {
	const kept = checkFact(event(), TODAY)
	assert.equal(kept?.followUpOn, '2026-10-09')
	assert.equal(kept?.followUp, 'How did the exam go?')
})

test('an event with no date, today or a passed day gets the default', () => {
	const fallback = addDays(TODAY, FOLLOW_UP_DEFAULT_DAYS)
	for (const followUpOn of ['', 'friday', TODAY, '2026-09-30']) {
		assert.equal(
			checkFact(event({ follow_up_on: followUpOn }), TODAY)?.followUpOn,
			fallback,
			followUpOn
		)
	}
	assert.equal(
		checkFact(event({ follow_up_on: addDays(TODAY, FOLLOW_UP_MAX_DAYS) }), TODAY)?.followUpOn,
		addDays(TODAY, FOLLOW_UP_MAX_DAYS)
	)
})

test('an event further ahead than the follow-up window is kept as a lasting fact', () => {
	const kept = checkFact(
		event({ text: 'Training for a marathon in April', follow_up_on: '2027-04-18' }),
		TODAY
	)
	assert.equal(kept?.kind, 'lasting')
	assert.equal(kept?.followUpOn, null)
	assert.equal(kept?.followUp, null)
})

test('the calendar: the next days with their weekdays, across a month end', () => {
	assert.deepEqual(nextDays('2026-10-03', 2), [
		{ date: '2026-10-04', weekday: 'Sunday' },
		{ date: '2026-10-05', weekday: 'Monday' }
	])
	assert.deepEqual(nextDays('2026-10-30', 3).at(-1), { date: '2026-11-02', weekday: 'Monday' })
})

test('an event keeps itself without a usable question', () => {
	assert.equal(checkFact(event({ follow_up: '' }), TODAY)?.followUp, null)
	assert.equal(
		checkFact(event({ follow_up: 'x'.repeat(MEMORY_TEXT_MAX + 1) }), TODAY)?.followUp,
		null
	)
})

test('an empty or too long fact is not kept', () => {
	assert.equal(checkFact(lasting({ text: '   ' }), TODAY), null)
	assert.equal(checkFact(lasting({ text: 'x'.repeat(MEMORY_TEXT_MAX + 1) }), TODAY), null)
	assert.ok(checkFact(lasting({ text: 'x'.repeat(MEMORY_TEXT_MAX) }), TODAY))
})

test('spacing is tidied before the length is measured', () => {
	assert.equal(
		checkFact(lasting({ text: '  Has   a dog\ncalled Kara ' }), TODAY)?.text,
		'Has a dog called Kara'
	)
})

test('an importance outside 0–2 is not kept', () => {
	assert.equal(checkFact(lasting({ importance: 3 }), TODAY), null)
	assert.equal(checkFact(lasting({ importance: 1.5 }), TODAY), null)
})

test('tags are lowercased, trimmed, deduplicated and capped; none left means not kept', () => {
	const kept = checkFact(
		lasting({ tags: [' Sister ', 'sister', 'ECE', '', 'a', 'b', 'c', 'd', 'e', 'x'.repeat(30)] }),
		TODAY
	)
	assert.deepEqual(kept?.tags, ['sister', 'ece', 'a', 'b', 'c', 'd'])
	assert.equal(kept?.tags.length, MEMORY_TAGS_MAX)
	assert.equal(checkFact(lasting({ tags: [] }), TODAY), null)
	assert.equal(checkFact(lasting({ tags: ['  '] }), TODAY), null)
})

test('nothing sensitive is kept: health, religion, politics, sexuality, ethnicity, money, age', () => {
	for (const text of [
		'Has been depressed lately',
		'Has anxiety before exams',
		'Mum has cancer',
		'Is Muslim',
		'Fasts during Ramadan',
		'Voted for the Green party',
		'Is into politics',
		'Is gay',
		'Came out to their parents',
		'Owes the bank money',
		'Has a big student loan',
		'Is 24 years old',
		'Their age is 30'
	]) {
		assert.equal(checkFact(lasting({ text }), TODAY), null, text)
	}
})

test('a sensitive tag is enough to drop a fact', () => {
	assert.equal(
		checkFact(lasting({ text: 'Has a hard month', tags: ['month', 'depression'] }), TODAY),
		null
	)
})

test('contact details are never kept', () => {
	assert.ok(isSensitive('Number is 0532 123 4567'))
	assert.ok(isSensitive('Email is ece@example.com'))
})

test('ordinary facts that only look close are kept', () => {
	for (const text of [
		'Works at an agency',
		'Works as a therapist',
		'Works at a hospital',
		'Has a friend called Owen',
		'Loves racing bikes',
		'Is learning to cook Italian food',
		'Has a dog called Kara',
		'Is training for a marathon in April'
	]) {
		assert.equal(isSensitive(text), false, text)
	}
})

test('someone saying they are under 13', () => {
	for (const said of [
		"I'm 9",
		"i'm 12 years old",
		'I am 11 yrs',
		"I'm 10.",
		"I'm 11 and I have an exam"
	]) {
		assert.ok(saysUnder13(said), said)
	}
	for (const said of [
		"I'm 13",
		"I'm 24 years old",
		"I'm 5 minutes away",
		'I have 2 cats',
		"I'm 2 hours late"
	]) {
		assert.equal(saysUnder13(said), false, said)
	}
})

test('two facts compare equal ignoring case, punctuation and spacing', () => {
	assert.equal(normaliseFact('Has a dog called  Kara.'), normaliseFact('has a dog called kara'))
	assert.notEqual(normaliseFact('Has a dog called Kara'), normaliseFact('Has a cat called Kara'))
})

test('days between and after, across a month end', () => {
	assert.equal(daysBetween('2026-10-03', '2026-10-09'), 6)
	assert.equal(daysBetween('2026-10-03', '2026-09-30'), -3)
	assert.equal(addDays('2026-10-30', 3), '2026-11-02')
})

test("the weekday is the person's, not the server's", () => {
	// 23:30 UTC on Friday 2 October is already Saturday in Istanbul.
	const at = new Date('2026-10-02T23:30:00Z')
	assert.equal(localWeekday(at, 'UTC'), 'Friday')
	assert.equal(localWeekday(at, 'Europe/Istanbul'), 'Saturday')
})
