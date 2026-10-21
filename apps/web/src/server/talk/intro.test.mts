// "Tell me about you" with a fake model and fake stores (v2-memory-requirements.md, R18–R24): a
// closed step or a retried message never calls the model, someone under 13 is never sent to it,
// a failed call uses no attempt, and every call leaves one usage row marked "intro".
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import {
	lookById,
	MEMORY_CAP_FREE,
	MEMORY_CAP_PLUS,
	presetTraits,
	type IntroSendBody,
	type NewMemory
} from '@app/contract'
import { fake, fakeStore, reset, USER } from '@/server/api/app-test-kit.mts'
import type { IntroResult, ReplyProvider } from './reply-provider'

const { introduce, INTRO_EMPTY_LINE, INTRO_RETRIED_LINE, INTRO_YOUNG_LINE } =
	await import('./intro')
const { introStore } = await import('@/server/db/intro')
const { petStore } = await import('@/server/db/pets')
const { profileStore } = await import('@/server/db/profiles')
const { aiUsageStore } = await import('@/server/db/ai-usage')

const NOW = new Date('2026-10-04T12:00:00.000Z')
const row = {
	id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
	...lookById('ginger').appearance,
	look: 'ginger',
	name: 'Mochi',
	preset: 'cuddly',
	...presetTraits('cuddly'),
	needs: { hunger: 60, happiness: 80, energy: 80, affection: 70, updatedAt: NOW },
	createdAt: NOW,
	updatedAt: NOW
}
const body: IntroSendBody = {
	message_id: '0b6f3c62-6a43-4c39-9d3a-3c8f1a2b9e11',
	text: 'I study medicine and I have a dog called Kara',
	input: 'voice',
	time_zone: 'Europe/Istanbul'
}
const DOG: NewMemory = {
	text: 'Has a dog called Kara',
	followUp: null,
	category: 'pets',
	kind: 'lasting',
	importance: 2,
	tags: ['dog', 'kara'],
	followUpOn: null
}
const kept = (fact: NewMemory) => ({
	...fact,
	id: '63e25c0e-b8ad-4fab-b2d0-b2a66c7b63fb',
	followedUpAt: null,
	source: 'intro',
	lastUsedAt: null,
	createdAt: NOW
})
const ANSWERED: IntroResult = {
	ok: true,
	answer: { line: 'A dog called Kara? I like you already.', facts: [DOG] },
	usage: { inputTokens: 1200, outputTokens: 300 },
	latencyMs: 700
}

let asked: unknown[] = []
const providerAnswering = (result: IntroResult): ReplyProvider => ({
	name: 'groq',
	model: 'openai/gpt-oss-120b',
	reply: async () => {
		throw new Error('the intro never asks for a reply')
	},
	intro: async (request) => {
		asked.push(request)
		return result
	}
})

beforeEach(() => {
	reset()
	asked = []
	fakeStore(introStore, 'status', () => ({ kind: 'open', attemptsLeft: 2 }))
	fakeStore(introStore, 'record', (_userId: string, attempt: { facts: NewMemory[] }) => ({
		kind: 'saved',
		facts: attempt.facts.map(kept),
		attemptsLeft: 0,
		due: false
	}))
	fakeStore(petStore, 'get', () => row)
	fakeStore(profileStore, 'isPremium', () => false)
	fakeStore(profileStore, 'personName', () => 'Ece')
	fakeStore(aiUsageStore, 'record', () => undefined)
})

const calls = (method: string) => fake.storeCalls.filter((call) => call.method === method)
// Both stores have a `record`: the intro's takes the user id first, ai_usage's one entry.
const attempts = () => calls('record').filter((call) => typeof call.args[0] === 'string')
const usageRows = () => calls('record').filter((call) => typeof call.args[0] === 'object')
const run = (provider = providerAnswering(ANSWERED), over: Partial<IntroSendBody> = {}) =>
	introduce({ userId: USER, body: { ...body, ...over }, provider, now: NOW })

