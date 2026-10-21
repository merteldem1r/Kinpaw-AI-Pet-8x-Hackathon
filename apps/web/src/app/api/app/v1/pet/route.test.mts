// GET and POST /api/app/v1/pet. The owner is always the verified caller; the body can't name
// one. A save is safe to retry, a second pet loses to the first, a Plus option (and so a Plus
// look) needs a premium account (decided here, from plan_type), and pet_created is recorded only
// for a real create.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
	createPetResponse,
	lookById,
	petResponse,
	presetTraits,
	updatePetResponse
} from '@app/contract'
import { fake, fakeStore, reset, send, USER } from '@/server/api/app-test-kit.mts'

const route = await import('./route')
const { petStore } = await import('@/server/db/pets')
const { profileStore } = await import('@/server/db/profiles')
const { analyticsStore } = await import('@/server/db/analytics')
const { introStore } = await import('@/server/db/intro')

const PET_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const CREATED = new Date('2026-10-01T09:00:00.000Z')

const GINGER = lookById('ginger').appearance

const row = {
	id: PET_ID,
	...GINGER,
	look: 'ginger',
	name: 'Mochi',
	preset: 'cuddly',
	...presetTraits('cuddly'),
	needs: {
		hunger: 60,
		happiness: 80,
		energy: 80,
		affection: 70,
		updatedAt: CREATED
	},
	createdAt: CREATED,
	updatedAt: CREATED
}

const body = {
	id: PET_ID,
	appearance: GINGER,
	look_id: 'ginger',
	name: 'Mochi',
	preset: 'cuddly',
	traits: presetTraits('cuddly')
}

const wire = {
	id: PET_ID,
	appearance: GINGER,
	look_id: 'ginger',
	name: 'Mochi',
	preset: 'cuddly',
	traits: presetTraits('cuddly'),
	needs: {
		hunger: 60,
		happiness: 80,
		energy: 80,
		affection: 70,
		updated_at: CREATED.toISOString()
	},
	created_at: CREATED.toISOString()
}

let plan = 'free'

beforeEach(() => {
	reset()
	plan = 'free'
	fakeStore(petStore, 'get', () => row)
	fakeStore(introStore, 'due', () => true)
	fakeStore(petStore, 'create', () => ({ outcome: 'created', row }))
	fakeStore(petStore, 'updateAppearance', (_userId: string, attributes: object, look: unknown) => ({
		...row,
		...attributes,
		look
	}))
	fakeStore(profileStore, 'isPremium', () => plan === 'premium')
	fakeStore(profileStore, 'regionOf', () => null)
	fakeStore(analyticsStore, 'hasDuplicate', () => false)
	fakeStore(analyticsStore, 'insertEvent', () => undefined)
})

const calls = (method: string) => fake.storeCalls.filter((call) => call.method === method)

test("GET: the caller's pet, by the caller's id", async () => {
	const res = await send(route.GET, '/api/app/v1/pet')
	assert.equal(res.status, 200)
	assert.ok(petResponse.safeParse(res.body).success)
	assert.deepEqual(res.body, { pet: wire, intro_due: true })
	assert.deepEqual(calls('get')[0]?.args, [USER])
	assert.deepEqual(calls('due')[0]?.args, [USER])
})

test('GET: "Tell me about you" over is intro_due false', async () => {
	fakeStore(introStore, 'due', () => false)
	const res = await send(route.GET, '/api/app/v1/pet')
	assert.equal(res.body.intro_due, false)
})

test('GET: no pet yet is null, not an error', async () => {
	fakeStore(petStore, 'get', () => null)
	const res = await send(route.GET, '/api/app/v1/pet')
	assert.deepEqual(res.body, { pet: null })
})

test('GET and POST: no token is a 401, and nothing is read', async () => {
	assert.equal((await send(route.GET, '/api/app/v1/pet', { token: null })).status, 401)
	assert.equal(
		(await send(route.POST, '/api/app/v1/pet', { method: 'POST', token: null, body })).status,
		401
	)
	assert.equal(fake.storeCalls.length, 0)
})

