// The fal reader (v2-pet-from-photo-requirements.md, R6, R9, R17): the photo goes inline (never
// uploaded), the key as fal's `Key` header, a usable answer comes back as a pet, an unusable one
// is tried once more when there is time, and every failure is a result, never a throw.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFalReader } from './fal'

const PHOTO = { base64: 'AAAA', mime: 'image/jpeg' as const }
const ANSWER = {
	verdict: 'ok',
	seen: 'A ginger tabby cat.',
	species: 'cat',
	fur: 'ginger',
	pattern: 'tabby',
	accent: 'auto',
	white: 'none',
	trim: 'white',
	eyes: 'amber',
	ears: 'pointy',
	body: 'round',
	tail: 'fluffy'
}
const ok = (output: string) =>
	Response.json({ output, usage: { prompt_tokens: 1300, completion_tokens: 60 } })

function reader(responses: (() => Response | Promise<Response>)[]) {
	const calls: { url: string; init: RequestInit }[] = []
	const fetchImpl = (async (url: string, init: RequestInit) => {
		calls.push({ url, init })
		const next = responses.shift()
		if (!next) throw new Error('no more responses')
		return next()
	}) as unknown as typeof fetch
	return { calls, read: createFalReader({ apiKey: 'fal-test-key', fetchImpl }) }
}

test('the photo is sent inline with the key, and a usable answer is a pet', async () => {
	const { calls, read } = reader([() => ok('```json\n' + JSON.stringify(ANSWER) + '\n```')])
	const result = await read.read(PHOTO)
	assert.equal(result.ok, true)
	if (!result.ok) return
	assert.equal(result.answer.verdict, 'ok')
	assert.deepEqual(result.usage, { inputTokens: 1300, outputTokens: 60 })

	assert.equal(calls.length, 1)
	assert.equal(calls[0]!.url, 'https://fal.run/openrouter/router/vision')
	const headers = calls[0]!.init.headers as Record<string, string>
	assert.equal(headers.Authorization, 'Key fal-test-key')
	const body = JSON.parse(calls[0]!.init.body as string)
	assert.deepEqual(body.image_urls, ['data:image/jpeg;base64,AAAA'])
	assert.equal(body.model, 'google/gemini-2.5-flash')
	assert.equal(body.temperature, 0)
	assert.match(body.system_prompt, /tortie/)
})

test('an unusable answer is tried once more, and the second is used', async () => {
	const { calls, read } = reader([
		() => ok('I think it is a cat.'),
		() => ok(JSON.stringify(ANSWER))
	])
	const result = await read.read(PHOTO)
	assert.equal(result.ok, true)
	assert.equal(calls.length, 2)
})

test('two unusable answers are `invalid`, after exactly two calls', async () => {
	const { calls, read } = reader([
		() => ok(JSON.stringify({ ...ANSWER, fur: 'purple' })),
		() => ok(JSON.stringify({ ...ANSWER, fur: 'purple' }))
	])
	const result = await read.read(PHOTO)
	assert.equal(result.ok, false)
	assert.equal(!result.ok && result.failure, 'invalid')
	assert.equal(calls.length, 2)
})

test('unreachable, rate-limited or refused is `unavailable`, with no second call', async () => {
	for (const response of [
		() => new Response('busy', { status: 429 }),
		() => new Response('down', { status: 503 }),
		() => new Response('no', { status: 401 }),
		() => Promise.reject(new TypeError('fetch failed'))
	]) {
		const { calls, read } = reader([response])
		const result = await read.read(PHOTO)
		assert.equal(!result.ok && result.failure, 'unavailable')
		assert.equal(calls.length, 1)
	}
})

test('a timeout is `unavailable`', async () => {
	const fetchImpl = (async () => {
		throw new DOMException('timed out', 'TimeoutError')
	}) as unknown as typeof fetch
	const result = await createFalReader({ apiKey: 'k', fetchImpl }).read(PHOTO)
	assert.equal(!result.ok && result.failure, 'unavailable')
	assert.equal(!result.ok && result.detail, 'timeout')
})
