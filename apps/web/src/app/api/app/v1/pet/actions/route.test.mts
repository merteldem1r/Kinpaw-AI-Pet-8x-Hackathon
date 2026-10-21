// POST /api/app/v1/pet/actions. The owner is the verified caller; the body names an action and
// the phone's time zone, never needs. A care action is recorded first-party once a day per
// action, so Feed doesn't hide Play; a pet that doesn't exist is a 404, not a new pet.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { lookById, petActionResponse, presetTraits } from '@app/contract'
import { fake, fakeStore, reset, send, USER } from '@/server/api/app-test-kit.mts'

const route = await import('./route')
const { petStore } = await import('@/server/db/pets')
const { profileStore } = await import('@/server/db/profiles')
const { analyticsStore } = await import('@/server/db/analytics')

const NOW = new Date('2026-10-01T18:00:00.000Z')

const row = {
	id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
	...lookById('ginger').appearance,
	look: 'ginger',
	name: 'Mochi',
	preset: 'cuddly',
	...presetTraits('cuddly'),
	needs: {
		hunger: 90,
		happiness: 85,
		energy: 80,
		affection: 70,
		updatedAt: NOW
	},
	createdAt: NOW,
	updatedAt: NOW
}

const body = { action: 'feed', time_zone: 'Europe/Istanbul' }

beforeEach(() => {
	reset()
	fakeStore(petStore, 'act', () => ({ row, changed: true }))
	fakeStore(profileStore, 'regionOf', () => null)
	fakeStore(analyticsStore, 'hasDuplicate', () => false)
	fakeStore(analyticsStore, 'insertEvent', () => undefined)
})

const calls = (method: string) => fake.storeCalls.filter((call) => call.method === method)
const post = (sent: unknown, token?: null) =>
	send(route.POST, '/api/app/v1/pet/actions', {
		method: 'POST',
		body: sent,
		...(token === null ? { token } : {})
	})

test("an action is applied to the caller's pet, in the phone's time zone", async () => {
	const res = await post(body)
	assert.equal(res.status, 200)
	assert.ok(petActionResponse.safeParse(res.body).success)
	assert.equal(res.body.changed, true)
	assert.deepEqual(res.body.pet.needs, {
		hunger: 90,
		happiness: 85,
		energy: 80,
		affection: 70,
		updated_at: NOW.toISOString()
	})
	assert.deepEqual(calls('act')[0]?.args, [USER, 'feed', 'Europe/Istanbul'])
})

test('pet_action_taken is recorded with its action, and deduped per action', async () => {
	await post({ ...body, action: 'play' })
	const inserted = calls('insertEvent')
	assert.equal(inserted.length, 1)
	const recorded = JSON.stringify(inserted[0]?.args)
	assert.match(recorded, /pet_action_taken/)
	assert.match(recorded, /"action":"play"/)
	assert.match(recorded, /"need_changed":true/)
	assert.doesNotMatch(recorded, /Mochi/)
	// The dedupe lookup is widened by the action, so a Feed today doesn't swallow a Play.
	assert.match(JSON.stringify(calls('hasDuplicate')[0]?.args), /play/)
})

test("an action that can't help still answers with the current pet, changed: false", async () => {
	fakeStore(petStore, 'act', () => ({ row, changed: false }))
	const res = await post(body)
	assert.equal(res.status, 200)
	assert.equal(res.body.changed, false)
	assert.match(JSON.stringify(calls('insertEvent')[0]?.args), /"need_changed":false/)
})

test('no pet yet is a 404, and nothing is recorded', async () => {
	fakeStore(petStore, 'act', () => null)
	const res = await post(body)
	assert.equal(res.status, 404)
	assert.equal(res.body.error.code, 'not_found')
	assert.equal(calls('insertEvent').length, 0)
})

test('no token is a 401, and the pet is never touched', async () => {
	assert.equal((await post(body, null)).status, 401)
	assert.equal(calls('act').length, 0)
})

test('an unknown action, a fake time zone, sent needs or an owner are refused', async () => {
	for (const bad of [
		{ ...body, action: 'dance' },
		{ ...body, time_zone: 'Mars/Olympus' },
		{ ...body, time_zone: '' },
		{ action: 'feed' },
		{ ...body, needs: { hunger: 100 } },
		{ ...body, user_id: USER }
	]) {
		const res = await post(bad)
		assert.equal(res.status, 400, JSON.stringify(bad))
	}
	assert.equal(calls('act').length, 0)
})