test("an answer: the pet and the person's day go to the model, the facts are kept", async () => {
	const result = await run()
	assert.equal(result.kind, 'answered')
	assert.ok(result.kind === 'answered')
	assert.equal(result.outcome, 'saved')
	assert.equal(result.line, 'A dog called Kara? I like you already.')
	assert.deepEqual(
		result.facts.map((fact) => fact.text),
		['Has a dog called Kara']
	)

	const request = asked[0] as { said: string; today: string; personName: string }
	assert.equal(request.said, body.text)
	assert.equal(request.today, '2026-10-04')
	assert.equal(request.personName, 'Ece')

	const [userId, attempt] = attempts()[0]!.args as [string, Record<string, unknown>]
	assert.equal(userId, USER)
	assert.equal(attempt.messageId, body.message_id)
	assert.equal(attempt.cap, MEMORY_CAP_FREE)
	assert.equal(attempt.today, '2026-10-04')
})

test('Plus keeps up to its own cap, from the server', async () => {
	fakeStore(profileStore, 'isPremium', () => true)
	await run()
	const [, attempt] = attempts()[0]!.args as [string, Record<string, unknown>]
	assert.equal(attempt.cap, MEMORY_CAP_PLUS)
})

test('every call leaves one usage row, marked intro, never the words', async () => {
	await run()
	const [entry] = usageRows()[0]!.args as [Record<string, unknown>]
	assert.deepEqual(entry, {
		userId: USER,
		provider: 'groq',
		model: 'openai/gpt-oss-120b',
		inputTokens: 1200,
		outputTokens: 300,
		latencyMs: 700,
		outcome: 'replied',
		intent: null,
		purpose: 'intro'
	})
})

test('a closed step never calls the model', async () => {
	fakeStore(introStore, 'status', () => ({ kind: 'closed' }))
	assert.deepEqual(await run(), { kind: 'closed' })
	assert.equal(asked.length, 0)
	assert.equal(attempts().length, 0)
})

test('a retried message gets its kept facts back, without a new call', async () => {
	fakeStore(introStore, 'status', () => ({
		kind: 'retried',
		facts: [kept(DOG)],
		attemptsLeft: 0,
		due: false
	}))
	const result = await run()
	assert.ok(result.kind === 'answered')
	assert.equal(result.outcome, 'retried')
	assert.equal(result.line, INTRO_RETRIED_LINE)
	assert.equal(result.facts.length, 1)
	assert.equal(asked.length, 0)
})

test('someone under 13: nothing goes to the model, nothing is kept, the step ends', async () => {
	const result = await run(undefined, { text: "I'm 9 years old and I love dogs" })
	assert.equal(asked.length, 0)
	const [, attempt] = attempts()[0]!.args as [string, Record<string, unknown>]
	assert.deepEqual(attempt.facts, [])
	assert.equal(attempt.end, true)
	assert.ok(result.kind === 'answered')
	assert.equal(result.line, INTRO_YOUNG_LINE)
	assert.equal(usageRows().length, 0)
})

test('a failed call uses no attempt: nothing is recorded but the usage row', async () => {
	for (const failure of ['unavailable', 'invalid'] as const) {
		reset()
		fakeStore(aiUsageStore, 'record', () => undefined)
		const result = await run(
			providerAnswering({
				ok: false,
				failure,
				detail: 'http_429',
				usage: { inputTokens: null, outputTokens: null },
				latencyMs: 30
			})
		)
		assert.deepEqual(result, { kind: 'failed', failure })
		assert.equal(attempts().length, 0)
		const [entry] = usageRows()[0]!.args as [Record<string, unknown>]
		assert.equal(entry.outcome, failure)
	}
})

test("nothing kept: the pet's line about it is replaced by the empty line", async () => {
	fakeStore(introStore, 'record', () => ({ kind: 'saved', facts: [], attemptsLeft: 1, due: true }))
	const result = await run()
	assert.ok(result.kind === 'answered')
	assert.equal(result.line, INTRO_EMPTY_LINE)
	assert.equal(result.attemptsLeft, 1)
	assert.equal(result.due, true)
})

test('a call that lost the race to another keeps nothing and says the step is closed', async () => {
	fakeStore(introStore, 'record', () => ({ kind: 'closed' }))
	assert.deepEqual(await run(), { kind: 'closed' })
})

test('a usage row that cannot be written never fails the intro', async () => {
	fakeStore(aiUsageStore, 'record', () => {
		throw new Error('db down')
	})
	assert.equal((await run()).kind, 'answered')
})
