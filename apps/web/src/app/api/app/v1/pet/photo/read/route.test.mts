// POST /api/app/v1/pet/photo/read and /photo/redo (v2-pet-from-photo-requirements.md, R12,
// R17–R29). The read route is public (Create is signed out) and the redo route is Plus only,
// decided from plan_type. An oversized body is refused unread; our failures use no try and say
// so; a counted read is recorded first-party with no person, no photo and no hash in it. The
// stub reads (no FAL_KEY in tests).
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import {
	lookById,
	PHOTO_MAX_BODY_BYTES,
	photoReadResponse,
	presetTraits,
	usesPremium
} from '@app/contract'
import { fake, fakeStore, reset, send, USER } from '@/server/api/app-test-kit.mts'

const read = await import('./route')
const redo = await import('../redo/route')
const { photoReadStore } = await import('@/server/db/photo-reads')
const { aiUsageStore } = await import('@/server/db/ai-usage')
const { analyticsStore } = await import('@/server/db/analytics')
const { petStore } = await import('@/server/db/pets')
const { profileStore } = await import('@/server/db/profiles')

const INSTALL = '6f1c1a8e-1b7a-4a8e-9a77-2f3c1d0e9b11'
const PHOTO = (
	await sharp({ create: { width: 64, height: 64, channels: 3, background: '#556b2f' } })
		.jpeg()
		.toBuffer()
).toString('base64')
const NOW = new Date('2026-10-04T12:00:00Z')
const pet = {
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

let plan = 'free'
beforeEach(() => {
	reset()
	plan = 'free'
	delete process.env.FAL_KEY
	fakeStore(photoReadStore, 'reserve', () => ({ kind: 'reserved', id: 'read-1', left: 1 }))
	fakeStore(photoReadStore, 'settle', () => undefined)
	fakeStore(photoReadStore, 'release', () => undefined)
	fakeStore(aiUsageStore, 'record', () => undefined)
	fakeStore(analyticsStore, 'hasDuplicate', () => false)
	fakeStore(analyticsStore, 'insertEvent', () => undefined)
	fakeStore(profileStore, 'regionOf', () => null)
	fakeStore(profileStore, 'isPremium', () => plan === 'premium')
	fakeStore(petStore, 'get', () => pet)
})
const calls = (method: string) => fake.storeCalls.filter((call) => call.method === method)
const postRead = (body: unknown) =>
	send(read.POST, '/api/app/v1/pet/photo/read', { method: 'POST', token: null, body })
const postRedo = (body: unknown, token?: null) =>
	send(redo.POST, '/api/app/v1/pet/photo/redo', {
		method: 'POST',
		body,
		...(token === null ? { token } : {})
	})

test('read: signed out, a photo becomes a free pet in the contract, with the tries left', async () => {
	const res = await postRead({ install_id: INSTALL, image: PHOTO })
	assert.equal(res.status, 200)
	const body = photoReadResponse.parse(res.body)
	assert.equal(body.outcome, 'read')
	if (body.outcome !== 'read') return
	assert.equal(usesPremium(body.appearance), false)
	assert.equal(body.left, 1)
})

test('read: a counted read is recorded first-party, anonymous, with nothing identifying', async () => {
	await postRead({ install_id: INSTALL, image: PHOTO })
	const [event] = calls('insertEvent').map((call) => call.args[0] as Record<string, unknown>)
	assert.equal(event?.name, 'pet_photo_read')
	assert.equal(event?.userId, null)
	const metadata = event?.metadata as Record<string, unknown>
	assert.equal(metadata.context, 'create')
	assert.equal(metadata.result, 'read')
	assert.equal(metadata.session_id, 'read-1')
	const all = JSON.stringify(event)
	assert.equal(all.includes(INSTALL), false)
	assert.equal(all.includes(PHOTO.slice(0, 40)), false)
})

test('read: a limit is an answer the app shows, with no read and no event', async () => {
	fakeStore(photoReadStore, 'reserve', () => ({ kind: 'limit', limit: 'device', left: 0 }))
	const res = await postRead({ install_id: INSTALL, image: PHOTO })
	assert.equal(res.status, 200)
	assert.deepEqual(res.body, { outcome: 'limit_reached', limit: 'device', left: 0 })
	assert.equal(calls('insertEvent').length, 0)
})

test('read: a body over the limit is a 413 before anything else, and nothing is reserved', async () => {
	const huge = await postRead({ install_id: INSTALL, image: 'A'.repeat(PHOTO_MAX_BODY_BYTES) })
	assert.equal(huge.status, 413)
	assert.equal(huge.body.error.code, 'payload_too_large')
	assert.equal(calls('reserve').length, 0)
})

test('read: not a photo is a 400 that uses no try', async () => {
	const res = await postRead({
		install_id: INSTALL,
		image: Buffer.from('hello').toString('base64')
	})
	assert.equal(res.status, 400)
	assert.deepEqual(calls('release')[0]!.args, ['read-1'])
	assert.equal(calls('insertEvent').length, 0)
})

test('read: the model unreachable is a 503 photo_unavailable that uses no try', async () => {
	process.env.FAL_KEY = 'fal-test-key'
	const realFetch = globalThis.fetch
	globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		if (String(input).startsWith('https://fal.run/')) return new Response('down', { status: 503 })
		return realFetch(input, init)
	}) as typeof fetch
	try {
		const res = await postRead({ install_id: INSTALL, image: PHOTO })
		assert.equal(res.status, 503)
		assert.equal(res.body.error.code, 'photo_unavailable')
		assert.deepEqual(calls('release')[0]!.args, ['read-1'])
		assert.equal(calls('insertEvent').length, 0)
	} finally {
		globalThis.fetch = realFetch
	}
})

test('read: the install id must be a uuid, and nothing but the photo and the id is taken', async () => {
	assert.equal((await postRead({ install_id: 'phone-1', image: PHOTO })).status, 400)
	assert.equal((await postRead({ install_id: INSTALL, image: PHOTO, user_id: USER })).status, 400)
	assert.equal(calls('reserve').length, 0)
})

test('redo: a free account is answered plus_required, with no read', async () => {
	const res = await postRedo({ image: PHOTO, time_zone: 'Europe/Istanbul' })
	assert.equal(res.status, 200)
	assert.deepEqual(res.body, { outcome: 'plus_required' })
	assert.equal(calls('reserve').length, 0)
})

test('redo: Plus reads for the caller, counted against their day, recorded with their id', async () => {
	plan = 'premium'
	const res = await postRedo({ image: PHOTO, time_zone: 'Europe/Istanbul' })
	assert.equal(res.status, 200)
	assert.equal(photoReadResponse.parse(res.body).outcome, 'read')
	const claim = calls('reserve')[0]!.args[0] as Record<string, unknown>
	assert.equal(claim.context, 'redo')
	assert.equal(claim.userId, USER)
	const [event] = calls('insertEvent').map((call) => call.args[0] as Record<string, unknown>)
	assert.equal(event?.userId, USER)
})

test('redo: no token is a 401, no pet a 404, a made-up time zone a 400; none reads', async () => {
	plan = 'premium'
	assert.equal((await postRedo({ image: PHOTO, time_zone: 'Europe/Istanbul' }, null)).status, 401)
	assert.equal((await postRedo({ image: PHOTO, time_zone: 'Mars/Olympus' })).status, 400)
	fakeStore(petStore, 'get', () => null)
	assert.equal((await postRedo({ image: PHOTO, time_zone: 'Europe/Istanbul' })).status, 404)
	assert.equal(calls('reserve').length, 0)
})
