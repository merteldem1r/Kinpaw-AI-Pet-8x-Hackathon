// The Groq provider with a fake fetch (m6-talk-requirements.md, R1, R5, R14): what it sends, and
// every way an answer can fail. It never throws, and a failure is never a guessed reply.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGroqProvider, DEFAULT_GROQ_MODEL } from './groq'
import { CHECK_PETS } from './talk-check.fixtures'

const request = { pet: CHECK_PETS[0]!, said: 'I had a really nice day today!', recent: [] }

function answering(content: unknown, init: { status?: number; usage?: object } = {}) {
	const calls: { url: string; body: Record<string, unknown> }[] = []
	const fetchImpl = (async (url: string, options: RequestInit) => {
		calls.push({ url, body: JSON.parse(String(options.body)) })
		const body = {
			choices: [
				{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }
			],
			usage: init.usage ?? { prompt_tokens: 900, completion_tokens: 80 }
		}
		return new Response(JSON.stringify(body), { status: init.status ?? 200 })
	}) as unknown as typeof fetch
	return { calls, fetchImpl }
}

test('a good answer: strict schema asked for, reply and usage returned', async () => {
	const { calls, fetchImpl } = answering({
		reply: 'Purr!',
		intent: 'kind',
		suggested_action: 'none'
	})
	const result = await createGroqProvider({ apiKey: 'k', fetchImpl }).reply(request)
	assert.ok(result.ok)
	assert.deepEqual(result.reply, {
		reply: 'Purr!',
		intent: 'kind',
		suggestedAction: null,
		memory: null,
		recalled: null
	})
	assert.deepEqual(result.usage, { inputTokens: 900, outputTokens: 80 })

	const { body } = calls[0]!
	assert.equal(body.model, DEFAULT_GROQ_MODEL)
	assert.equal(body.reasoning_effort, 'low')
	const format = body.response_format as { type: string; json_schema: { strict: boolean } }
	assert.equal(format.type, 'json_schema')
	assert.equal(format.json_schema.strict, true)
})

test('the model name is configuration', async () => {
	const { calls, fetchImpl } = answering({ reply: 'Hi', intent: 'kind', suggested_action: 'none' })
	await createGroqProvider({ apiKey: 'k', model: 'qwen/qwen3.8-27b', fetchImpl }).reply(request)
	assert.equal(calls[0]!.body.model, 'qwen/qwen3.8-27b')
})

test('rate-limited or down: unavailable, with the status as the detail', async () => {
	for (const status of [429, 500, 503, 401]) {
		const { fetchImpl } = answering({}, { status })
		const result = await createGroqProvider({ apiKey: 'k', fetchImpl }).reply(request)
		assert.ok(!result.ok)
		assert.equal(result.failure, 'unavailable')
		assert.equal(result.detail, `http_${status}`)
	}
})

test('a 400 (the request or the schema check failed) is invalid, not "not connected"', async () => {
	const { fetchImpl } = answering({}, { status: 400 })
	const result = await createGroqProvider({ apiKey: 'k', fetchImpl }).reply(request)
	assert.ok(!result.ok)
	assert.equal(result.failure, 'invalid')
})

test("Groq's schema check refusing the answer is tried once more, and the second answer used", async () => {
	let calls = 0
	const fetchImpl = (async () => {
		calls++
		if (calls === 1) {
			return new Response(
				JSON.stringify({
					error: {
						code: 'json_validate_failed',
						message: 'Failed to validate JSON. failed_generation: I had a really nice day'
					}
				}),
				{ status: 400 }
			)
		}
		const content = JSON.stringify({ reply: 'Purr!', intent: 'kind', suggested_action: 'none' })
		return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
	}) as unknown as typeof fetch
	const result = await createGroqProvider({ apiKey: 'k', fetchImpl }).reply(request)
	assert.equal(calls, 2)
	assert.ok(result.ok)
	assert.equal(result.reply.reply, 'Purr!')
})

test('refused twice: invalid, with the code as the detail; any other 400 is not tried again', async () => {
	let calls = 0
	const refusing = (code: string) =>
		(async () => {
			calls++
			return new Response(JSON.stringify({ error: { code, message: 'what was said' } }), {
				status: 400
			})
		}) as unknown as typeof fetch

	const twice = await createGroqProvider({
		apiKey: 'k',
		fetchImpl: refusing('json_validate_failed')
	}).reply(request)
	assert.equal(calls, 2)
	assert.ok(!twice.ok)
	assert.equal(twice.detail, 'http_400:json_validate_failed')

	calls = 0
	const other = await createGroqProvider({
		apiKey: 'k',
		fetchImpl: refusing('invalid_request_error')
	}).reply(request)
	assert.equal(calls, 1)
	assert.ok(!other.ok)
	assert.equal(other.detail, 'http_400:invalid_request_error')
})

test('a network error and a timeout are unavailable', async () => {
	const broken = (async () => {
		throw new TypeError('fetch failed')
	}) as unknown as typeof fetch
	const down = await createGroqProvider({ apiKey: 'k', fetchImpl: broken }).reply(request)
	assert.ok(!down.ok)
	assert.deepEqual([down.failure, down.detail], ['unavailable', 'network'])

	// AbortSignal.timeout's timer doesn't keep the process alive; this one does, until the abort.
	const keepAlive = setTimeout(() => {}, 1000)
	const hanging = ((_url: string, options: RequestInit) =>
		new Promise((_resolve, reject) => {
			options.signal?.addEventListener('abort', () => reject(options.signal?.reason))
		})) as unknown as typeof fetch
	const slow = await createGroqProvider({ apiKey: 'k', fetchImpl: hanging, timeoutMs: 20 }).reply(
		request
	)
	assert.ok(!slow.ok)
	clearTimeout(keepAlive)
	assert.deepEqual([slow.failure, slow.detail], ['unavailable', 'timeout'])
})

test('an answer that is not JSON, or not our shape, is invalid', async () => {
	const notJson = answering('Purr! I love that.')
	const a = await createGroqProvider({ apiKey: 'k', fetchImpl: notJson.fetchImpl }).reply(request)
	assert.ok(!a.ok)
	assert.deepEqual([a.failure, a.detail], ['invalid', 'not_json'])

	const wrongShape = answering({ reply: 'Hi', intent: 'grumpy', suggested_action: 'none' })
	const b = await createGroqProvider({ apiKey: 'k', fetchImpl: wrongShape.fetchImpl }).reply(
		request
	)
	assert.ok(!b.ok)
	assert.deepEqual([b.failure, b.detail], ['invalid', 'schema'])
	assert.deepEqual(b.usage, { inputTokens: 900, outputTokens: 80 })
})
