// "Tell me about you"'s request (v2-memory-requirements.md, R19, R24): up to 60 words with a
// message id from the phone, or Skip with where the person left. Nothing else gets through.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { INTRO_FACTS_MAX, INTRO_WORDS_MAX, introBody, introResponse } from '../../index'

const ID = '0b6f3c62-6a43-4c39-9d3a-3c8f1a2b9e11'
const send = (text: string) => ({
	message_id: ID,
	text,
	input: 'voice',
	time_zone: 'Europe/Istanbul'
})
const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ')

test(`up to ${INTRO_WORDS_MAX} words is accepted; one more is refused`, () => {
	assert.ok(introBody.safeParse(send(words(INTRO_WORDS_MAX))).success)
	assert.ok(!introBody.safeParse(send(words(INTRO_WORDS_MAX + 1))).success)
})

test('empty, a missing message id, or an extra field is refused', () => {
	assert.ok(!introBody.safeParse(send('   ')).success)
	assert.ok(!introBody.safeParse({ ...send('hi'), message_id: 'nope' }).success)
	assert.ok(!introBody.safeParse({ ...send('hi'), user_id: ID }).success)
})

test('Skip carries only where the person left', () => {
	assert.ok(introBody.safeParse({ skip: true, step: 'review' }).success)
	assert.ok(!introBody.safeParse({ skip: true, step: 'home' }).success)
	assert.ok(!introBody.safeParse({ skip: false, step: 'review' }).success)
	assert.ok(!introBody.safeParse({ skip: true, step: 'record', text: 'hi' }).success)
})

test(`the response holds at most ${INTRO_FACTS_MAX} facts and no line on skip`, () => {
	const fact = {
		id: ID,
		text: 'Has a dog called Kara',
		category: 'pets',
		kind: 'lasting',
		follow_up_on: null,
		source: 'intro',
		created_at: '2026-10-04T12:00:00.000Z'
	}
	const base = { outcome: 'saved', line: 'Hi!', attempts_left: 0, intro_due: false }
	assert.ok(introResponse.safeParse({ ...base, facts: [fact] }).success)
	assert.ok(
		!introResponse.safeParse({ ...base, facts: Array(INTRO_FACTS_MAX + 1).fill(fact) }).success
	)
	assert.ok(introResponse.safeParse({ ...base, outcome: 'skipped', line: null, facts: [] }).success)
})