test('POST: a new pet is 201, saved for the caller, and pet_created is recorded once', async () => {
	const res = await send(route.POST, '/api/app/v1/pet', { method: 'POST', body })
	assert.equal(res.status, 201)
	assert.ok(createPetResponse.safeParse(res.body).success)
	assert.deepEqual(res.body, { pet: wire, existing: false })
	const [userId, input] = calls('create')[0]?.args as [string, Record<string, unknown>]
	assert.equal(userId, USER)
	assert.equal(input.look, 'ginger')
	assert.deepEqual(input.appearance, GINGER)
	const inserted = calls('insertEvent')
	assert.equal(inserted.length, 1)
	const recorded = JSON.stringify(inserted[0]?.args)
	assert.match(recorded, /pet_created/)
	assert.match(recorded, /cat\.ginger\.stripes\.brown\.pointy\.round\.long/)
	assert.doesNotMatch(recorded, /Mochi/)
})

test('POST: a customized pet saves with no look, and is recorded as custom', async () => {
	const curly = { ...GINGER, tail: 'curly' }
	fakeStore(petStore, 'create', () => ({
		outcome: 'created',
		row: { ...row, tail: 'curly', look: null }
	}))
	const res = await send(route.POST, '/api/app/v1/pet', {
		method: 'POST',
		body: { ...body, appearance: curly, look_id: null }
	})
	assert.equal(res.status, 201)
	assert.deepEqual(res.body.pet.appearance, curly)
	assert.equal(res.body.pet.look_id, null)
	assert.equal((calls('create')[0]?.args[1] as Record<string, unknown>).look, null)
	assert.match(JSON.stringify(calls('insertEvent')[0]?.args), /"look_id":"custom"/)
})

test('POST: a retry is 200 with the same pet, and records nothing', async () => {
	fakeStore(petStore, 'create', () => ({ outcome: 'retried', row }))
	const res = await send(route.POST, '/api/app/v1/pet', { method: 'POST', body })
	assert.equal(res.status, 200)
	assert.deepEqual(res.body, { pet: wire, existing: false })
	assert.equal(calls('insertEvent').length, 0)
})

test('POST: an account that already has a pet keeps it: 200, existing, nothing recorded', async () => {
	fakeStore(petStore, 'create', () => ({ outcome: 'existing', row }))
	const res = await send(route.POST, '/api/app/v1/pet', {
		method: 'POST',
		body: { ...body, id: '0b6f4a4e-6a57-4a8b-9c52-3a4f0f4d2b11', name: 'Biscuit' }
	})
	assert.equal(res.status, 200)
	assert.deepEqual(res.body, { pet: wire, existing: true })
	assert.equal(calls('insertEvent').length, 0)
})

test("POST: someone else's pet id is a 409", async () => {
	fakeStore(petStore, 'create', () => ({ outcome: 'conflict' }))
	const res = await send(route.POST, '/api/app/v1/pet', { method: 'POST', body })
	assert.equal(res.status, 409)
	assert.equal(res.body.error.code, 'conflict')
})

test('POST: the body names no owner, and a look must be exactly its appearance', async () => {
	for (const bad of [
		{ ...body, user_id: USER },
		{ ...body, look_id: 'biscuit' },
		{ ...body, appearance: { ...GINGER, fur: 'grey' } },
		{ ...body, appearance: { ...GINGER, ears: 'floppy' }, look_id: null },
		{ ...body, name: '' },
		{ ...body, traits: { ...body.traits, loyalty: 0 } }
	]) {
		const res = await send(route.POST, '/api/app/v1/pet', { method: 'POST', body: bad })
		assert.equal(res.status, 400, JSON.stringify(bad))
	}
	assert.equal(calls('create').length, 0)
})

test('POST: a Plus look needs a premium account, read from plan_type', async () => {
	const calico = { ...body, appearance: lookById('calico').appearance, look_id: 'calico' }
	const refused = await send(route.POST, '/api/app/v1/pet', { method: 'POST', body: calico })
	assert.equal(refused.status, 400)
	assert.equal(calls('create').length, 0)

	plan = 'premium'
	const allowed = await send(route.POST, '/api/app/v1/pet', { method: 'POST', body: calico })
	assert.equal(allowed.status, 201)
})

test('POST: every Plus option is refused from a free account, whatever the look', async () => {
	for (const plus of [
		{ pattern: 'patches' },
		{ pattern: 'spots' },
		{ eyes: 'odd' },
		{ eyes: 'ice' },
		{ ears: 'tufted' },
		{ ears: 'lynx' },
		{ body: 'buff' },
		{ pattern: 'tortie' },
		{ pattern: 'points' },
		{ pattern: 'brindle' },
		{ white: 'van' }
	]) {
		const res = await send(route.POST, '/api/app/v1/pet', {
			method: 'POST',
			body: { ...body, appearance: { ...GINGER, ...plus }, look_id: null }
		})
		assert.equal(res.status, 400, JSON.stringify(plus))
		assert.match(JSON.stringify(res.body), /comes with Kinpaw Plus/)
	}
	assert.equal(calls('create').length, 0)
})

