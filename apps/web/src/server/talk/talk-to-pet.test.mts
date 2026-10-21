// The talk flow with a fake model and fake stores (m6-talk-requirements.md, R10–R16): a full day
// never calls the model, a retry still gets its answer, a failure counts nothing, and every model
// call leaves one usage row, which can never fail the reply.
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { FREE_TALKS_PER_DAY, lookById, presetTraits, type TalkBody } from '@app/contract'
import { fake, fakeStore, reset, USER } from '@/server/api/app-test-kit.mts'
import type { ReplyProvider, ReplyResult } from './reply-provider'

const { talkToPet } = await import('./talk-to-pet')
const { petStore } = await import('@/server/db/pets')
const { profileStore } = await import('@/server/db/profiles')
const { talkStore } = await import('@/server/db/talk')
const { aiUsageStore } = await import('@/server/db/ai-usage')
const { memoryStore } = await import('@/server/db/memory')

const NOW = new Date('2026-10-01T12:00:00.000Z')
const row = {
	id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
	...lookById('ginger').appearance,
	look: 'ginger',
	name: 'Mochi',
	preset: 'cuddly',
	...presetTraits('cuddly'),
	needs: { hunger: 25, happiness: 50, energy: 80, affection: 50, updatedAt: NOW },
	createdAt: NOW,
	updatedAt: NOW
}
const body: TalkBody = {
	message_id: '0b6f3c62-6a43-4c39-9d3a-3c8f1a2b9e11',
	text: 'I had a really nice day',
	input: 'voice',
	time_zone: 'Europe/Istanbul',
	recent: []
}
const KIND: ReplyResult = {
	ok: true,
	reply: {
		reply: 'Purr! Tell me everything.',
		intent: 'kind',
		suggestedAction: null,
		memory: null
	},
	usage: { inputTokens: 900, outputTokens: 80 },
	latencyMs: 420
}

let asked: unknown[] = []
const providerAnswering = (result: ReplyResult): ReplyProvider => ({
	name: 'groq',
	model: 'openai/gpt-oss-20b',
	reply: async (request) => {
		asked.push(request)
		return result
	}
})

const applied = (overrides: object = {}) => ({
	row,
	outcome: 'replied',
	added: { happiness: 2, affection: 4 },
	countedToday: 3,
	first: false,
	...overrides
})

beforeEach(() => {
	reset()
	asked = []
	fakeStore(petStore, 'get', () => row)
	fakeStore(memoryStore, 'pick', () => [])
	fakeStore(memoryStore, 'save', () => ({ kind: 'duplicate' }))
	fakeStore(profileStore, 'isPremium', () => false)
	fakeStore(profileStore, 'personName', () => null)
	fakeStore(talkStore, 'status', () => ({
		counted: 2,
		gained: { happiness: 0, affection: 0 },
		alreadyCounted: false
	}))
	fakeStore(talkStore, 'apply', () => applied())
	fakeStore(aiUsageStore, 'record', () => undefined)
})

const calls = (method: string) => fake.storeCalls.filter((call) => call.method === method)
const talk = (provider = providerAnswering(KIND)) =>
	talkToPet({ userId: USER, body, provider, now: NOW })

test('a reply: the pet as it is now goes to the model, and the intent is applied', async () => {
	const result = await talk()
	assert.equal(result.kind, 'answered')
	if (result.kind !== 'answered') return
	assert.equal(result.outcome, 'replied')
	assert.equal(result.reply.reply, 'Purr! Tell me everything.')
	assert.equal(result.needChanged, true)
	assert.equal(result.messagesLeft, FREE_TALKS_PER_DAY - 3)

	const request = asked[0] as { pet: { name: string; needs: { hunger: number } }; said: string }
	assert.equal(request.pet.name, 'Mochi')
	assert.equal(request.pet.needs.hunger, 25)
	assert.equal(request.said, body.text)

	const [userId, newTalk] = calls('apply')[0]!.args as [string, Record<string, unknown>]
	assert.equal(userId, USER)
	assert.deepEqual(
		{ intent: newTalk.intent, day: newTalk.day, dailyLimit: newTalk.dailyLimit },
		{ intent: 'kind', day: '2026-10-01', dailyLimit: FREE_TALKS_PER_DAY }
	)
})

test('the name the person set goes to the model with the pet; none, nothing (profile-edit R16)', async () => {
	fakeStore(profileStore, 'personName', () => 'Mert')
	await talk()
	assert.equal((asked[0] as { personName: string | null }).personName, 'Mert')

	asked = []
	fakeStore(profileStore, 'personName', () => null)
	await talk()
	assert.equal((asked[0] as { personName: string | null }).personName, null)
})

test('a full day answers the limit and never calls the model', async () => {
	fakeStore(talkStore, 'status', () => ({
		counted: FREE_TALKS_PER_DAY,
		gained: { happiness: 0, affection: 0 },
		alreadyCounted: false
	}))
	const result = await talk()
	assert.equal(result.kind, 'limit_reached')
	assert.equal(asked.length, 0)
	assert.equal(calls('apply').length, 0)
	assert.equal(calls('record').length, 0)
})

