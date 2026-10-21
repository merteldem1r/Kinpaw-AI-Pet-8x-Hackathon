// The one email check, shared by the app's sign-in and the website's forms: loose on purpose
// (the mail server is the real check), and an address is trimmed and lower-cased before it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emailAddress, looksLikeEmail } from '../../index'

test('an address with a local part, an @ and a dotted domain looks like one', () => {
	for (const ok of ['mochi@kinpaw.app', 'a.b+tag@mail.example.co.uk', 'x@y.z']) {
		assert.equal(looksLikeEmail(ok), true, ok)
	}
})

test('anything missing a part, or with a space, does not', () => {
	for (const bad of ['', 'mochi', 'mochi@', '@kinpaw.app', 'mochi@kinpaw', 'mo chi@kinpaw.app']) {
		assert.equal(looksLikeEmail(bad), false, bad)
	}
})

test('a form address is trimmed and lower-cased, then checked', () => {
	assert.equal(emailAddress.parse('  Mochi@KinPaw.App \n'), 'mochi@kinpaw.app')
	assert.equal(emailAddress.safeParse(' not an email ').success, false)
	assert.equal(emailAddress.safeParse(42).success, false)
})
