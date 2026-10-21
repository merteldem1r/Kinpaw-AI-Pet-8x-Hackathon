// POST /api/app/v1/pet/talk (m6-talk-requirements.md, R8–R16). The owner is the verified caller;
// the body carries words, never needs. A counted reply is recorded first-party once a day per
// input, the account's first one also activates it, and nothing said or replied ever reaches an
// event or a log line. The stub answers (no GROQ_API_KEY in tests), except where Groq is made
// unreachable on purpose.
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { lookById, presetTraits, talkResponse } from '@app/contract'
import { fake, fakeStore, reset, send } from '@/server/api/app-test-kit.mts'

const route = await import('./route')
const { petStore } = await import('@/server/db/pets')
const { profileStore } = await import('@/server/db/profiles')
const { talkStore } = await import('@/server/db/talk')
const { aiUsageStore } = await import('@/server/db/ai-usage')
const { analyticsStore } = await import('@/server/db/analytics')
const { memoryStore } = await import('@/server/db/memory')

const NOW = new Date('2026-10-01T12:00:00.000Z')
const row = {
	id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
	...lookById('ginger').appearance,
	look: 'ginger',
	name: 'Mochi',
	preset: 'cuddly',
	...presetTraits('cuddly'),
	needs: { hunger: 60, happiness: 50, energy: 80, affection: 50, updatedAt: NOW },
	createdAt: NOW,
	updatedAt: NOW
}
const SAID = 'I had a really nice day, thanks'
const body = {
	message_id: '0b6f3c62-6a43-4c39-9d3a-3c8f1a2b9e11',
	text: SAID,
	input: 'voice',
	time_zone: 'Europe/Istanbul',
	recent: []
}

const applied = (overrides: object = {}) => ({
	row,
	outcome: 'replied',
	added: { happiness: 2, affection: 4 },
	countedToday: 1,
	first: false,
	...overrides
})

beforeEach(() => {
	reset()
	delete process.env.GROQ_API_KEY
	fakeStore(petStore, 'get', () => row)
	fakeStore(memoryStore, 'pick', () => [])
	fakeStore(memoryStore, 'save', () => ({ kind: 'duplicate' }))
	fakeStore(profileStore, 'isPremium', () => false)
	fakeStore(profileStore, 'personName', () => null)
	fakeStore(profileStore, 'regionOf', () => null)
	fakeStore(profileStore, 'playEventProfile', () => ({
		region: 'TR',
		locale: 'en',
		marketingConsent: false,
		planType: 'free'
	}))
	fakeStore(talkStore, 'status', () => ({
		counted: 0,
		gained: { happiness: 0, affection: 0 },
		alreadyCounted: false
	}))
	fakeStore(talkStore, 'apply', () => applied())
	fakeStore(aiUsageStore, 'record', () => undefined)
	fakeStore(analyticsStore, 'hasDuplicate', () => false)
	fakeStore(analyticsStore, 'insertEvent', () => undefined)
})

const calls = (method: string) => fake.storeCalls.filter((call) => call.method === method)
const events = () => calls('insertEvent').map((call) => call.args[0] as { name: string })
const post = (sent: unknown, token?: null) =>
	send(route.POST, '/api/app/v1/pet/talk', {
		method: 'POST',
		body: sent,
		...(token === null ? { token } : {})
	})

test('the pet answers, and the reply counted', async () => {
	const res = await post(body)
	assert.equal(res.status, 200)
	assert.ok(talkResponse.safeParse(res.body).success)
	assert.equal(res.body.outcome, 'replied')
	assert.equal(res.body.intent, 'kind')
	assert.ok(res.body.reply.length > 0)
	assert.equal(res.body.need_changed, true)
	assert.equal(res.body.messages_left, 9)
	assert.equal(res.body.pet.name, 'Mochi')
})

