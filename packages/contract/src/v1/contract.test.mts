// The v1 contract's promises, as tests: what each schema accepts, what it
// refuses, and the evolution rules (docs/rules/mobile-data.md): a response may
// gain a field, never an enum value; a request body names only what it allows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	appConfigSchema,
	createPetBody,
	updatePetBody,
	DEFAULT_LOOK,
	isPremiumLook,
	LOOKS,
	lookById,
	looksFor,
	petNameSchema,
	hasCustomTraits,
	PRESETS,
	presetTraits,
	TRAITS,
	traitsSchema,
	createUploadBody,
	endpoints,
	errorBodySchema,
	MAX_AVATAR_BYTES,
	pageQuery,
	profileResponse,
	profileSchema,
	updateProfileBody
} from '../../index'

const ID = '0b6a7c1e-4f3d-4c2a-9e8b-1d2c3b4a5f60'
const USER = '00000000-0000-4000-8000-000000000001'
const NOW = '2026-09-24T09:14:11.831Z'

const profile = {
	id: USER,
	email: 'sam@example.com',
	display_name: null,
	avatar_url: null,
	plan: 'free',
	locale: null,
	marketing_consent: false,
	created_at: NOW
}

test('config: the shape every installed build reads, byte for byte', () => {
	const body = {
		min_supported_version: { ios: '1.3.0', android: '1.3' },
		store_url: {
			ios: 'https://apps.apple.com/app/id1234567890',
			android: 'https://play.google.com/store/apps/details?id=com.example.app'
		}
	}
	assert.deepEqual(appConfigSchema.parse(body), body)
	const none = {
		min_supported_version: { ios: null, android: null },
		store_url: { ios: null, android: null }
	}
	assert.deepEqual(appConfigSchema.parse(none), none)
})

test('config: refuses what the app would refuse', () => {
	const base = {
		min_supported_version: { ios: null, android: null },
		store_url: { ios: null, android: null }
	}
	for (const [name, body] of [
		[
			'a minimum with no store URL',
			{ ...base, min_supported_version: { ios: '2', android: null } }
		],
		['four version parts', { ...base, min_supported_version: { ios: '1.2.3.4', android: null } }],
		[
			'an http store URL',
			{ ...base, store_url: { ios: 'http://apps.apple.com/x', android: null } }
		],
		['a missing key', { min_supported_version: base.min_supported_version }]
	] as const) {
		assert.equal(appConfigSchema.safeParse(body).success, false, name)
	}
})

test('a response may gain a field: unknown keys are dropped, not refused', () => {
	const parsed = profileResponse.parse({
		profile: { ...profile, color: 'blue' },
		total: 1
	})
	assert.deepEqual(parsed, { profile })
})

test('a response never gains an enum value: an unknown one fails the parse', () => {
	assert.equal(profileSchema.safeParse({ ...profile, plan: 'gold' }).success, false)
})

test('profile: plan is read-only, and nothing server-controlled can be sent', () => {
	for (const field of ['plan', 'plan_type', 'premium_status', 'is_admin', 'region', 'id']) {
		const result = updateProfileBody.safeParse({ display_name: 'Sam', [field]: 'premium' })
		assert.equal(result.success, false, field)
	}
})

test('profile: an update names at least one field, trimmed and bounded', () => {
	assert.equal(updateProfileBody.safeParse({}).success, false)
	assert.deepEqual(updateProfileBody.parse({ display_name: '  Sam  ' }), { display_name: 'Sam' })
	assert.equal(updateProfileBody.safeParse({ display_name: 'x'.repeat(81) }).success, false)
	assert.equal(updateProfileBody.safeParse({ display_name: '   ' }).success, false)
	assert.deepEqual(updateProfileBody.parse({ display_name: null }), { display_name: null })
	assert.equal(updateProfileBody.safeParse({ locale: 'pt-BR' }).success, true)
	assert.equal(updateProfileBody.safeParse({ locale: 'not a locale' }).success, false)
})

test('profile: avatar_path only in the shape uploads hands out', () => {
	const ok = `${USER}/avatar/${ID}.jpg`
	assert.equal(updateProfileBody.safeParse({ avatar_path: ok }).success, true)
	for (const bad of [
		`../${USER}/avatar/${ID}.jpg`,
		`${USER}/avatar/${ID}.exe`,
		`${USER}/other/${ID}.jpg`,
		`https://example.com/${ID}.jpg`
	]) {
		assert.equal(updateProfileBody.safeParse({ avatar_path: bad }).success, false, bad)
	}
})

test('profile response parses a complete profile', () => {
	assert.deepEqual(profileResponse.parse({ profile }), { profile })
})

test('uploads: avatars only, by content type and size', () => {
	const ok = { purpose: 'avatar', content_type: 'image/png', size_bytes: 1024 }
	assert.equal(createUploadBody.safeParse(ok).success, true)
	assert.equal(createUploadBody.safeParse({ ...ok, content_type: 'image/gif' }).success, false)
	assert.equal(
		createUploadBody.safeParse({ ...ok, size_bytes: MAX_AVATAR_BYTES + 1 }).success,
		false
	)
	assert.equal(createUploadBody.safeParse({ ...ok, purpose: 'video' }).success, false)
	// Strict: the server knows who is asking; a body never names a user.
	assert.equal(createUploadBody.safeParse({ ...ok, user_id: USER }).success, false)
})

