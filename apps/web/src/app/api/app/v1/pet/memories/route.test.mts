// What the pet remembers, over HTTP (v2-memory-requirements.md, R16–R17): the caller's facts in
// the contract's shape, the cap from the server's premium check, and a delete that only ever
// reaches the caller's own facts and records where it happened, never the fact.
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { MEMORY_CAP_FREE, MEMORY_CAP_PLUS, petMemoriesResponse } from '@app/contract'
import { fake, fakeStore, reset, send, USER } from '@/server/api/app-test-kit.mts'

const list = await import('./route')
const one = await import('./[id]/route')
const { memoryStore } = await import('@/server/db/memory')
const { profileStore } = await import('@/server/db/profiles')
const { analyticsStore } = await import('@/server/db/analytics')

const ID = '63e25c0e-b8ad-4fab-b2d0-b2a66c7b63fb'
const EXAM = {
	id: ID,
	text: 'Has an exam',
	followUp: 'How did the exam go?',
	category: 'study',
	kind: 'event',
	importance: 1,
	tags: ['exam', 'test'],
	followUpOn: '2026-10-04',
	followedUpAt: null,
	source: 'talk',
	lastUsedAt: null,
	createdAt: new Date('2026-10-03T19:53:17.378Z')
}

beforeEach(() => {
	reset()
	fakeStore(memoryStore, 'page', () => ({ memories: [EXAM], total: 3, matched: 1, next: null }))
	fakeStore(memoryStore, 'remove', () => true)
	fakeStore(profileStore, 'isPremium', () => false)
	fakeStore(profileStore, 'regionOf', () => null)
	fakeStore(analyticsStore, 'hasDuplicate', () => false)
	fakeStore(analyticsStore, 'insertEvent', () => undefined)
})

const calls = (method: string) => fake.storeCalls.filter((call) => call.method === method)
const get = (query = '?time_zone=Europe/Istanbul', token?: null) =>
	send(list.GET, `/api/app/v1/pet/memories${query}`, token === null ? { token } : {})
const del = (id = ID, from = 'list') =>
	send(one.DELETE, `/api/app/v1/pet/memories/${id}?from=${from}`, {
		method: 'DELETE',
		params: { id }
	})

test("the caller's facts, in the contract's shape, never the tags; the free cap", async () => {
	const res = await get()
	assert.equal(res.status, 200)
	assert.ok(petMemoriesResponse.safeParse(res.body).success)
	assert.deepEqual(res.body, {
		memories: [
			{
				id: ID,
				text: 'Has an exam',
				category: 'study',
				kind: 'event',
				follow_up_on: '2026-10-04',
				source: 'talk',
				created_at: '2026-10-03T19:53:17.378Z'
			}
		],
		cap: MEMORY_CAP_FREE,
		total: 3,
		matched: 1,
		next_cursor: null
	})
	const [userId, query] = calls('page')[0]!.args as [string, Record<string, unknown>]
	assert.equal(userId, USER)
	assert.deepEqual(query, { today: query.today, search: undefined, cursor: undefined, limit: 20 })
})

test('Plus: the cap is 100, from the server', async () => {
	fakeStore(profileStore, 'isPremium', () => true)
	assert.equal((await get()).body.cap, MEMORY_CAP_PLUS)
})

test('a time zone that is not real, or none, is a 400; no token is a 401', async () => {
	assert.equal((await get('?time_zone=Mars/Olympus')).status, 400)
	assert.equal((await get('')).status, 400)
	assert.equal((await get(undefined, null)).status, 401)
})

test('delete: the caller and the id go to the store; memory_deleted has only where', async () => {
	const res = await del()
	assert.equal(res.status, 200)
	assert.deepEqual(res.body, { ok: true })
	assert.deepEqual(calls('remove')[0]!.args, [USER, ID])
	const recorded = calls('insertEvent').map(
		(call) => call.args[0] as { name: string; metadata: object }
	)
	assert.deepEqual(
		recorded.map((event) => [event.name, event.metadata]),
		[['memory_deleted', { from: 'list' }]]
	)
	assert.doesNotMatch(JSON.stringify(recorded), /exam/i)
})

test("someone else's fact, or one already gone: 404, and nothing recorded", async () => {
	fakeStore(memoryStore, 'remove', () => false)
	const res = await del()
	assert.equal(res.status, 404)
	assert.equal(calls('insertEvent').length, 0)
})

test('delete from the intro is told apart; a malformed id is a 404, a bad source a 400', async () => {
	await del(ID, 'intro')
	const [event] = calls('insertEvent').map((call) => call.args[0] as { metadata: object })
	assert.deepEqual(event?.metadata, { from: 'intro' })
	assert.equal((await del('not-a-uuid')).status, 404)
	assert.equal((await del(ID, 'somewhere')).status, 400)
})

test('search, page size and the next page go through; the cursor round-trips', async () => {
	const after = new Date('2026-10-03T19:53:17.378Z')
	fakeStore(memoryStore, 'page', () => ({
		memories: [EXAM],
		total: 3,
		matched: 1,
		next: { createdAt: after, id: ID }
	}))
	const first = await get('?time_zone=Europe/Istanbul&q=%20exam%20&limit=5')
	assert.equal(first.status, 200)
	const cursor = first.body.next_cursor as string
	assert.ok(cursor && !cursor.includes(ID), 'opaque')
	const [, query] = calls('page')[0]!.args as [string, Record<string, unknown>]
	assert.equal(query.search, 'exam')
	assert.equal(query.limit, 5)

	await get(`?time_zone=Europe/Istanbul&cursor=${cursor}`)
	const [, next] = calls('page')[1]!.args as [string, { cursor: { createdAt: Date; id: string } }]
	assert.deepEqual(next.cursor, { createdAt: after, id: ID })
})

test('a cursor this server never gave, a page too big or a search too long: 400, no query', async () => {
	const bad = Buffer.from('yesterday|not-an-id').toString('base64url')
	for (const query of [
		`&cursor=${bad}`,
		'&cursor=%25%25%25',
		'&limit=21',
		'&limit=0',
		`&q=${'x'.repeat(61)}`,
		'&sort=text'
	]) {
		assert.equal((await get(`?time_zone=Europe/Istanbul${query}`)).status, 400, query)
	}
	assert.equal(calls('page').length, 0)
})