test('talk_reply_received: its input and intent, never the words, the reply or the name', async () => {
	const res = await post(body)
	const recorded = JSON.stringify(calls('insertEvent'))
	assert.match(recorded, /talk_reply_received/)
	assert.match(recorded, /"input":"voice"/)
	assert.match(recorded, /"intent":"kind"/)
	assert.doesNotMatch(recorded, /really nice day/)
	assert.ok(!recorded.includes(res.body.reply))
	assert.doesNotMatch(recorded, /Mochi/)
	assert.match(JSON.stringify(calls('hasDuplicate')[0]?.args), /voice/)
})

test('upset reaches analytics as "other"', async () => {
	await post({ ...body, text: 'I had an awful day' })
	assert.match(JSON.stringify(calls('insertEvent')), /"intent":"other"/)
	assert.doesNotMatch(JSON.stringify(calls('insertEvent')), /upset/)
})

test("the account's first counted reply activates it, first-party and on the Play Events API", async () => {
	fakeStore(talkStore, 'apply', () => applied({ first: true }))
	await post(body)
	assert.deepEqual(
		events().map((event) => event.name),
		['talk_reply_received', 'user_activated']
	)
	const playEvents = fake.fetchCalls.filter((call) => call.url.host === 'platform.test')
	assert.equal(playEvents.length, 1)
	assert.match(JSON.stringify(playEvents[0]?.body), /"event":"user_activated"/)
	assert.match(JSON.stringify(playEvents[0]?.body), /activated:/)
})

test('a later reply does not activate again', async () => {
	await post(body)
	assert.deepEqual(
		events().map((event) => event.name),
		['talk_reply_received']
	)
	assert.equal(fake.fetchCalls.filter((call) => call.url.host === 'platform.test').length, 0)
})

test('a retry answers again, records nothing, and changes nothing', async () => {
	fakeStore(talkStore, 'apply', () =>
		applied({ outcome: 'retried', added: { happiness: 0, affection: 0 } })
	)
	const res = await post(body)
	assert.equal(res.status, 200)
	assert.equal(res.body.outcome, 'retried')
	assert.equal(res.body.need_changed, false)
	assert.equal(calls('insertEvent').length, 0)
})

test('a full day: the limit, the pet as it is, no model call and no event', async () => {
	fakeStore(talkStore, 'status', () => ({
		counted: 10,
		gained: { happiness: 0, affection: 0 },
		alreadyCounted: false
	}))
	const res = await post(body)
	assert.equal(res.status, 200)
	assert.deepEqual(
		{ outcome: res.body.outcome, left: res.body.messages_left },
		{ outcome: 'limit_reached', left: 0 }
	)
	assert.ok(talkResponse.safeParse(res.body).success)
	assert.equal(calls('record').length, 0)
	assert.equal(calls('insertEvent').length, 0)
})

test('Groq unreachable: 503 talk_unavailable, nothing counted, and no words in the logs', async () => {
	// The test kit's fetch answers 500 to anything it doesn't know, Groq included.
	process.env.GROQ_API_KEY = 'gsk_test'
	const res = await post(body)
	assert.equal(res.status, 503)
	assert.equal(res.body.error.code, 'talk_unavailable')
	assert.equal(calls('apply').length, 0)
	assert.equal((calls('record')[0]?.args[0] as { outcome: string }).outcome, 'unavailable')
	assert.doesNotMatch(JSON.stringify(res.logs), /really nice day/)
	assert.doesNotMatch(JSON.stringify(res.logs), /gsk_test/)
})

test('no pet yet is a 404, and nothing is asked or recorded', async () => {
	fakeStore(petStore, 'get', () => null)
	const res = await post(body)
	assert.equal(res.status, 404)
	assert.equal(calls('apply').length, 0)
	assert.equal(calls('insertEvent').length, 0)
})

test('a time zone that is not real is a 400', async () => {
	const res = await post({ ...body, time_zone: 'Mars/Olympus' })
	assert.equal(res.status, 400)
	assert.equal(res.body.error.issues[0].path, 'time_zone')
})

