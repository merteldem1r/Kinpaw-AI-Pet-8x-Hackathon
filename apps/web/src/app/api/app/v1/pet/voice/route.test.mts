// Mochi speaks over HTTP (v2-voice-requirements.md, R1–R6, R13): only a reply just counted, once;
// the voice from the pet and the emotion from the counted intent, never from the body; the
// limits; a failed voice; and the words never in a log, an event or ai_usage.
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { VOICE_DAILY_ALL, VOICE_DAILY_FREE, VOICE_DAILY_PLUS, voiceResponse } from '@app/contract'
import { fake, fakeStore, reset, send, USER } from '@/server/api/app-test-kit.mts'

const route = await import('./route')
const { talkStore } = await import('@/server/db/talk')
const { introStore } = await import('@/server/db/intro')
const { aiUsageStore } = await import('@/server/db/ai-usage')
const { profileStore } = await import('@/server/db/profiles')
const { analyticsStore } = await import('@/server/db/analytics')

const WORDS = 'I missed you so much today! Did you bring snacks?'
const AUDIO = 'https://v3.fal.media/files/voice/abc.mp3'
let messageNumber = 0
/** A fresh message id each test: a spoken one is remembered for the window. */
const body = () => ({
	message_id: `0b6f3c62-6a43-4c39-9d3a-${String(++messageNumber).padStart(12, '0')}`,
	text: WORDS
})

let reply: { intent: string; species: string; preset: string } | null
let intro: { species: string; preset: string } | null
let plus: boolean
let counts: { mine: number; everyone: number }

beforeEach(() => {
	reset()
	process.env.FAL_KEY = 'fal-test-key'
	delete process.env.VOICE_PROVIDER
	reply = { intent: 'affectionate', species: 'dog', preset: 'curious' }
	intro = null
	counts = { mine: 0, everyone: 0 }
	fake.fal = () => Response.json({ audio: { url: AUDIO }, duration_ms: 2400 })
	fakeStore(talkStore, 'countedReply', () => reply)
	fakeStore(introStore, 'answeredAttempt', () => intro)
	fakeStore(aiUsageStore, 'countSince', (_purpose: string, _since: Date, userId?: string) =>
		userId ? counts.mine : counts.everyone
	)
	fakeStore(aiUsageStore, 'record', () => undefined)
	fakeStore(profileStore, 'regionOf', () => null)
	plus = false
	fakeStore(profileStore, 'isPremium', () => plus)
	fakeStore(analyticsStore, 'hasDuplicate', () => false)
	fakeStore(analyticsStore, 'insertEvent', () => undefined)
})

const calls = (method: string) => fake.storeCalls.filter((call) => call.method === method)
const falCalls = () => fake.fetchCalls.filter((call) => call.url.host === 'fal.run')
const events = () =>
	calls('insertEvent').map((call) => call.args[0] as { name: string; metadata: unknown })
const post = (sent: unknown, token?: null) =>
	send(route.POST, '/api/app/v1/pet/voice', {
		method: 'POST',
		body: sent,
		...(token === null && { token })
	})

test("spoken (Inworld, unset): the pet's voice played faster, the event and usage without the words", async () => {
	const res = await post(body())
	assert.equal(res.status, 200)
	assert.ok(voiceResponse.safeParse(res.body).success)
	assert.deepEqual(res.body, {
		outcome: 'spoken',
		audio_url: AUDIO,
		duration_ms: 0,
		playback_rate: 1.15
	})

	assert.equal(falCalls()[0]?.url.pathname, '/fal-ai/inworld-tts')
	assert.equal(falCalls()[0]?.headers.get('authorization'), 'Key fal-test-key')
	assert.deepEqual(falCalls()[0]?.body, {
		text: WORDS,
		voice: 'Snik (en)',
		sample_rate_hertz: 24_000
	})

	assert.deepEqual(
		events().map(({ name, metadata }) => [name, metadata]),
		[['talk_reply_voiced', { voice: 'curious', from: 'talk' }]]
	)
	const usage = calls('record')[0]?.args[0] as Record<string, unknown>
	assert.deepEqual(
		{ ...usage, latencyMs: 0 },
		{
			userId: USER,
			provider: 'fal',
			model: 'inworld-tts',
			inputTokens: WORDS.length,
			outputTokens: null,
			latencyMs: 0,
			outcome: 'replied',
			intent: 'affectionate',
			purpose: 'voice'
		}
	)
	const leaked = JSON.stringify([events(), calls('record'), res.lines])
	assert.ok(!leaked.includes('snacks'), 'the words reach fal only')
})

