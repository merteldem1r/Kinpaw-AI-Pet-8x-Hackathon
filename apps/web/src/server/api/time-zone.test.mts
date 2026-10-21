import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApiError } from './app-errors.ts'
import { requireTimeZone } from './time-zone.ts'

test('a real IANA zone is passed through', () => {
	assert.equal(requireTimeZone('Europe/Istanbul'), 'Europe/Istanbul')
	assert.equal(requireTimeZone('UTC'), 'UTC')
})

test('a zone the server cannot use is a 400 on time_zone', () => {
	for (const zone of ['Mars/Olympus', 'not a zone', '']) {
		assert.throws(
			() => requireTimeZone(zone),
			(error: unknown) =>
				error instanceof ApiError &&
				error.code === 'invalid_request' &&
				error.status === 400 &&
				error.issues?.[0]?.path === 'time_zone'
		)
	}
})
