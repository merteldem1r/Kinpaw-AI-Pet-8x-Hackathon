// POST /api/contact refuses a body it can't take before anything is written, with the line the
// website's form shows (public-bodies.ts has what the body itself must hold).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { POST } from './route.ts'

const post = (body: string) =>
	POST(new NextRequest('http://web.test/api/contact', { method: 'POST', body }))

test('a body that is not JSON', async () => {
	const res = await post('{nope')
	assert.equal(res.status, 400)
	assert.deepEqual(await res.json(), { error: 'Invalid request body' })
})

test('a missing name, a bad address or an empty message', async () => {
	for (const body of [
		{ email: 'ada@x.io', message: 'hello' },
		{ name: 'Ada', email: 'ada', message: 'hello' },
		{ name: 'Ada', email: 'ada@x.io', message: '' },
		null
	]) {
		const res = await post(JSON.stringify(body))
		assert.equal(res.status, 400)
		assert.deepEqual(await res.json(), {
			error: 'Please fill in your name, a valid email, and a message'
		})
	}
})

test('a message over the limit has its own line', async () => {
	const res = await post(
		JSON.stringify({ name: 'Ada', email: 'ada@x.io', message: 'x'.repeat(5001) })
	)
	assert.equal(res.status, 400)
	assert.deepEqual(await res.json(), { error: 'Message is too long' })
})
