// Friends (v2-friends-requirements.md): the code read the way people type it (R7), the needs as
// words (R11), and the wire shapes refusing anything a friend may not see (R13).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	FRIEND_CODE_ALPHABET,
	LOOKS,
	addFriendBody,
	formatFriendCode,
	friendPetSchema,
	friendSchema,
	needBand,
	needBands,
	normalizeFriendCode
} from '../../index'

test('a code is read without case, spaces or the dash', () => {
	assert.equal(normalizeFriendCode('KP7X-M3QD'), 'KP7XM3QD')
	assert.equal(normalizeFriendCode(' kp7x m3qd '), 'KP7XM3QD')
	assert.equal(normalizeFriendCode('kp7xm3qd'), 'KP7XM3QD')
})

test('a code that cannot be one is refused', () => {
	assert.equal(normalizeFriendCode('KP7XM3Q'), null)
	assert.equal(normalizeFriendCode('KP7XM3QDA'), null)
	// Look-alikes are not in the alphabet.
	for (const ch of ['0', 'O', '1', 'I', 'L']) {
		assert.equal(FRIEND_CODE_ALPHABET.includes(ch), false)
		assert.equal(normalizeFriendCode(`KP7XM3Q${ch}`), null)
	}
	assert.equal(
		addFriendBody.safeParse({ code: 'nope', source: 'typed', time_zone: 'UTC' }).success,
		false
	)
})

test('a code is shown in two groups of four', () => {
	assert.equal(formatFriendCode('KP7XM3QD'), 'KP7X-M3QD')
})

test('needs become words at the whole numbers people see', () => {
	assert.equal(needBand(0), 'low')
	assert.equal(needBand(29.4), 'low')
	assert.equal(needBand(29.5), 'okay')
	assert.equal(needBand(69.4), 'okay')
	assert.equal(needBand(69.5), 'good')
	assert.equal(needBand(100), 'good')
	assert.deepEqual(needBands({ hunger: 10, happiness: 50, energy: 90, affection: 70 }), {
		hunger: 'low',
		happiness: 'okay',
		energy: 'good',
		affection: 'good'
	})
})

const PET = {
	appearance: LOOKS[0].appearance,
	name: 'Luna',
	mood: 'content',
	needs: { hunger: 'low', happiness: 'okay', energy: 'good', affection: 'okay' }
}

test("a friend's pet carries only what a friend may see", () => {
	assert.equal(friendPetSchema.safeParse(PET).success, true)
	for (const extra of [
		{ id: '7f0c9a52-5b7e-4b8e-9a51-3f0f7c1d2a10' },
		{ traits: {} },
		{ preset: 'cuddly' },
		{ needs_exact: { hunger: 10 } }
	]) {
		assert.equal(friendPetSchema.safeParse({ ...PET, ...extra }).success, false)
	}
	const friend = {
		id: '7f0c9a52-5b7e-4b8e-9a51-3f0f7c1d2a10',
		display_name: null,
		since: '2026-10-06T10:00:00.000Z',
		pet: PET
	}
	assert.equal(friendSchema.safeParse(friend).success, true)
	for (const extra of [{ email: 'a@b.c' }, { avatar_url: 'x' }, { user_id: friend.id }]) {
		assert.equal(friendSchema.safeParse({ ...friend, ...extra }).success, false)
	}
})
