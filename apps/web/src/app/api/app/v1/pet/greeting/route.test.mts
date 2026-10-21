// "I missed you" over HTTP (v2-memory-requirements.md, R26–R28): the bucket from the time away,
// a due question served once, `greeting_shown` only when there is a line to say (never the
// question's words), and a bad time zone refused before anything is written.
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { greetingResponse } from '@app/contract'
import { fake, fakeStore, reset, send, USER } from '@/server/api/app-test-kit.mts'

const route = await import('./route')
const { memoryStore } = await import('@/server/db/memory')
const { profileStore } = await import('@/server/db/profiles')
const { analyticsStore } = await import('@/server/db/analytics')

const HOUR_MS = 3_600_000
const exam = {
	id: '63e25c0e-b8ad-4fab-b2d0-b2a66c7b63f1',
	text: 'Has an exam on Friday',
	followUp: 'How did the exam go?',
	kind: 'event',
	followUpOn: '2026-10-03',
	followedUpAt: null
}

let lastSeen: Date | null
let due: typeof exam | null
let asked: boolean

beforeEach(() => {
	reset()
	lastSeen = null
	due = null
	asked = false
	fakeStore(profileStore, 'markSeen', () => lastSeen)
	fakeStore(profileStore, 'regionOf', () => null)
	fakeStore(memoryStore, 'due', () => due)
	fakeStore(memoryStore, 'markFollowedUp', () => {
		if (asked) return false
		asked = true
		return true
	})
	fakeStore(analyticsStore, 'hasDuplicate', () => false)
	fakeStore(analyticsStore, 'insertEvent', () => undefined)
})

const calls = (method: string) => fake.storeCalls.filter((call) => call.method === method)
const events = () =>
	calls('insertEvent').map((call) => call.args[0] as { name: string; metadata: unknown })
const post = (body: unknown = { time_zone: 'Europe/Istanbul' }, token?: null) =>
	send(route.POST, '/api/app/v1/pet/greeting', {
		method: 'POST',
		body,
		...(token === null && { token })
	})
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR_MS)

test('a short time away: no line, no event, and the visit is still stamped', async () => {
	lastSeen = hoursAgo(2)
	const res = await post()
	assert.equal(res.status, 200)
	assert.deepEqual(res.body, { away: 'none', follow_up: null })
	assert.ok(greetingResponse.safeParse(res.body).success)
	assert.equal(calls('markSeen')[0]?.args[0], USER)
	assert.equal(events().length, 0)
})

test('each bucket, recorded with its label', async () => {
	for (const [hours, away] of [
		[7, '6-24h'],
		[30, '1-3d'],
		[100, '3d+']
	] as const) {
		reset()
		lastSeen = hoursAgo(hours)
		const res = await post()
		assert.deepEqual(res.body, { away, follow_up: null })
		assert.deepEqual(events(), [
			{ ...events()[0]!, name: 'greeting_shown', metadata: { away, follow_up: false } }
		])
	}
})

test('a due event is asked once, then not again; the words never reach the event', async () => {
	lastSeen = hoursAgo(30)
	due = exam
	const first = await post()
	assert.deepEqual(first.body, {
		away: '1-3d',
		follow_up: { id: exam.id, question: 'How did the exam go?' }
	})
	assert.deepEqual(events()[0]?.metadata, { away: '1-3d', follow_up: true })
	assert.ok(!JSON.stringify(events()).includes('exam'))

	// Another phone got there first: the store says it was already asked.
	const second = await post()
	assert.equal(second.body.follow_up, null)
})

test('a due question is asked even after a short time away', async () => {
	lastSeen = hoursAgo(1)
	due = exam
	const res = await post()
	assert.deepEqual(res.body, {
		away: 'none',
		follow_up: { id: exam.id, question: 'How did the exam go?' }
	})
	assert.deepEqual(events()[0]?.metadata, { away: 'none', follow_up: true })
})

test("the event's day decides from the person's own time zone", async () => {
	await post({ time_zone: 'Pacific/Kiritimati' })
	const today = calls('due')[0]?.args[1] as string
	assert.match(today, /^\d{4}-\d\d-\d\d$/)
	assert.equal(
		today,
		new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Kiritimati' }).format(new Date())
	)
})

test('a bad time zone or body is refused before anything is written', async () => {
	assert.equal((await post({ time_zone: 'Mars/Olympus' })).status, 400)
	assert.equal((await post({})).status, 400)
	assert.equal((await post({ time_zone: 'Europe/Istanbul', away: '3d+' })).status, 400)
	assert.equal(calls('markSeen').length, 0)
	assert.equal(calls('markFollowedUp').length, 0)
})

test('signed out is refused', async () => {
	assert.equal((await post(undefined, null)).status, 401)
	assert.equal(calls('markSeen').length, 0)
})

// The pet's notes (v2-notifications-requirements.md, R16–R17): counting the opens.
const tz = { time_zone: 'Europe/Istanbul' }

test('a tapped note is counted even under 6 hours away, with its labels only', async () => {
	lastSeen = hoursAgo(3)
	const res = await post({ ...tz, via: 'notification', day: 1, need: 'hunger' })
	assert.equal(res.status, 200)
	assert.equal(res.body.away, 'none')
	assert.deepEqual(
		events().map(({ name, metadata }) => [name, metadata]),
		[['notification_opened', { day: 1, need: 'hunger' }]]
	)
})

test('no note, no open; the state is recorded per state, each call', async () => {
	lastSeen = hoursAgo(1)
	await post({ ...tz, notifications: 'on' })
	assert.deepEqual(
		events().map(({ name, metadata }) => [name, metadata]),
		[['notifications_state', { state: 'on' }]]
	)
	// Deduped per state, so a change made during the day is kept: the check asks by state.
	const dedupe = calls('hasDuplicate').map((call) => JSON.stringify(call.args))
	assert.ok(dedupe.some((args) => args.includes('"state":"on"')))
})

test('an older build, sending neither, records neither', async () => {
	lastSeen = hoursAgo(1)
	await post(tz)
	assert.equal(events().length, 0)
})

test("a note's bad labels are refused with a 400 before any write", async () => {
	for (const bad of [
		{ ...tz, via: 'notification', day: 4, need: 'hunger' },
		{ ...tz, via: 'notification', day: 1, need: 'thirst' },
		{ ...tz, via: 'notification', day: 1 },
		{ ...tz, day: 1, need: 'hunger' },
		{ ...tz, via: 'push', day: 1, need: 'hunger' },
		{ ...tz, notifications: 'maybe' }
	]) {
		assert.equal((await post(bad)).status, 400, JSON.stringify(bad))
	}
	assert.equal(calls('markSeen').length, 0)
	assert.equal(calls('insertEvent').length, 0)
})
