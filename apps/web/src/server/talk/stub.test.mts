// The pretend pet and which provider answers (m6-talk-requirements.md, R1–R2).
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { talkProvider } from './provider'
import { createStubProvider, stubIntent } from './stub'
import { CHECK_PETS } from './talk-check.fixtures'

const saved = { ...process.env }
afterEach(() => {
	for (const key of ['GROQ_API_KEY', 'GROQ_MODEL', 'NODE_ENV'] as const) {
		if (saved[key] === undefined) delete process.env[key]
		else process.env[key] = saved[key]
	}
})

test('stub: keywords pick the intent; a negated insult is not harsh', () => {
	assert.equal(stubIntent('I love you'), 'affectionate')
	assert.equal(stubIntent("Sorry, I didn't mean it"), 'apology')
	assert.equal(stubIntent('I hate you'), 'harsh')
	assert.equal(stubIntent("I don't hate you"), 'neutral')
	assert.equal(stubIntent('I had an awful day'), 'upset')
	assert.equal(stubIntent('What are you doing?'), 'neutral')
})

test('stub: an in-character reply for the species, and a suggestion from keywords', async () => {
	const result = await createStubProvider().reply({
		pet: CHECK_PETS[1]!,
		said: 'Are you hungry?',
		recent: []
	})
	assert.ok(result.ok)
	assert.equal(result.reply.suggestedAction, 'feed')
	assert.ok(result.reply.reply.length > 0)
})

test('provider: Groq with a key, with GROQ_MODEL honoured', () => {
	process.env.GROQ_API_KEY = 'gsk_test'
	process.env.GROQ_MODEL = 'qwen/qwen3.8-27b'
	const provider = talkProvider()
	assert.equal(provider?.name, 'groq')
	assert.equal(provider?.model, 'qwen/qwen3.8-27b')
})

test('provider: the stub without a key, except in production', () => {
	delete process.env.GROQ_API_KEY
	process.env.NODE_ENV = 'development'
	assert.equal(talkProvider()?.name, 'stub')
	process.env.NODE_ENV = 'production'
	assert.equal(talkProvider(), null)
})