test('pages: limit from the query string, bounded', () => {
	assert.deepEqual(pageQuery.parse({ limit: '20', cursor: 'abc' }), { limit: 20, cursor: 'abc' })
	assert.deepEqual(pageQuery.parse({ unrelated: 'x' }), {})
	for (const limit of ['0', '101', '1.5', 'many']) {
		assert.equal(pageQuery.safeParse({ limit }).success, false, limit)
	}
})

test('pets: four looks per species, one premium each, a free default', () => {
	for (const species of ['cat', 'dog'] as const) {
		const looks = looksFor(species)
		assert.equal(looks.length, 4, species)
		assert.equal(looks.filter((look) => look.tier === 'premium').length, 1, species)
		assert.equal(isPremiumLook(DEFAULT_LOOK[species]), false, species)
	}
	assert.equal(new Set(LOOKS.map((look) => look.id)).size, LOOKS.length)
})

test('pets: a preset stores each trait as its dots doubled, inside 1–10', () => {
	for (const preset of PRESETS) {
		const traits = presetTraits(preset.id)
		assert.deepEqual(Object.keys(traits).sort(), [...TRAITS].sort(), preset.id)
		assert.equal(traitsSchema.safeParse(traits).success, true, preset.id)
		for (const trait of TRAITS) assert.equal(traits[trait], preset.dots[trait] * 2)
	}
	assert.equal(presetTraits('cuddly').affection, 10)
})

test('pets: traits are custom once any one leaves its preset', () => {
	const cuddly = presetTraits('cuddly')
	assert.equal(hasCustomTraits('cuddly', cuddly), false)
	assert.equal(hasCustomTraits('cuddly', { ...cuddly, energy: cuddly.energy + 2 }), true)
	assert.equal(hasCustomTraits('curious', cuddly), true)
})

test('pets: a name is 1–20 characters once trimmed', () => {
	assert.equal(petNameSchema.parse('  Mochi '), 'Mochi')
	assert.equal(petNameSchema.safeParse('   ').success, false)
	assert.equal(petNameSchema.safeParse('x'.repeat(20)).success, true)
	assert.equal(petNameSchema.safeParse('x'.repeat(21)).success, false)
})

test('pets: a save names only its own fields, a look that is its appearance, a valid name', () => {
	const ginger = lookById('ginger').appearance
	const body = {
		id: ID,
		appearance: ginger,
		look_id: 'ginger',
		name: ' Mochi ',
		preset: 'cuddly',
		traits: presetTraits('cuddly')
	}
	assert.equal(createPetBody.parse(body).name, 'Mochi')
	// A customized or built pet names no look.
	assert.equal(
		createPetBody.safeParse({ ...body, appearance: { ...ginger, tail: 'curly' }, look_id: null })
			.success,
		true
	)
	assert.equal(createPetBody.safeParse({ ...body, user_id: USER }).success, false)
	assert.equal(createPetBody.safeParse({ ...body, species: 'cat' }).success, false)
	assert.equal(createPetBody.safeParse({ ...body, look_id: 'biscuit' }).success, false)
	assert.equal(
		createPetBody.safeParse({ ...body, appearance: { ...ginger, fur: 'grey' } }).success,
		false
	)
	assert.equal(
		createPetBody.safeParse({ ...body, appearance: { ...ginger, ears: 'floppy' }, look_id: null })
			.success,
		false
	)
	assert.equal(createPetBody.safeParse({ ...body, name: '  ' }).success, false)
	assert.equal(
		createPetBody.safeParse({ ...body, traits: { ...body.traits, energy: 11 } }).success,
		false
	)
})

test('Change look sends an appearance and nothing else', () => {
	const ginger = lookById('ginger').appearance
	assert.deepEqual(updatePetBody.parse({ appearance: ginger }), { appearance: ginger })
	assert.equal(updatePetBody.safeParse({ appearance: ginger, look_id: 'ginger' }).success, false)
	assert.equal(updatePetBody.safeParse({ appearance: ginger, name: 'Rex' }).success, false)
	// Dog ears on a cat is not an appearance.
	assert.equal(
		updatePetBody.safeParse({ appearance: { ...ginger, ears: 'floppy' } }).success,
		false
	)
})

test('an error body parses a code the app does not know yet', () => {
	const body = { error: { code: 'rate_limited', message: 'Slow down.' } }
	assert.deepEqual(errorBodySchema.parse(body), body)
})

test('every endpoint: under /api/app/v1, one per method and path, a body only on writes', () => {
	const seen = new Set<string>()
	for (const [name, endpoint] of Object.entries(endpoints)) {
		assert.match(endpoint.path, /^\/api\/app\/v1\/[a-z/:]+$/, name)
		const key = `${endpoint.method} ${endpoint.path}`
		assert.equal(seen.has(key), false, key)
		seen.add(key)
		const hasBody = 'body' in endpoint
		assert.equal(hasBody, endpoint.method === 'POST' || endpoint.method === 'PATCH', name)
		if (endpoint.status === 201) assert.equal(endpoint.method, 'POST', name)
	}
	// Public on purpose, and only these: the config the app reads before sign-in, and the photo
	// read while creating a pet signed out (v2-pet-from-photo-requirements.md, R19–R25: limited
	// per iPhone, network and day instead of by sign-in).
	const PUBLIC = ['getConfig', 'readPetPhoto']
	for (const [name, endpoint] of Object.entries(endpoints)) {
		assert.equal(endpoint.auth, PUBLIC.includes(name) ? 'public' : 'user', name)
	}
})
