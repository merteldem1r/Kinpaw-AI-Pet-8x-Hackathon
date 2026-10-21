// /api/app/v1/friends (v2-friends-requirements.md, R13, R17–R21): a friend's pet carries only
// what a friend may see, a code is the caller's own or someone else's, an add is 201 once and 200
// on a retry, the cap answers on either side, and removal never says whether an id exists.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
	addFriendResponse,
	getFriendsResponse,
	lookById,
	lookupFriendResponse,
	presetTraits
} from '@app/contract'
import { fake, fakeStore, reset, send, OTHER, USER } from '@/server/api/app-test-kit.mts'

const route = await import('./route')
const lookup = await import('./lookup/route')
const remove = await import('./[id]/route')
const code = await import('./code/route')
const { friendStore } = await import('@/server/db/friends')
const { analyticsStore } = await import('@/server/db/analytics')
const { profileStore } = await import('@/server/db/profiles')

const FRIENDSHIP = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const SINCE = new Date('2026-10-06T09:00:00.000Z')
const GINGER = lookById('ginger').appearance

/** Luna, stored just now: hunger low, the rest okay or good. */
const luna = () => ({
	id: '1b4e28ba-2fa1-41d2-883f-0016d3cca427',
	...GINGER,
	look: 'ginger',
	name: 'Luna',
	preset: 'cuddly',
	...presetTraits('cuddly'),
	needs: { hunger: 12, happiness: 55, energy: 90, affection: 72, updatedAt: new Date() },
	createdAt: SINCE,
	updatedAt: SINCE
})

const friend = () => ({ id: FRIENDSHIP, createdAt: SINCE, displayName: 'Ece', pet: luna() })

const LUNA_WIRE = {
	appearance: GINGER,
	name: 'Luna',
	mood: 'sad',
	needs: { hunger: 'low', happiness: 'okay', energy: 'good', affection: 'good' }
}
const FRIEND_WIRE = {
	id: FRIENDSHIP,
	display_name: 'Ece',
	since: SINCE.toISOString(),
	pet: LUNA_WIRE
}

beforeEach(() => {
	reset()
	fakeStore(friendStore, 'codeFor', () => 'KP7XM3QD')
	fakeStore(friendStore, 'list', () => [friend()])
	fakeStore(friendStore, 'ownerOf', () => ({ userId: OTHER, displayName: 'Ece', pet: luna() }))
	fakeStore(friendStore, 'add', () => ({ outcome: 'added', friend: friend(), friendCount: 1 }))
	fakeStore(friendStore, 'count', () => 3)
	fakeStore(friendStore, 'remove', () => ({ removed: true }))
	fakeStore(friendStore, 'resetCode', () => 'ABCD2345')
	fakeStore(profileStore, 'regionOf', () => null)
	fakeStore(analyticsStore, 'hasDuplicate', () => false)
	fakeStore(analyticsStore, 'insertEvent', () => undefined)
})

const calls = (method: string) => fake.storeCalls.filter((call) => call.method === method)
const recorded = () => calls('insertEvent').map((call) => JSON.stringify(call.args))

const ADD = { code: 'kp7x-m3qd', source: 'link', time_zone: 'Europe/Istanbul' }

test("GET: the caller's code and friends, each pet only as a friend may see it", async () => {
	const res = await send(route.GET, '/api/app/v1/friends?time_zone=Europe/Istanbul')
	assert.equal(res.status, 200)
	assert.ok(getFriendsResponse.safeParse(res.body).success)
	assert.deepEqual(res.body, { code: 'KP7XM3QD', friends: [FRIEND_WIRE] })
	assert.deepEqual(calls('list')[0]?.args, [USER])
	const text = JSON.stringify(res.body)
	for (const secret of ['traits', 'preset', 'look_id', 'avatar', 'email', 'updated_at', OTHER]) {
		assert.equal(text.includes(secret), false, secret)
	}
	assert.equal(recorded().filter((r) => r.includes('friends_viewed')).length, 1)
})

test('GET: no friends records nothing; a bad time zone is a 400', async () => {
	fakeStore(friendStore, 'list', () => [])
	const res = await send(route.GET, '/api/app/v1/friends?time_zone=UTC')
	assert.deepEqual(res.body, { code: 'KP7XM3QD', friends: [] })
	assert.equal(calls('insertEvent').length, 0)
	assert.equal((await send(route.GET, '/api/app/v1/friends?time_zone=Mars/Base')).status, 400)
})

test('no token is a 401 on every route, and nothing is read', async () => {
	const post = { method: 'POST', token: null, body: ADD }
	assert.equal(
		(await send(route.GET, '/api/app/v1/friends?time_zone=UTC', { token: null })).status,
		401
	)
	assert.equal((await send(route.POST, '/api/app/v1/friends', post)).status, 401)
	assert.equal((await send(lookup.POST, '/api/app/v1/friends/lookup', post)).status, 401)
	assert.equal(
		(await send(code.POST, '/api/app/v1/friends/code', { ...post, body: {} })).status,
		401
	)
	assert.equal(
		(
			await send(remove.DELETE, `/api/app/v1/friends/${FRIENDSHIP}`, {
				method: 'DELETE',
				token: null,
				params: { id: FRIENDSHIP }
			})
		).status,
		401
	)
	assert.equal(fake.storeCalls.length, 0)
})

