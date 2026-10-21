// POST /api/waitlist refuses a body it can't take before anything is written or sent to the
// platform, with the line the website's form shows.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { POST } from './route.ts'

const post = (body: string) =>
	POST(new NextRequest('http://web.test/api/waitlist', { method: 'POST', body }))

test('a body that is not JSON', async () => {
	const res = await post('not json')
	assert.equal(res.status, 400)
	assert.deepEqual(await res.json(), { error: 'Invalid request body' })
})

test('no address, or one that is not an address', async () => {
	for (const body of [{}, { email: 'mochi' }, { email: 42 }, null]) {
		const res = await post(JSON.stringify(body))
		assert.equal(res.status, 400)
		assert.deepEqual(await res.json(), { error: 'Please enter a valid email address' })
	}
})