test('the body carries words, never needs: anything else is a 400', async () => {
	assert.equal((await post({ ...body, needs: { happiness: 100 } })).status, 400)
	assert.equal((await post({ ...body, text: '   ' })).status, 400)
	assert.equal(calls('apply').length, 0)
})

test('no session is a 401', async () => {
	const res = await post(body, null)
	assert.equal(res.status, 401)
	assert.equal(calls('get').length, 0)
})

// ── Long-term memory (v2-memory-requirements.md, R12–R15) ─────────────────────────────────────

const KEPT = {
	id: '3f1c2b9e-6a43-4c39-9d3a-0b6f3c626a43',
	text: 'I have a dog called Kara',
	followUp: null,
	category: 'other',
	kind: 'lasting',
	importance: 1,
	tags: ['have', 'called', 'kara'],
	followUpOn: null,
	followedUpAt: null,
	source: 'talk',
	lastUsedAt: null,
	createdAt: NOW
}

test('a reply that keeps a fact: the fact comes back, and memory_saved has only its labels', async () => {
	fakeStore(memoryStore, 'save', () => ({ kind: 'saved', memory: KEPT, replaced: false }))
	const res = await post({ ...body, text: 'Remember that I have a dog called Kara' })
	assert.equal(res.status, 200)
	assert.ok(talkResponse.safeParse(res.body).success)
	assert.deepEqual(res.body.remembered, { id: KEPT.id, text: KEPT.text })

	const recorded = calls('insertEvent').map(
		(call) => call.args[0] as { name: string; metadata: object }
	)
	const saved = recorded.find((event) => event.name === 'memory_saved')
	assert.deepEqual(saved?.metadata, {
		source: 'talk',
		category: 'other',
		kind: 'lasting',
		replaced: false
	})
	assert.doesNotMatch(JSON.stringify(recorded), /Kara/)
})

test('nothing kept: no remembered, no memory_saved', async () => {
	const res = await post(body)
	assert.equal(res.body.remembered, undefined)
	assert.ok(!events().some((event) => event.name === 'memory_saved'))
})

// The voice started early (v2-voice, 2026-10-06): with `voice: true` the talk route starts the
// reply's voice before it answers, and the voice route hands that one over instead of a second.
test('voice: true starts the reply’s voice at once; the voice route picks it up', async () => {
	process.env.FAL_KEY = 'fal-test-key'
	try {
		const AUDIO = 'https://v3b.fal.media/files/voice.wav'
		fake.fal = () => Response.json({ audio: { url: AUDIO } })
		fakeStore(aiUsageStore, 'countSince', () => 0)
		const voiceRoute = await import('../voice/route')
		const messageId = '0b6f3c62-6a43-4c39-9d3a-3c8f1a2b9e99'

		const res = await post({ ...body, message_id: messageId, voice: true })
		assert.equal(res.status, 200)
		const falCalls = () => fake.fetchCalls.filter((call) => call.url.host === 'fal.run')
		await new Promise((resolve) => setImmediate(resolve))
		assert.equal(falCalls().length, 1, 'started before the phone asks')
		assert.equal((falCalls()[0]?.body as { text: string }).text, res.body.reply)

		const voice = await send(voiceRoute.POST, '/api/app/v1/pet/voice', {
			method: 'POST',
			body: { message_id: messageId, text: res.body.reply }
		})
		assert.deepEqual(voice.body, {
			outcome: 'spoken',
			audio_url: AUDIO,
			duration_ms: 0,
			playback_rate: 1.15
		})
		assert.equal(falCalls().length, 1, 'not made twice')
		assert.equal(calls('countedReply').length, 0, 'no second check: the job was this person’s')
	} finally {
		delete process.env.FAL_KEY
	}
})

test('without voice: true, no voice is made', async () => {
	process.env.FAL_KEY = 'fal-test-key'
	try {
		await post(body)
		assert.equal(fake.fetchCalls.filter((call) => call.url.host === 'fal.run').length, 0)
	} finally {
		delete process.env.FAL_KEY
	}
})