test('lookup: who the code is, with no ids, and nothing written', async () => {
	const res = await send(lookup.POST, '/api/app/v1/friends/lookup', {
		method: 'POST',
		body: { code: 'kp7x m3qd', time_zone: 'UTC' }
	})
	assert.equal(res.status, 200)
	assert.ok(lookupFriendResponse.safeParse(res.body).success)
	assert.deepEqual(res.body, { friend: { display_name: 'Ece', pet: LUNA_WIRE } })
	assert.deepEqual(calls('ownerOf')[0]?.args, ['KP7XM3QD'])
	assert.equal(calls('add').length, 0)
})

test("POST: an add is 201 for the caller and the code's owner, recorded for both", async () => {
	const res = await send(route.POST, '/api/app/v1/friends', { method: 'POST', body: ADD })
	assert.equal(res.status, 201)
	assert.ok(addFriendResponse.safeParse(res.body).success)
	assert.deepEqual(res.body, { friend: FRIEND_WIRE, existing: false })
	assert.deepEqual(calls('add')[0]?.args, [USER, OTHER])
	const added = recorded().filter((r) => r.includes('friend_added'))
	assert.equal(added.length, 2)
	assert.ok(added.some((r) => r.includes(USER) && r.includes('adder')))
	assert.ok(added.some((r) => r.includes(OTHER) && r.includes('"added"')))
	assert.ok(added.every((r) => !r.includes('KP7XM3QD')))
})

test('POST: already friends is a 200 with the friendship, and nothing recorded', async () => {
	fakeStore(friendStore, 'add', () => ({ outcome: 'existing', friend: friend(), friendCount: 1 }))
	const res = await send(route.POST, '/api/app/v1/friends', { method: 'POST', body: ADD })
	assert.equal(res.status, 200)
	assert.deepEqual(res.body, { friend: FRIEND_WIRE, existing: true })
	assert.equal(calls('insertEvent').length, 0)
})

test('POST and lookup: own code 400, unknown 404, never an add', async () => {
	fakeStore(friendStore, 'ownerOf', () => ({ userId: USER, displayName: null, pet: luna() }))
	const LOOKUP = { code: ADD.code, time_zone: ADD.time_zone }
	for (const [r, body] of [
		[route, ADD],
		[lookup, LOOKUP]
	] as const) {
		const res = await send(r.POST, '/api/app/v1/friends', { method: 'POST', body })
		assert.equal(res.status, 400)
		assert.equal(res.body.error.code, 'friend_own_code')
	}
	fakeStore(friendStore, 'ownerOf', () => null)
	for (const [r, body] of [
		[route, ADD],
		[lookup, LOOKUP]
	] as const) {
		const res = await send(r.POST, '/api/app/v1/friends', { method: 'POST', body })
		assert.equal(res.status, 404)
		assert.equal(res.body.error.code, 'friend_code_unknown')
	}
	assert.equal(calls('add').length, 0)
	const bad = await send(route.POST, '/api/app/v1/friends', {
		method: 'POST',
		body: { ...ADD, code: 'KP7XM3Q0' }
	})
	assert.equal(bad.status, 400)
})

test('POST: the cap answers 409 for either side', async () => {
	fakeStore(friendStore, 'add', () => ({ outcome: 'self_full' }))
	let res = await send(route.POST, '/api/app/v1/friends', { method: 'POST', body: ADD })
	assert.equal(res.status, 409)
	assert.equal(res.body.error.code, 'friends_full')
	fakeStore(friendStore, 'add', () => ({ outcome: 'friend_full' }))
	res = await send(route.POST, '/api/app/v1/friends', { method: 'POST', body: ADD })
	assert.equal(res.status, 409)
	assert.equal(res.body.error.code, 'friend_friends_full')
})

test('DELETE: 200 whether or not there was one; recorded only when removed', async () => {
	const del = () =>
		send(remove.DELETE, `/api/app/v1/friends/${FRIENDSHIP}`, {
			method: 'DELETE',
			params: { id: FRIENDSHIP }
		})
	let res = await del()
	assert.equal(res.status, 200)
	assert.deepEqual(calls('remove')[0]?.args, [USER, FRIENDSHIP])
	assert.equal(recorded().filter((r) => r.includes('friend_removed')).length, 1)
	fake.storeCalls = []
	fakeStore(friendStore, 'remove', () => ({ removed: false }))
	res = await del()
	assert.equal(res.status, 200)
	assert.equal(calls('insertEvent').length, 0)
})

test('code: a new one for the caller', async () => {
	const res = await send(code.POST, '/api/app/v1/friends/code', { method: 'POST', body: {} })
	assert.equal(res.status, 200)
	assert.deepEqual(res.body, { code: 'ABCD2345' })
	assert.deepEqual(calls('resetCode')[0]?.args, [USER])
})
