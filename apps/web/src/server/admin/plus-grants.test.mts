// Granting and taking back Kinpaw Plus from the admin screen (M7, R1–R3; non-negotiable 3): only
// an admin, checked before anything is read or written; only a real user id; the grant recorded
// under the admin's own id; and each outcome answered in words the screen can show.
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import type { NextResponse } from 'next/server'
import { createPlusActions } from './plus-grants.ts'

const ADMIN = '00000000-0000-4000-8000-0000000000ad'
const USER = '00000000-0000-4000-8000-000000000001'

type Who = 'admin' | 'signed_out' | 'not_admin'

let who: Who
let calls: { method: string; args: unknown[] }[]
let grantOutcome: 'granted' | 'already_premium' | 'no_profile'
let revokeOutcome: 'revoked' | 'not_a_grant' | 'no_profile'
let revalidated: number

const plus = createPlusActions({
	requireAdmin: async () => {
		if (who === 'admin') return { user: { id: ADMIN, email: 'admin@example.test' } }
		const status = who === 'signed_out' ? 401 : 403
		return { response: { status } as NextResponse }
	},
	profileStore: {
		grantPremium: async (...args) => {
			calls.push({ method: 'grantPremium', args })
			return grantOutcome
		},
		revokeGrant: async (...args) => {
			calls.push({ method: 'revokeGrant', args })
			return revokeOutcome
		}
	},
	log: { info: () => {} },
	revalidate: () => {
		revalidated += 1
	}
})

beforeEach(() => {
	who = 'admin'
	calls = []
	grantOutcome = 'granted'
	revokeOutcome = 'revoked'
	revalidated = 0
})

test('someone signed out or not an admin can neither grant nor revoke, and nothing is touched', async () => {
	for (const nobody of ['signed_out', 'not_admin'] as const) {
		who = nobody
		assert.deepEqual(await plus.grantPlus(USER, 'demo'), { ok: false, message: 'Not authorized.' })
		assert.deepEqual(await plus.revokePlus(USER), { ok: false, message: 'Not authorized.' })
	}
	assert.deepEqual(calls, [])
	assert.equal(revalidated, 0)
})

test('the check comes before the input: an outsider learns nothing from a bad id', async () => {
	who = 'not_admin'
	assert.deepEqual(await plus.grantPlus('not-a-uuid', null), {
		ok: false,
		message: 'Not authorized.'
	})
})

test("an admin grants Plus, recorded under the admin's own id with the reason trimmed", async () => {
	const result = await plus.grantPlus(USER, '  Demo for the judges  ')
	assert.deepEqual(result, { ok: true, message: 'Kinpaw Plus granted.' })
	assert.deepEqual(calls, [{ method: 'grantPremium', args: [USER, ADMIN, 'Demo for the judges'] }])
	assert.equal(revalidated, 1)
})

test('an empty reason is stored as none, and an over-long one is refused', async () => {
	await plus.grantPlus(USER, '   ')
	assert.deepEqual(calls[0]?.args, [USER, ADMIN, null])
	calls = []
	assert.deepEqual(await plus.grantPlus(USER, 'x'.repeat(201)), {
		ok: false,
		message: 'That request is not valid.'
	})
	assert.deepEqual(calls, [])
})

test('an id that is not a user id is refused before the store is asked', async () => {
	for (const id of ['', 'not-a-uuid', `${USER}; drop table profiles`]) {
		assert.deepEqual(await plus.grantPlus(id, null), {
			ok: false,
			message: 'That request is not valid.'
		})
		assert.deepEqual(await plus.revokePlus(id), {
			ok: false,
			message: 'That request is not valid.'
		})
	}
	assert.deepEqual(calls, [])
})

test('a grant says why nothing changed: already Plus, or no profile yet', async () => {
	grantOutcome = 'already_premium'
	assert.deepEqual(await plus.grantPlus(USER, null), {
		ok: false,
		message: 'This account already has Plus.'
	})
	grantOutcome = 'no_profile'
	assert.deepEqual(await plus.grantPlus(USER, null), {
		ok: false,
		message: 'This account has no profile yet.'
	})
})

test('an admin takes a grant back, recorded under their id; a subscription is not theirs to take', async () => {
	assert.deepEqual(await plus.revokePlus(USER), { ok: true, message: 'Kinpaw Plus taken back.' })
	assert.deepEqual(calls, [{ method: 'revokeGrant', args: [USER, ADMIN, null] }])

	revokeOutcome = 'not_a_grant'
	assert.deepEqual(await plus.revokePlus(USER), {
		ok: false,
		message: 'Only a grant can be taken back here, not a subscription.'
	})
	revokeOutcome = 'no_profile'
	assert.deepEqual(await plus.revokePlus(USER), {
		ok: false,
		message: 'This account has no profile yet.'
	})
})
