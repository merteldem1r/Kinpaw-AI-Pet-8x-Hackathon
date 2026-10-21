// "Tell me about you" over HTTP (v2-memory-requirements.md, R18–R24): the contract's shape, the
// events with labels only (never what was said or the facts), Skip, a closed step, and the model
// down. The stub answers (no GROQ_API_KEY in tests), except where Groq is made unreachable.
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { introResponse, lookById, presetTraits, type NewMemory } from '@app/contract'
import { fake, fakeStore, reset, send, USER } from '@/server/api/app-test-kit.mts'

const route = await import('./route')
const { introStore } = await import('@/server/db/intro')
const { petStore } = await import('@/server/db/pets')
const { profileStore } = await import('@/server/db/profiles')
const { aiUsageStore } = await import('@/server/db/ai-usage')
const { analyticsStore } = await import('@/server/db/analytics')

const NOW = new Date('2026-10-04T12:00:00.000Z')
const row = {
	id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
	...lookById('ginger').appearance,
	look: 'ginger',
	name: 'Mochi',
	preset: 'cuddly',
	...presetTraits('cuddly'),
	needs: { hunger: 60, happiness: 80, energy: 80, affection: 70, updatedAt: NOW },
	createdAt: NOW,
	updatedAt: NOW
}
const body = {
	message_id: '0b6f3c62-6a43-4c39-9d3a-3c8f1a2b9e11',
	text: 'I study medicine and I have a dog called Kara',
	input: 'typed',
	time_zone: 'Europe/Istanbul'
}
const kept = (fact: NewMemory, index: number) => ({
	...fact,
	id: `63e25c0e-b8ad-4fab-b2d0-b2a66c7b63f${index}`,
	followedUpAt: null,
	source: 'intro',
	lastUsedAt: null,
	createdAt: NOW
})

beforeEach(() => {
	reset()
	delete process.env.GROQ_API_KEY
	fakeStore(introStore, 'status', () => ({ kind: 'open', attemptsLeft: 2 }))
	fakeStore(introStore, 'record', (_userId: string, attempt: { facts: NewMemory[] }) => ({
		kind: 'saved',
		facts: attempt.facts.map(kept),
		attemptsLeft: attempt.facts.length > 0 ? 0 : 1,
		due: attempt.facts.length === 0
	}))
	fakeStore(introStore, 'skip', () => true)
	fakeStore(petStore, 'get', () => row)
	fakeStore(profileStore, 'isPremium', () => false)
	fakeStore(profileStore, 'personName', () => null)
	fakeStore(profileStore, 'regionOf', () => null)
	fakeStore(aiUsageStore, 'record', () => undefined)
	fakeStore(analyticsStore, 'hasDuplicate', () => false)
	fakeStore(analyticsStore, 'insertEvent', () => undefined)
})

const calls = (method: string) => fake.storeCalls.filter((call) => call.method === method)
const events = () =>
	calls('insertEvent').map((call) => call.args[0] as { name: string; metadata: unknown })
const post = (sent: unknown, token?: null) =>
	send(route.POST, '/api/app/v1/pet/intro', {
		method: 'POST',
		body: sent,
		...(token === null && { token })
	})

test("saved: the facts in the contract's shape, and the events with labels only", async () => {
	const res = await post(body)
	assert.equal(res.status, 200)
	assert.ok(introResponse.safeParse(res.body).success)
	assert.equal(res.body.outcome, 'saved')
	assert.deepEqual(
		res.body.facts.map((fact: { text: string; source: string }) => [fact.text, fact.source]),
		[
			['Studies medicine', 'intro'],
			['Has a dog called Kara', 'intro']
		]
	)
	assert.equal(res.body.attempts_left, 0)
	assert.equal(res.body.intro_due, false)

	assert.deepEqual(
		events().map(({ name, metadata }) => [name, metadata]),
		[
			['intro_completed', { input: 'typed', facts: '1-2' }],
			['memory_saved', { source: 'intro', category: 'study', kind: 'lasting', replaced: false }]
		]
	)
	const recorded = JSON.stringify([calls('insertEvent'), res.logs])
	assert.doesNotMatch(recorded, /medicine|Kara/)
})

test('nothing kept: no completion recorded, and the second attempt is left', async () => {
	const res = await post({ ...body, text: 'Hello there, nice to meet you' })
	assert.equal(res.status, 200)
	assert.deepEqual(res.body.facts, [])
	assert.equal(res.body.attempts_left, 1)
	assert.equal(res.body.intro_due, true)
	assert.equal(events().length, 0)
})

test('Skip ends the step for good, with where the person left; no model call', async () => {
	const res = await post({ skip: true, step: 'review' })
	assert.equal(res.status, 200)
	assert.deepEqual(res.body, {
		outcome: 'skipped',
		facts: [],
		line: null,
		attempts_left: 0,
		intro_due: false
	})
	assert.deepEqual(calls('skip')[0]!.args, [USER])
	assert.deepEqual(
		events().map(({ name, metadata }) => [name, metadata]),
		[['intro_skipped', { step: 'review' }]]
	)
	assert.equal(calls('record').length, 0)
})

test('Skip with no pet is a 404', async () => {
	fakeStore(introStore, 'skip', () => false)
	assert.equal((await post({ skip: true, step: 'record' })).status, 404)
	assert.equal(events().length, 0)
})

test('a closed step is a 409 intro_closed, and nothing is asked or recorded', async () => {
	fakeStore(introStore, 'status', () => ({ kind: 'closed' }))
	const res = await post(body)
	assert.equal(res.status, 409)
	assert.equal(res.body.error.code, 'intro_closed')
	assert.equal(calls('record').length, 0)
	assert.equal(events().length, 0)
})

test('no pet yet is a 404', async () => {
	fakeStore(introStore, 'status', () => ({ kind: 'no_pet' }))
	assert.equal((await post(body)).status, 404)
})

test('Groq unreachable: 503, no attempt used, no words in the logs', async () => {
	// The test kit's fetch answers 500 to anything it doesn't know, Groq included.
	process.env.GROQ_API_KEY = 'gsk_test'
	const res = await post(body)
	assert.equal(res.status, 503)
	assert.equal(res.body.error.code, 'talk_unavailable')
	const attempts = calls('record').filter((call) => typeof call.args[0] === 'string')
	assert.equal(attempts.length, 0)
	assert.doesNotMatch(JSON.stringify(res.logs), /medicine|gsk_test/)
})

test('over 60 words, a fake time zone, or an extra field is a 400', async () => {
	const long = Array.from({ length: 61 }, () => 'word').join(' ')
	assert.equal((await post({ ...body, text: long })).status, 400)
	const zone = await post({ ...body, time_zone: 'Mars/Olympus' })
	assert.equal(zone.status, 400)
	assert.equal(zone.body.error.issues[0].path, 'time_zone')
	assert.equal((await post({ ...body, user_id: USER })).status, 400)
	assert.equal(calls('status').length, 0)
})

test('no session is a 401, and nothing is read', async () => {
	assert.equal((await post(body, null)).status, 401)
	assert.equal(fake.storeCalls.length, 0)
})
