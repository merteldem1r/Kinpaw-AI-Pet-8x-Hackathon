// One photo read, start to end (v2-pet-from-photo-requirements.md, R7–R12, R17–R25), with the
// stores faked: the limits come first, our own failures release the read, an answer settles it,
// a free read is always free, a Plus redo keeps its Plus options, and nothing identifying is
// stored as it is.
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { lookById, usesPremium, type PetAppearance } from '@app/contract'
import { fake, fakeStore, reset } from '@/server/api/app-test-kit.mts'
import type { PhotoConfig } from './config'
import type { PhotoReader, PhotoReadResult } from './reader'
import { createStubReader } from './stub'

const { readPetPhoto } = await import('./read-photo')
const { photoReadStore } = await import('@/server/db/photo-reads')
const { aiUsageStore } = await import('@/server/db/ai-usage')

const NOW = new Date('2026-10-04T21:30:00Z')
const INSTALL = '6f1c1a8e-1b7a-4a8e-9a77-2f3c1d0e9b11'
const CONFIG: PhotoConfig = {
	falKey: null,
	model: 'stub',
	hashSecret: 'test-secret',
	dailyCap: 300
}
const PHOTO = (
	await sharp({ create: { width: 64, height: 64, channels: 3, background: '#a0522d' } })
		.jpeg()
		.toBuffer()
).toString('base64')
const calico = lookById('calico').appearance
const create = { context: 'create' as const, installId: INSTALL, ip: '203.0.113.7', userId: null }
const redo = (plus: boolean) => ({
	context: 'redo' as const,
	ip: '203.0.113.7',
	userId: '00000000-0000-4000-8000-000000000001',
	timeZone: 'Europe/Istanbul',
	plus
})
const answering = (appearance: PetAppearance) => createStubReader({ verdict: 'ok', appearance })

beforeEach(() => {
	reset()
	fakeStore(photoReadStore, 'reserve', () => ({ kind: 'reserved', id: 'read-1', left: 1 }))
	fakeStore(photoReadStore, 'settle', () => undefined)
	fakeStore(photoReadStore, 'release', () => undefined)
	fakeStore(aiUsageStore, 'record', () => undefined)
})
const calls = (method: string) => fake.storeCalls.filter((call) => call.method === method)

test('a free read: reserved, counted as read, Plus options swapped and listed', async () => {
	assert.equal(usesPremium(calico), true)
	const result = await readPetPhoto(create, PHOTO, {
		reader: answering(calico),
		config: CONFIG,
		now: NOW
	})
	assert.equal(result.kind, 'answered')
	if (result.kind !== 'answered' || result.answer.outcome !== 'read') return
	assert.equal(usesPremium(result.answer.appearance), false)
	assert.ok(result.answer.swapped.some((swap) => swap.from === 'patches'))
	assert.equal(result.left, 1)
	assert.deepEqual(calls('settle')[0]!.args, ['read-1', 'read'])
	assert.equal(calls('release').length, 0)
})

test('the claim holds hashes and the UTC day, never the install id or the address', async () => {
	await readPetPhoto(create, PHOTO, { reader: answering(calico), config: CONFIG, now: NOW })
	const claim = calls('reserve')[0]!.args[0] as Record<string, string>
	assert.equal(claim.context, 'create')
	assert.match(claim.deviceHash!, /^[0-9a-f]{64}$/)
	assert.match(claim.ipHash!, /^[0-9a-f]{64}$/)
	assert.equal(JSON.stringify(claim).includes(INSTALL), false)
	assert.equal(JSON.stringify(claim).includes('203.0.113.7'), false)
	assert.equal(claim.day, '2026-10-04')
})

test("a redo counts against the phone's day, not UTC's", async () => {
	// 21:30 UTC is 00:30 the next day in Istanbul.
	await readPetPhoto(redo(true), PHOTO, { reader: answering(calico), config: CONFIG, now: NOW })
	const claim = calls('reserve')[0]!.args[0] as Record<string, string>
	assert.equal(claim.day, '2026-10-05')
})

