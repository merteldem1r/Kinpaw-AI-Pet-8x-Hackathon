// POST /api/track refuses what it can never record before it looks at who is calling: a body
// that is not a JSON object, and an event that is not in the registry.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { POST } from './route.ts'

const post = (body: string) =>
	POST(new NextRequest('http://web.test/api/track', { method: 'POST', body }))

test('a body that is not a JSON object', async () => {
	for (const body of ['not json', 'null', '"cta_clicked"', '[]']) {
		const res = await post(body)
		assert.equal(res.status, 400, body)
		assert.deepEqual(await res.json(), { ok: false })
	}
})

test('an event that is not registered, or no name at all', async () => {
	for (const body of [{ name: 'made_up_event' }, { name: 42 }, {}]) {
		const res = await post(JSON.stringify(body))
		assert.equal(res.status, 400)
		assert.deepEqual(await res.json(), { ok: false, error: 'unregistered_event' })
	}
})