test('POST: the new free options (v2 pet looks) save from a free account', async () => {
	const res = await send(route.POST, '/api/app/v1/pet', {
		method: 'POST',
		body: {
			...body,
			appearance: {
				...GINGER,
				fur: 'snow',
				eyes: 'copper',
				ears: 'folded',
				body: 'tiny',
				tail: 'bob',
				pattern: 'saddle',
				accent: 'chocolate',
				white: 'bicolour',
				trim: 'golden'
			},
			look_id: null
		}
	})
	assert.equal(res.status, 201)
	assert.equal(calls('create').length, 1)
})

test('POST: an appearance from an app before the layered coat is read as the same pet', async () => {
	// Six attributes, Socks and bib as a pattern: Tuxedo as the app sent it before 2026-10-03.
	const look = lookById('tuxedo').appearance
	const { species, fur, eyes, ears, tail } = look
	const tuxedo = { species, fur, eyes, ears, body: look.body, tail }
	const res = await send(route.POST, '/api/app/v1/pet', {
		method: 'POST',
		body: { ...body, appearance: { ...tuxedo, pattern: 'socks' }, look_id: 'tuxedo' }
	})
	assert.equal(res.status, 201)
	assert.equal(calls('create').length, 1)
})

// ── PATCH: Change look (M7) ──────────────────────────────────────────────────

const patch = (appearance: object, token?: null) =>
	send(route.PATCH, '/api/app/v1/pet', {
		method: 'PATCH',
		body: { appearance },
		...(token === null ? { token: null } : {})
	})

test('PATCH: a new free look is saved for the caller, with the look it now is', async () => {
	const curly = { ...GINGER, tail: 'curly' }
	const res = await patch(curly)
	assert.equal(res.status, 200)
	assert.ok(updatePetResponse.safeParse(res.body).success)
	assert.deepEqual(res.body.pet.appearance, curly)
	assert.equal(res.body.pet.look_id, null, 'no longer exactly a ready-made look')
	const [userId, appearance, look] = calls('updateAppearance')[0]?.args as [string, object, unknown]
	assert.equal(userId, USER)
	assert.deepEqual(appearance, curly)
	assert.equal(look, null)

	// Back to exactly Ginger: the look is found again.
	const back = await patch(GINGER)
	assert.equal(back.body.pet.look_id, 'ginger')
})

test('PATCH: a Plus option needs a premium account, read from plan_type', async () => {
	const odd = { ...GINGER, eyes: 'odd' }
	const refused = await patch(odd)
	assert.equal(refused.status, 400)
	assert.match(JSON.stringify(refused.body), /comes with Kinpaw Plus/)
	assert.equal(calls('updateAppearance').length, 0)

	plan = 'premium'
	const allowed = await patch(odd)
	assert.equal(allowed.status, 200)
	assert.deepEqual(allowed.body.pet.appearance, odd)
})

test("PATCH: a free account's pet keeps its species, and the body takes nothing but the appearance", async () => {
	const dog = lookById('biscuit').appearance
	const refused = await patch(dog)
	assert.equal(refused.status, 400)
	assert.match(JSON.stringify(refused.body), /keeps its species/)
	const extra = await send(route.PATCH, '/api/app/v1/pet', {
		method: 'PATCH',
		body: { appearance: GINGER, name: 'Rex' }
	})
	assert.equal(extra.status, 400)
	assert.equal(calls('updateAppearance').length, 0)
})

test("PATCH: a Plus member's cat can become a dog (from a photo), decided from plan_type", async () => {
	plan = 'premium'
	const dog = lookById('biscuit').appearance
	const saved = await patch(dog)
	assert.equal(saved.status, 200)
	assert.equal(saved.body.pet.appearance.species, 'dog')
	assert.deepEqual(calls('updateAppearance')[0]!.args[1], dog)
})

test('PATCH: no pet yet is a 404; no token is a 401', async () => {
	fakeStore(petStore, 'get', () => null)
	const missing = await patch(GINGER)
	assert.equal(missing.status, 404)
	assert.equal(missing.body.error.code, 'not_found')
	assert.equal((await patch(GINGER, null)).status, 401)
	assert.equal(calls('updateAppearance').length, 0)
})
