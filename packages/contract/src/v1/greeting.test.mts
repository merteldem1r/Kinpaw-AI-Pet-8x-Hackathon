// "I missed you"'s buckets and shapes (v2-memory-requirements.md, R26–R28, Decision 3): under 6
// hours is Home as usual, then 6–24 hours, 1–3 days and more than 3 days, each edge exact.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { awayBucket, greetingBody, greetingResponse } from '../../index'

const NOW = new Date('2026-10-05T12:00:00.000Z')
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000)

test('the buckets, at their edges', () => {
	assert.equal(awayBucket(hoursAgo(0), NOW), 'none')
	assert.equal(awayBucket(hoursAgo(5.99), NOW), 'none')
	assert.equal(awayBucket(hoursAgo(6), NOW), '6-24h')
	assert.equal(awayBucket(hoursAgo(23.99), NOW), '6-24h')
	assert.equal(awayBucket(hoursAgo(24), NOW), '1-3d')
	assert.equal(awayBucket(hoursAgo(71.99), NOW), '1-3d')
	assert.equal(awayBucket(hoursAgo(72), NOW), '3d+')
	assert.equal(awayBucket(hoursAgo(24 * 30), NOW), '3d+')
})

test('never seen, or a clock that ran backwards, is no time away', () => {
	assert.equal(awayBucket(null, NOW), 'none')
	assert.equal(awayBucket(hoursAgo(-48), NOW), 'none')
})

test('the body: the time zone, nothing the server decides', () => {
	assert.ok(greetingBody.safeParse({ time_zone: 'Europe/Istanbul' }).success)
	assert.ok(!greetingBody.safeParse({}).success)
	assert.ok(!greetingBody.safeParse({ time_zone: 'Europe/Istanbul', away: '3d+' }).success)
})

test("a note's open: via, day and need together, from the known lists (notifications R16)", () => {
	const tz = { time_zone: 'Europe/Istanbul' }
	const open = { ...tz, via: 'notification', day: 2, need: 'energy', notifications: 'on' }
	assert.ok(greetingBody.safeParse(open).success)
	assert.ok(greetingBody.safeParse({ ...tz, notifications: 'denied' }).success)
	for (const bad of [
		{ ...open, day: 0 },
		{ ...open, day: '2' },
		{ ...open, need: 'thirst' },
		{ ...open, via: 'push' },
		{ ...tz, via: 'notification', day: 2 },
		{ ...tz, day: 2, need: 'energy' },
		{ ...tz, notifications: 'maybe' }
	]) {
		assert.ok(!greetingBody.safeParse(bad).success, JSON.stringify(bad))
	}
})

test('the response: a follow-up is an id and a question, or null', () => {
	const id = '63e25c0e-b8ad-4fab-b2d0-b2a66c7b63f1'
	assert.ok(greetingResponse.safeParse({ away: 'none', follow_up: null }).success)
	assert.ok(
		greetingResponse.safeParse({ away: '1-3d', follow_up: { id, question: 'How did it go?' } })
			.success
	)
	assert.ok(!greetingResponse.safeParse({ away: '1-3d', follow_up: { id, question: '' } }).success)
	assert.ok(!greetingResponse.safeParse({ away: 'week', follow_up: null }).success)
})