test('VOICE_PROVIDER=minimax: its voice per pet, the emotion from the intent, at normal speed', async () => {
	process.env.VOICE_PROVIDER = 'minimax'
	const res = await post(body())
	assert.deepEqual(res.body, {
		outcome: 'spoken',
		audio_url: AUDIO,
		duration_ms: 2400,
		playback_rate: 1
	})
	assert.equal(falCalls()[0]?.url.pathname, '/fal-ai/minimax/speech-2.8-turbo')
	const sent = falCalls()[0]?.body as { prompt: string; voice_setting: Record<string, unknown> }
	assert.equal(sent.prompt, WORDS)
	assert.deepEqual(sent.voice_setting, {
		voice_id: 'Decent_Boy',
		pitch: 2,
		speed: 1.15,
		emotion: 'happy'
	})

	// A cat spoken to harshly answers sadly, in its own voice.
	reply = { intent: 'harsh', species: 'cat', preset: 'cool' }
	await post(body())
	assert.deepEqual((falCalls()[1]?.body as { voice_setting: unknown }).voice_setting, {
		voice_id: 'Calm_Woman',
		pitch: 1,
		speed: 0.95,
		emotion: 'sad'
	})
})

test("from: 'intro': only an intro answer just recorded, warm, in the pet's voice", async () => {
	const said = { ...body(), from: 'intro' }
	assert.equal((await post(said)).status, 404, 'no answered intro under this id')
	assert.equal(calls('countedReply').length, 0, 'never read as a talk reply')

	intro = { species: 'cat', preset: 'cool' }
	process.env.VOICE_PROVIDER = 'minimax'
	const res = await post({ ...body(), from: 'intro' })
	assert.equal(res.body.outcome, 'spoken')
	const [userId] = calls('answeredAttempt')[1]!.args as [string]
	assert.equal(userId, USER)
	assert.deepEqual((falCalls()[0]?.body as { voice_setting: unknown }).voice_setting, {
		voice_id: 'Calm_Woman',
		pitch: 1,
		speed: 0.95,
		emotion: 'happy'
	})
	assert.deepEqual(
		events().map(({ name, metadata }) => [name, metadata]),
		[['talk_reply_voiced', { voice: 'cool', from: 'intro' }]]
	)
	assert.equal((calls('record')[0]?.args[0] as { intent: unknown }).intent, null)
})

test('only a counted reply in the window, and each one once', async () => {
	reply = null
	assert.equal((await post(body())).status, 404)
	assert.equal(falCalls().length, 0)

	reply = { intent: 'kind', species: 'cat', preset: 'cuddly' }
	const once = body()
	assert.equal((await post(once)).status, 200)
	assert.equal((await post(once)).status, 404, 'already spoken')
	assert.equal(falCalls().length, 1)
	// Asked for this person's reply only, counted within the last 10 minutes.
	const [userId, , since] = calls('countedReply')[0]!.args as [string, string, Date]
	assert.equal(userId, USER)
	assert.ok(Math.abs(Date.now() - since.getTime() - 10 * 60_000) < 5_000)
})

test('the limits: 5 a day free, 20 with Plus (the server decides), then the whole app', async () => {
	counts.mine = VOICE_DAILY_FREE - 1
	assert.equal((await post(body())).body.outcome, 'spoken', 'the 5th of the day')
	counts.mine = VOICE_DAILY_FREE
	assert.deepEqual((await post(body())).body, { outcome: 'limited' }, 'free: the 6th is text')

	plus = true
	assert.equal((await post(body())).body.outcome, 'spoken', 'Plus: the 6th is spoken')
	counts.mine = VOICE_DAILY_PLUS
	assert.deepEqual((await post(body())).body, { outcome: 'limited' }, 'Plus: the 21st is text')
	assert.equal(falCalls().length, 2)
	fake.fetchCalls = []
	fake.storeCalls = []
	counts = { mine: 0, everyone: VOICE_DAILY_ALL }
	assert.deepEqual((await post(body())).body, { outcome: 'limited' })
	assert.equal(falCalls().length, 0)
	assert.equal(events().length, 0)
})

test('fal fails: a 503, usage recorded as failed, no event, and the message may be tried again', async () => {
	fake.fal = () => new Response('busy', { status: 500 })
	const once = body()
	const res = await post(once)
	assert.equal(res.status, 503)
	assert.equal(res.body.error.code, 'voice_unavailable')
	assert.equal((calls('record')[0]?.args[0] as { outcome: string }).outcome, 'unavailable')
	assert.equal(events().length, 0)

	fake.fal = () => Response.json({ audio: { url: AUDIO } })
	assert.equal((await post(once)).status, 200)
})

test('an answer in a shape we cannot use is a failure, not a broken URL', async () => {
	fake.fal = () => Response.json({ audio: { url: 'not a url' } })
	assert.equal((await post(body())).status, 503)
})

test('no FAL_KEY: not configured, and nothing is asked', async () => {
	delete process.env.FAL_KEY
	const res = await post(body())
	assert.equal(res.status, 503)
	assert.equal(res.body.error.code, 'not_configured')
	assert.equal(calls('countedReply').length, 0)
})

test('a bad body or no sign-in is refused before anything is read', async () => {
	assert.equal((await post({ message_id: 'nope', text: WORDS })).status, 400)
	assert.equal((await post({ ...body(), text: '   ' })).status, 400)
	assert.equal((await post({ ...body(), text: 'a'.repeat(201) })).status, 400)
	assert.equal((await post({ ...body(), voice: 'Wise_Woman' })).status, 400)
	assert.equal((await post(body(), null)).status, 401)
	assert.equal(calls('countedReply').length, 0)
	assert.equal(falCalls().length, 0)
})