test('a retry of a counted message still gets its answer on a full day', async () => {
	fakeStore(talkStore, 'status', () => ({
		counted: FREE_TALKS_PER_DAY,
		gained: { happiness: 0, affection: 0 },
		alreadyCounted: true
	}))
	fakeStore(talkStore, 'apply', () =>
		applied({ outcome: 'retried', added: { happiness: 0, affection: 0 }, countedToday: 10 })
	)
	const result = await talk()
	assert.equal(result.kind, 'answered')
	if (result.kind !== 'answered') return
	assert.equal(result.outcome, 'retried')
	assert.equal(result.needChanged, false)
	assert.equal(result.messagesLeft, 0)
})

test('Plus: no limit, and no count', async () => {
	fakeStore(profileStore, 'isPremium', () => true)
	fakeStore(talkStore, 'status', () => ({
		counted: 40,
		gained: { happiness: 0, affection: 0 },
		alreadyCounted: false
	}))
	const result = await talk()
	assert.equal(result.kind, 'answered')
	if (result.kind === 'answered') assert.equal(result.messagesLeft, null)
	const newTalk = calls('apply')[0]!.args[1] as { dailyLimit: number | null }
	assert.equal(newTalk.dailyLimit, null)
})

test('a failed reply counts nothing, and its call is logged as usage', async () => {
	const result = await talk(
		providerAnswering({
			ok: false,
			failure: 'unavailable',
			detail: 'http_429',
			usage: { inputTokens: null, outputTokens: null },
			latencyMs: 31
		})
	)
	assert.deepEqual(result, { kind: 'failed', failure: 'unavailable' })
	assert.equal(calls('apply').length, 0)
	const entry = calls('record')[0]!.args[0] as Record<string, unknown>
	assert.equal(entry.outcome, 'unavailable')
	assert.equal(entry.intent, null)
})

test('every model call leaves one usage row with its outcome, and never the words', async () => {
	await talk()
	const entry = calls('record')[0]!.args[0] as Record<string, unknown>
	assert.deepEqual(entry, {
		userId: USER,
		provider: 'groq',
		model: 'openai/gpt-oss-20b',
		inputTokens: 900,
		outputTokens: 80,
		latencyMs: 420,
		outcome: 'replied',
		intent: 'kind'
	})
})

test('a usage row that cannot be written never fails the reply', async () => {
	fakeStore(aiUsageStore, 'record', () => {
		throw new Error('database down')
	})
	const result = await talk()
	assert.equal(result.kind, 'answered')
})

test('the day filling up while the model answered is the limit, not a reply', async () => {
	fakeStore(talkStore, 'apply', () => applied({ outcome: 'limit_reached', countedToday: 10 }))
	const result = await talk()
	assert.equal(result.kind, 'limit_reached')
	assert.equal((calls('record')[0]!.args[0] as { outcome: string }).outcome, 'limit_reached')
})

test('no pet: nothing is asked', async () => {
	fakeStore(petStore, 'get', () => null)
	assert.deepEqual(await talk(), { kind: 'no_pet' })
	assert.equal(asked.length, 0)
})

// ── Long-term memory (v2-memory-requirements.md, R9–R14) ──────────────────────────────────────

const memoryRecord = (id: string, text: string, over: object = {}) => ({
	id,
	text,
	followUp: null,
	category: 'family',
	kind: 'lasting',
	importance: 2,
	tags: ['sister'],
	followUpOn: null,
	followedUpAt: null,
	source: 'talk',
	lastUsedAt: null,
	createdAt: NOW,
	...over
})
const SISTER = memoryRecord('a1111111-1111-4111-8111-111111111111', 'Sister called Ece')
const EXAM = memoryRecord('b2222222-2222-4222-8222-222222222222', 'Has an exam on Friday', {
	category: 'study',
	kind: 'event',
	followUp: 'How did the exam go?',
	followUpOn: '2026-09-30'
})
const FACT = {
	text: 'Works at a bakery',
	followUp: null,
	category: 'work' as const,
	kind: 'lasting' as const,
	importance: 1 as const,
	tags: ['bakery'],
	followUpOn: null
}
const keeping = (memory: object): ReplyResult =>
	({ ...KIND, reply: { ...KIND.reply, memory } }) as ReplyResult

test('the picked facts reach the model as m1, m2…, with today, the weekday and a due event', async () => {
	fakeStore(memoryStore, 'pick', () => [SISTER, EXAM])
	await talk()
	const [userId, said, day] = calls('pick')[0]!.args as [string, string, string]
	assert.deepEqual([userId, said, day], [USER, body.text, '2026-10-01'])
	const { memory } = asked[0] as { memory: { today: string; weekday: string; facts: object[] } }
	assert.equal(memory.today, '2026-10-01')
	assert.equal(memory.weekday, 'Thursday')
	assert.deepEqual(memory.facts, [
		{
			ref: 'm1',
			text: 'Sister called Ece',
			kind: 'lasting',
			followUp: null,
			followUpOn: null,
			due: false,
			worry: false
		},
		{
			ref: 'm2',
			text: 'Has an exam on Friday',
			kind: 'event',
			followUp: 'How did the exam go?',
			followUpOn: '2026-09-30',
			due: true,
			worry: false
		}
	])
})

