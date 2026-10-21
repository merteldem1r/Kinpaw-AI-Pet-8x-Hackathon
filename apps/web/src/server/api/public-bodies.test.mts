// The public routes' bodies (public-bodies.ts): what each accepts, cleaned, and what it refuses.
// The routes' own answers to a refused body are in each route's test.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
	CONTACT_MESSAGE_MAX,
	contactBody,
	contactMessageTooLong,
	deletionRequestBody,
	trackBody,
	waitlistBody
} from './public-bodies.ts'

test('waitlist: the address trimmed and lower-cased; anything else is refused', () => {
	assert.deepEqual(waitlistBody.parse({ email: ' Mochi@Kinpaw.App ' }), {
		email: 'mochi@kinpaw.app'
	})
	for (const body of [{}, { email: 'mochi' }, { email: 42 }, null, 'mochi@kinpaw.app']) {
		assert.equal(waitlistBody.safeParse(body).success, false, JSON.stringify(body))
	}
})

test('contact: a name, an address and a message of at least two characters, trimmed', () => {
	assert.deepEqual(contactBody.parse({ name: ' Ada ', email: 'ADA@x.io', message: '  hi  ' }), {
		name: 'Ada',
		email: 'ada@x.io',
		message: 'hi'
	})
	for (const body of [
		{ name: '  ', email: 'ada@x.io', message: 'hello' },
		{ name: 'Ada', email: 'ada', message: 'hello' },
		{ name: 'Ada', email: 'ada@x.io', message: ' h ' }
	]) {
		const result = contactBody.safeParse(body)
		assert.equal(result.success, false, JSON.stringify(body))
		assert.equal(contactMessageTooLong(result.error!), false)
	}
})

test('contact: a message over the limit is told apart from a missing field', () => {
	const result = contactBody.safeParse({
		name: 'Ada',
		email: 'ada@x.io',
		message: 'x'.repeat(CONTACT_MESSAGE_MAX + 1)
	})
	assert.equal(result.success, false)
	assert.equal(contactMessageTooLong(result.error!), true)
})

test('deletion request: an address and an explicit confirm: true', () => {
	assert.deepEqual(deletionRequestBody.parse({ email: ' ADA@x.io', confirm: true }), {
		email: 'ada@x.io',
		confirm: true
	})
	for (const confirm of [false, 'true', 1, undefined]) {
		assert.equal(deletionRequestBody.safeParse({ email: 'ada@x.io', confirm }).success, false)
	}
})

test('track: a field of the wrong type is dropped, never the event', () => {
	const body = trackBody.parse({ name: 'cta_clicked', path: 7, sessionId: ['s'] })
	assert.equal(body.name, 'cta_clicked')
	assert.equal(body.path, undefined)
	assert.equal(body.sessionId, undefined)
	assert.equal(trackBody.parse({ name: 3 }).name, '')
	for (const body of [null, 'cta_clicked', []]) {
		assert.equal(trackBody.safeParse(body).success, false, JSON.stringify(body))
	}
})