test('a Plus redo keeps its Plus options', async () => {
	const result = await readPetPhoto(redo(true), PHOTO, {
		reader: answering(calico),
		config: CONFIG
	})
	assert.equal(result.kind === 'answered' && result.answer.outcome, 'read')
	if (result.kind !== 'answered' || result.answer.outcome !== 'read') return
	assert.deepEqual(result.answer.appearance, calico)
	assert.deepEqual(result.answer.swapped, [])
})

test('a redo from a free account asks for Plus, before any read is reserved', async () => {
	const result = await readPetPhoto(redo(false), PHOTO, {
		reader: answering(calico),
		config: CONFIG
	})
	assert.deepEqual(result, { kind: 'plus_required' })
	assert.equal(calls('reserve').length, 0)
})

test('a limit is answered with no image work and no model call', async () => {
	fakeStore(photoReadStore, 'reserve', () => ({ kind: 'limit', limit: 'device', left: 0 }))
	let asked = false
	const reader: PhotoReader = {
		name: 'stub',
		model: 'stub',
		read: async () => {
			asked = true
			throw new Error('must not be asked')
		}
	}
	const result = await readPetPhoto(create, PHOTO, { reader, config: CONFIG })
	assert.deepEqual(result, { kind: 'limit', limit: 'device', left: 0 })
	assert.equal(asked, false)
	assert.equal(calls('record').length, 0)
})

test('a photo that cannot be read releases its read', async () => {
	const result = await readPetPhoto(create, Buffer.from('nope').toString('base64'), {
		reader: answering(calico),
		config: CONFIG
	})
	assert.equal(result.kind, 'bad_image')
	assert.deepEqual(calls('release')[0]!.args, ['read-1'])
	assert.equal(calls('settle').length, 0)
})

test('the model failing releases the read (no try used) and is still logged in ai_usage', async () => {
	const failing: PhotoReader = {
		name: 'fal',
		model: 'google/gemini-2.5-flash',
		read: async (): Promise<PhotoReadResult> => ({
			ok: false,
			failure: 'unavailable',
			detail: 'http_503',
			usage: { inputTokens: null, outputTokens: null },
			latencyMs: 40
		})
	}
	const result = await readPetPhoto(create, PHOTO, { reader: failing, config: CONFIG })
	assert.deepEqual(result, { kind: 'failed', failure: 'unavailable' })
	assert.deepEqual(calls('release')[0]!.args, ['read-1'])
	const usage = calls('record')[0]!.args[0] as Record<string, unknown>
	assert.equal(usage.outcome, 'unavailable')
	assert.equal(usage.userId, null)
	assert.equal(usage.provider, 'fal')
})

test('no pet in the photo is a counted read, settled as what was found', async () => {
	const result = await readPetPhoto(create, PHOTO, {
		reader: createStubReader({ verdict: 'several' }),
		config: CONFIG
	})
	assert.equal(result.kind === 'answered' && result.answer.outcome, 'several')
	assert.deepEqual(calls('settle')[0]!.args, ['read-1', 'several'])
})

test('no reader, or production with no hash secret, is not configured', async () => {
	assert.deepEqual(await readPetPhoto(create, PHOTO, { reader: null, config: CONFIG }), {
		kind: 'not_configured'
	})
	const env = process.env as Record<string, string | undefined>
	const previous = env.NODE_ENV
	env.NODE_ENV = 'production'
	try {
		const result = await readPetPhoto(create, PHOTO, {
			reader: answering(calico),
			config: { ...CONFIG, hashSecret: null }
		})
		assert.deepEqual(result, { kind: 'not_configured' })
	} finally {
		env.NODE_ENV = previous
	}
	assert.equal(calls('reserve').length, 0)
})
