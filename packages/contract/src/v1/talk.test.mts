// What talking does to the pet (m6-talk-requirements.md, R7, R10–R11): the intent table, the
// floor at 30, the daily caps, the local day the limit resets on, and the route's shapes. The
// app and the server both run these, so a boundary wrong here is wrong on both.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	analyticsIntent,
	applyTalk,
	countWords,
	firstWords,
	FREE_TALKS_PER_DAY,
	INTENTS,
	localDay,
	messagesLeft,
	NO_GAINS,
	TALK_DAILY_CAP,
	TALK_EFFECTS,
	TALK_FLOOR,
	TALK_WORDS_MAX,
	talkBody,
	type Needs
} from '../../index'

const MIDDLING: Needs = { hunger: 50, happiness: 50, energy: 50, affection: 50 }

test('each intent changes happiness and affection by the table, never hunger or energy', () => {
	for (const intent of INTENTS) {
		const { needs, added } = applyTalk(MIDDLING, intent, NO_GAINS)
		assert.deepEqual(added, TALK_EFFECTS[intent], intent)
		assert.equal(needs.happiness, 50 + TALK_EFFECTS[intent].happiness, intent)
		assert.equal(needs.affection, 50 + TALK_EFFECTS[intent].affection, intent)
		assert.equal(needs.hunger, 50, intent)
		assert.equal(needs.energy, 50, intent)
	}
})

test('harsh words stop at the floor, and never push a need that is already low', () => {
	const near = applyTalk({ ...MIDDLING, happiness: TALK_FLOOR + 2 }, 'harsh', NO_GAINS)
	assert.equal(near.needs.happiness, TALK_FLOOR)
	assert.equal(near.added.happiness, -2)

	const low = applyTalk({ ...MIDDLING, happiness: 12 }, 'harsh', NO_GAINS)
	assert.equal(low.needs.happiness, 12)
	assert.equal(low.added.happiness, 0)
})

test('kind words still lift a need that is below the floor', () => {
	const { needs } = applyTalk({ ...MIDDLING, affection: 10 }, 'affectionate', NO_GAINS)
	assert.equal(needs.affection, 16)
})

test('gains stop at the daily cap across messages, and at 100', () => {
	let needs = MIDDLING
	const gained = { ...NO_GAINS }
	for (let i = 0; i < 9; i++) {
		const result = applyTalk(needs, 'affectionate', gained)
		needs = result.needs
		gained.happiness += result.added.happiness
		gained.affection += result.added.affection
	}
	assert.deepEqual(gained, TALK_DAILY_CAP)
	assert.equal(needs.affection, 50 + TALK_DAILY_CAP.affection)

	const full = applyTalk({ ...MIDDLING, affection: 98 }, 'affectionate', NO_GAINS)
	assert.equal(full.needs.affection, 100)
	assert.equal(full.added.affection, 2)

	// Fractions: what talking adds stays whole, so it stops at the last whole point under 100.
	const fractional = applyTalk({ ...MIDDLING, affection: 98.5 }, 'affectionate', NO_GAINS)
	assert.equal(fractional.added.affection, 1)
	assert.equal(fractional.needs.affection, 99.5)
})

test('the cap counts what was added, so a capped day adds nothing more', () => {
	const { added } = applyTalk(MIDDLING, 'kind', TALK_DAILY_CAP)
	assert.deepEqual(added, NO_GAINS)
})

test('the free limit counts down to 0 and no further', () => {
	assert.equal(messagesLeft(0), FREE_TALKS_PER_DAY)
	assert.equal(messagesLeft(FREE_TALKS_PER_DAY - 1), 1)
	assert.equal(messagesLeft(FREE_TALKS_PER_DAY + 3), 0)
})

test("the local day turns at the person's own midnight", () => {
	const lateInIstanbul = new Date('2026-10-01T21:30:00Z') // 00:30 on the 2nd in Istanbul
	assert.equal(localDay(lateInIstanbul, 'Europe/Istanbul'), '2026-10-02')
	assert.equal(localDay(lateInIstanbul, 'America/New_York'), '2026-10-01')
	assert.equal(localDay(new Date('2026-01-05T00:00:00Z'), 'UTC'), '2026-01-05')
})

test('upset never reaches analytics by name', () => {
	assert.equal(analyticsIntent('upset'), 'other')
	assert.equal(analyticsIntent('harsh'), 'harsh')
})

test('the talk body: trimmed words, three exchanges at most, no other fields', () => {
	const body = {
		message_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
		text: '  hello  ',
		input: 'voice',
		time_zone: 'Europe/Istanbul',
		recent: []
	}
	assert.equal(talkBody.parse(body).text, 'hello')
	assert.equal(talkBody.safeParse({ ...body, text: '   ' }).success, false)
	assert.equal(talkBody.safeParse({ ...body, text: 'x'.repeat(281) }).success, false)
	const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ')
	assert.equal(talkBody.safeParse({ ...body, text: words(TALK_WORDS_MAX) }).success, true)
	assert.equal(talkBody.safeParse({ ...body, text: words(TALK_WORDS_MAX + 1) }).success, false)
	const exchange = { said: 'hi', reply: 'hello!' }
	assert.equal(
		talkBody.safeParse({ ...body, recent: [exchange, exchange, exchange, exchange] }).success,
		false
	)
	assert.equal(talkBody.safeParse({ ...body, needs: { happiness: 100 } }).success, false)
})

test('words are counted by spaces, and cut to the first ones', () => {
	assert.equal(countWords(''), 0)
	assert.equal(countWords('   '), 0)
	assert.equal(countWords('  hi   there \n friend '), 3)
	assert.equal(firstWords('one two three four', 2), 'one two')
	assert.equal(firstWords('one  two ', 2), 'one  two ')
})
