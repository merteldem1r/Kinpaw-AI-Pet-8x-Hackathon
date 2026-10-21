// The model's answer check (m6-talk-requirements.md, R5): only the seven intents, a real reply,
// "none" as no suggestion, and a reply cut to fit the bubble.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TALK_REPLY_MAX } from '@app/contract'
import { parsePetReply, tidyReply } from './reply-schema'

test('a good answer becomes a reply; "none" is no suggestion', () => {
	assert.deepEqual(
		parsePetReply({ reply: ' Purr. Tell me more! ', intent: 'kind', suggested_action: 'none' }),
		{
			reply: 'Purr. Tell me more!',
			intent: 'kind',
			suggestedAction: null,
			memory: null,
			recalled: null
		}
	)
	assert.equal(
		parsePetReply({ reply: 'Dinner?', intent: 'neutral', suggested_action: 'feed' })
			?.suggestedAction,
		'feed'
	)
})

test('anything else is not a reply', () => {
	const good = { reply: 'Hi!', intent: 'kind', suggested_action: 'none' }
	assert.equal(parsePetReply({ ...good, intent: 'grumpy' }), null)
	assert.equal(parsePetReply({ ...good, suggested_action: 'sleep' }), null)
	assert.equal(parsePetReply({ ...good, reply: '   ' }), null)
	assert.equal(parsePetReply({ reply: 'Hi!', intent: 'kind' }), null)
	assert.equal(parsePetReply('Hi!'), null)
	assert.equal(parsePetReply(null), null)
})

test('tidyReply: whitespace collapsed, wrapping quotes removed', () => {
	assert.equal(tidyReply('  "Hello\n  you."  '), 'Hello you.')
	assert.equal(tidyReply('“Hi there.”'), 'Hi there.')
})

test('tidyReply: a long reply is cut at the last sentence that fits', () => {
	const first = 'I was napping in the sun all afternoon, and it was glorious.'
	const second =
		'Then a bird landed on the windowsill and I had to stare at it for a very long time.'
	const third = 'Anyway, how was your day? Mine was mostly naps, and one very serious stretch.'
	const long = `${first} ${second} ${third}`
	assert.ok(long.length > TALK_REPLY_MAX)
	const cut = tidyReply(long)
	assert.ok(cut.length <= TALK_REPLY_MAX)
	assert.equal(cut, `${first} ${second} Anyway, how was your day?`)
})

test('tidyReply: no sentence end in reach cuts at a word, with an ellipsis', () => {
	const cut = tidyReply('meow '.repeat(60))
	assert.ok(cut.length <= TALK_REPLY_MAX)
	assert.ok(cut.endsWith('meow…'))
})
