// Your pet from a photo's promises (features/v2-pet-from-photo-requirements.md, R11–R12): every
// Plus option in the catalog has a free nearest, a free account's read is always free and
// drawable, a free appearance passes through untouched, and the response accepts what the
// routes send and refuses what they mustn't.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	ATTRIBUTE_KEYS,
	FREE_NEAREST,
	freeVersionOf,
	HOST_MAX_BODY_BYTES,
	LOOKS,
	optionsFor,
	photoReadResponse,
	PHOTO_MAX_BASE64_LENGTH,
	PHOTO_MAX_BODY_BYTES,
	PHOTO_MAX_BYTES,
	randomAppearance,
	readPetPhotoBody,
	SPECIES,
	usesPremium,
	type PetAppearance
} from '../../index'

test('every Plus option in the catalog has a free nearest, which is free', () => {
	for (const species of SPECIES) {
		for (const key of ATTRIBUTE_KEYS) {
			for (const option of optionsFor(key, species).filter((o) => o.premium)) {
				const swap = FREE_NEAREST.find((s) => s.key === key && s.from === option.id)
				assert.ok(swap, `${species} ${key}.${option.id} has no free nearest`)
				const target = optionsFor(key, species).find((o) => o.id === swap.to)
				assert.ok(target && !target.premium, `${key}.${option.id} → ${swap.to} is not free`)
			}
		}
	}
})

test('a swap never names an option the catalog does not have', () => {
	for (const swap of FREE_NEAREST) {
		const ids = SPECIES.flatMap((species) => optionsFor(swap.key, species).map((o) => o.id))
		assert.ok(ids.includes(swap.from), `${swap.key}.${swap.from} is not in the catalog`)
		assert.ok(ids.includes(swap.to), `${swap.key}.${swap.to} is not in the catalog`)
	}
})

test('every Plus appearance becomes a free, valid one, and lists what changed', () => {
	let seeded = 1
	const random = () => ((seeded = (seeded * 16807) % 2147483647) - 1) / 2147483646
	const plus: PetAppearance[] = [
		...LOOKS.filter((look) => look.tier === 'premium').map((look) => look.appearance),
		...SPECIES.flatMap((species) =>
			Array.from({ length: 200 }, () => randomAppearance(species, { includePremium: true, random }))
		)
	].filter(usesPremium)
	assert.ok(plus.length > 100)
	for (const a of plus) {
		const { appearance, swapped } = freeVersionOf(a)
		assert.equal(usesPremium(appearance), false)
		assert.ok(swapped.length > 0)
		for (const swap of swapped) {
			assert.equal(a[swap.key], swap.from)
			assert.equal(appearance[swap.key], swap.to)
		}
	}
})

test('a free appearance comes back unchanged', () => {
	const free = LOOKS.filter((look) => look.tier === 'free').map((look) => look.appearance)
	for (const a of free) assert.deepEqual(freeVersionOf(a), { appearance: a, swapped: [] })
})

test('a white calico keeps its second colour as the coat, with white markings', () => {
	// The real calico of 2026-10-04: white, with ginger (and black) patches.
	const read: PetAppearance = {
		...LOOKS.find((look) => look.id === 'calico')!.appearance,
		fur: 'snow',
		pattern: 'patches',
		accent: 'ginger',
		white: 'bicolour'
	}
	const { appearance, swapped } = freeVersionOf(read)
	assert.equal(appearance.fur, 'ginger')
	assert.equal(appearance.pattern, 'solid')
	assert.equal(appearance.white, 'bicolour')
	assert.deepEqual(swapped, [{ key: 'pattern', from: 'patches', to: 'solid' }])
	// Patches in their own darker shade on a white coat: nothing else to keep, the coat stays.
	assert.equal(freeVersionOf({ ...read, accent: 'auto' }).appearance.fur, 'snow')
})

test('a calico keeps its white, a tortie gets ginger markings, only where they were defaults', () => {
	const calico = LOOKS.find((look) => look.id === 'calico')!.appearance
	const patchy = freeVersionOf({ ...calico, pattern: 'patches', white: 'none' }).appearance
	assert.equal(patchy.pattern, 'solid')
	assert.equal(patchy.white, 'bicolour')
	const socks = freeVersionOf({ ...calico, pattern: 'patches', white: 'socks' }).appearance
	assert.equal(socks.white, 'socks')

	const tortie = freeVersionOf({ ...calico, pattern: 'tortie', accent: 'auto' }).appearance
	assert.equal(tortie.pattern, 'tabby')
	assert.equal(tortie.accent, 'ginger')
	const chosen = freeVersionOf({ ...calico, pattern: 'tortie', accent: 'charcoal' }).appearance
	assert.equal(chosen.accent, 'charcoal')
})

test('the photo limit in base64 fits the photo limit in bytes', () => {
	assert.ok(PHOTO_MAX_BASE64_LENGTH >= (PHOTO_MAX_BYTES * 4) / 3)
	const body = { install_id: '00000000-0000-4000-8000-000000000000', image: 'a' }
	assert.equal(readPetPhotoBody.safeParse(body).success, true)
	assert.equal(readPetPhotoBody.safeParse({ ...body, extra: 1 }).success, false)
	const tooBig = { ...body, image: 'a'.repeat(PHOTO_MAX_BASE64_LENGTH + 1) }
	assert.equal(readPetPhotoBody.safeParse(tooBig).success, false)
})

test('the largest photo body fits under the host body limit, so our 413 is the one sent', () => {
	assert.ok(PHOTO_MAX_BODY_BYTES < HOST_MAX_BODY_BYTES)
})

test('the response: a read carries a drawable appearance; a limit names which', () => {
	const appearance = LOOKS[0]!.appearance
	assert.equal(
		photoReadResponse.safeParse({ outcome: 'read', appearance, swapped: [], left: 1 }).success,
		true
	)
	assert.equal(photoReadResponse.safeParse({ outcome: 'no_pet', left: 0 }).success, true)
	assert.equal(
		photoReadResponse.safeParse({ outcome: 'limit_reached', limit: 'device', left: 0 }).success,
		true
	)
	assert.equal(photoReadResponse.safeParse({ outcome: 'plus_required' }).success, true)
	assert.equal(
		photoReadResponse.safeParse({
			outcome: 'read',
			appearance: { species: 'cat' },
			swapped: [],
			left: 1
		}).success,
		false
	)
	assert.equal(photoReadResponse.safeParse({ outcome: 'limit_reached', left: 0 }).success, false)
})