test('a fact the reply keeps is saved after it counted, with the free cap, and comes back', async () => {
	const kept = memoryRecord('c3333333-3333-4333-8333-333333333333', 'Works at a bakery', {
		category: 'work'
	})
	fakeStore(memoryStore, 'save', () => ({ kind: 'saved', memory: kept, replaced: false }))
	const result = await talk(providerAnswering(keeping({ action: 'add', fact: FACT })))
	assert.ok(result.kind === 'answered')
	assert.deepEqual(result.remembered, {
		id: kept.id,
		text: 'Works at a bakery',
		category: 'work',
		kind: 'lasting',
		replaced: false
	})
	const [userId, change, options] = calls('save')[0]!.args as [
		string,
		object,
		Record<string, unknown>
	]
	assert.equal(userId, USER)
	assert.deepEqual(change, { action: 'add', fact: FACT })
	assert.deepEqual(options, { cap: 30, source: 'talk', today: '2026-10-01', now: NOW })
	const order = fake.storeCalls.map((call) => call.method)
	assert.ok(order.indexOf('apply') < order.indexOf('save'), 'saved only after the reply counted')
})

test('a replace names the fact by its ref; the store gets its row id', async () => {
	fakeStore(memoryStore, 'pick', () => [SISTER, EXAM])
	await talk(providerAnswering(keeping({ action: 'replace', ref: 'm2', fact: FACT })))
	const [, change] = calls('save')[0]!.args as [string, object]
	assert.deepEqual(change, { action: 'replace', id: EXAM.id, fact: FACT })
})

test('Plus keeps up to 100', async () => {
	fakeStore(profileStore, 'isPremium', () => true)
	await talk(providerAnswering(keeping({ action: 'add', fact: FACT })))
	assert.equal((calls('save')[0]!.args[2] as { cap: number }).cap, 100)
})

test('a retry keeps nothing (R14)', async () => {
	fakeStore(talkStore, 'apply', () => applied({ outcome: 'retried' }))
	const result = await talk(providerAnswering(keeping({ action: 'add', fact: FACT })))
	assert.equal(calls('save').length, 0)
	assert.ok(result.kind === 'answered' && result.remembered === null)
})

test('memory never decides a reply: a failed pick or save still answers (R13)', async () => {
	fakeStore(memoryStore, 'pick', () => {
		throw new Error('database down')
	})
	fakeStore(memoryStore, 'save', () => {
		throw new Error('database down')
	})
	const result = await talk(providerAnswering(keeping({ action: 'add', fact: FACT })))
	assert.ok(result.kind === 'answered')
	assert.equal(result.reply.reply, 'Purr! Tell me everything.')
	assert.equal(result.remembered, null)
	assert.deepEqual((asked[0] as { memory: { facts: object[] } }).memory.facts, [])
})

test('a duplicate keeps nothing new', async () => {
	const result = await talk(providerAnswering(keeping({ action: 'add', fact: FACT })))
	assert.ok(result.kind === 'answered' && result.remembered === null)
})

test('worried, with an event coming up: that note is marked as most likely why', async () => {
	const tomorrow = memoryRecord('d4444444-4444-4444-8444-444444444444', 'Has an exam', {
		category: 'study',
		kind: 'event',
		followUp: 'How did the exam go?',
		followUpOn: '2026-10-02'
	})
	fakeStore(memoryStore, 'pick', () => [SISTER, tomorrow])
	await talkToPet({
		userId: USER,
		body: { ...body, text: "I'm a bit nervous today" },
		provider: providerAnswering(KIND),
		now: NOW
	})
	const { memory } = asked[0] as { memory: { facts: { ref: string; worry: boolean }[] } }
	assert.deepEqual(
		memory.facts.map((fact) => [fact.ref, fact.worry]),
		[
			['m1', false],
			['m2', true]
		]
	)

	asked = []
	await talk()
	const calm = asked[0] as { memory: { facts: { worry: boolean }[] } }
	assert.ok(
		calm.memory.facts.every((fact) => !fact.worry),
		'not worried: nothing marked'
	)
})

test('a recalled note lights only when the reply really mentions it (R15b)', async () => {
	fakeStore(memoryStore, 'pick', () => [SISTER, EXAM])
	const recalling = (reply: string, recalled: string | null) =>
		providerAnswering({ ...KIND, reply: { ...KIND.reply, reply, recalled } } as ReplyResult)

	const named = await talk(recalling('How did the exam go? I kept your spot warm.', 'm2'))
	assert.ok(named.kind === 'answered')
	assert.deepEqual(named.recalled, { id: EXAM.id, text: 'Has an exam on Friday' })

	const claimed = await talk(recalling('Purr! Tell me everything.', 'm2'))
	assert.ok(claimed.kind === 'answered' && claimed.recalled === null, 'claimed, not said')

	const none = await talk(recalling('How did the exam go?', null))
	assert.ok(none.kind === 'answered' && none.recalled === null)
})
