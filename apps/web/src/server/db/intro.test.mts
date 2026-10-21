import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { lookById, type NewMemory } from '@app/contract'

// The intro store, against a real database (v2-memory-requirements.md, R21–R24): at most 2
// answered calls, the second only after one that kept nothing; a retry never counts twice; two
// calls at once can't both take the last attempt; Skip ends the step; nobody reaches another
// person's step; the attempts go with the pet.
//
// Needs a database with the migrations applied (docs/rules/migrations.md, "A local replay"),
// named by TEST_DATABASE_URL, and run by `npm run test:db`. Without it the suite skips.
const url = process.env.TEST_DATABASE_URL

const TRAITS = {
	affection: 10,
	playfulness: 4,
	energy: 4,
	curiosity: 6,
	loyalty: 8,
	independence: 4
}
const TODAY = '2026-10-04'
const NOW = new Date('2026-10-04T12:00:00Z')

const fact = (text: string): NewMemory => ({
	text,
	followUp: null,
	category: 'other',
	kind: 'lasting',
	importance: 1,
	tags: [text.split(' ').at(-1)!.toLowerCase()],
	followUpOn: null
})

describe(
	'the intro store, on a real database',
	{ skip: url ? false : 'TEST_DATABASE_URL is not set' },
	() => {
		const base = new PrismaClient({ datasourceUrl: url })
		let intro: import('./intro').IntroStore
		let memory: import('./memory').MemoryStore
		let pets: import('./pets').PetStore

		const users: string[] = []
		const person = async (withPet = true) => {
			const id = randomUUID()
			users.push(id)
			await base.$executeRaw`insert into auth.users (id, email) values (${id}::uuid, ${`${id}@example.test`})`
			if (withPet) {
				await pets.create(id, {
					id: randomUUID(),
					appearance: lookById('ginger').appearance,
					look: 'ginger',
					name: 'Mochi',
					preset: 'cuddly',
					traits: TRAITS
				})
			}
			return id
		}
		const record = (
			userId: string,
			facts: NewMemory[],
			over: Partial<import('./intro').IntroRecord> = {}
		) =>
			intro.record(userId, {
				messageId: randomUUID(),
				facts,
				cap: 30,
				today: TODAY,
				now: NOW,
				...over
			})

		before(async () => {
			const { createIntroStore } = await import('./intro')
			const { createMemoryStore } = await import('./memory')
			const { createPetStore } = await import('./pets')
			intro = createIntroStore(base)
			memory = createMemoryStore(base)
			pets = createPetStore(base)
		})

		after(async () => {
			await base.$executeRaw`delete from auth.users where id = any(${users}::uuid[])`
			await base.$disconnect()
		})

		test('a new pet: the step is due; one call that keeps facts ends it', async () => {
			const me = await person()
			assert.equal(await intro.due(me), true)
			const messageId = randomUUID()
			assert.deepEqual(await intro.status(me, messageId), { kind: 'open', attemptsLeft: 2 })

			const saved = await record(me, [fact('Studies medicine'), fact('Has a dog called Kara')], {
				messageId
			})
			assert.equal(saved.kind, 'saved')
			assert.ok(saved.kind === 'saved')
			assert.deepEqual(
				saved.facts.map((kept) => [kept.text, kept.source]),
				[
					['Studies medicine', 'intro'],
					['Has a dog called Kara', 'intro']
				]
			)
			assert.equal(saved.attemptsLeft, 0)
			assert.equal(saved.due, false)
			assert.equal(await intro.due(me), false)
			assert.equal((await memory.list(me, TODAY)).length, 2)
			assert.deepEqual(await intro.status(me, randomUUID()), { kind: 'closed' })
		})

		test('a retried message finds its row: the kept facts, no second attempt', async () => {
			const me = await person()
			const messageId = randomUUID()
			await record(me, [fact('Likes tea')], { messageId })
			const again = await intro.status(me, messageId)
			assert.equal(again.kind, 'retried')
			assert.ok(again.kind === 'retried')
			assert.deepEqual(
				again.facts.map((kept) => kept.text),
				['Likes tea']
			)
			const twice = await record(me, [fact('Likes coffee')], { messageId })
			assert.equal(twice.kind, 'retried')
			assert.equal((await memory.list(me, TODAY)).length, 1)
		})

		test('a call that keeps nothing leaves one more; a second that keeps nothing ends it', async () => {
			const me = await person()
			const first = await record(me, [])
			assert.deepEqual(first, { kind: 'saved', facts: [], attemptsLeft: 1, due: true })
			assert.equal(await intro.due(me), true)
			const second = await record(me, [])
			assert.deepEqual(second, { kind: 'saved', facts: [], attemptsLeft: 0, due: false })
			assert.equal(await intro.due(me), false)
			assert.equal((await record(me, [fact('Likes tea')])).kind, 'closed')
		})

		test('a fact the pet already remembers is not kept twice and counts as nothing', async () => {
			const me = await person()
			await memory.save(
				me,
				{ action: 'add', fact: fact('Likes tea') },
				{ cap: 30, source: 'talk', today: TODAY, now: NOW }
			)
			const saved = await record(me, [fact('likes TEA')])
			assert.ok(saved.kind === 'saved')
			assert.deepEqual(saved.facts, [])
			assert.equal(saved.due, true)
		})

		test('two calls at once: only one takes the last attempt', async () => {
			const me = await person()
			await record(me, [])
			const results = await Promise.all([
				record(me, [fact('Likes tea')]),
				record(me, [fact('Likes coffee')])
			])
			assert.deepEqual(results.map((result) => result.kind).sort(), ['closed', 'saved'])
			const [{ count }] = await base.$queryRaw<{ count: number }[]>`
				select count(*)::int as count from public.pet_intro_attempts a
				join public.pets p on p.id = a.pet_id where p.user_id = ${me}::uuid`
			assert.equal(count, 2)
			assert.equal((await memory.list(me, TODAY)).length, 1)
		})

		test('someone under 13 (`end`): nothing kept, and the step ends at once', async () => {
			const me = await person()
			const saved = await record(me, [], { end: true })
			assert.deepEqual(saved, { kind: 'saved', facts: [], attemptsLeft: 0, due: false })
			assert.equal(await intro.due(me), false)
		})

		test("an answered attempt, for the pet's voice: this person's, in the window (v2 voice)", async () => {
			const me = await person()
			const other = await person()
			const messageId = randomUUID()
			await record(me, [], { messageId })
			const { createdAt } = await base.petIntroAttempt.findUniqueOrThrow({
				where: { id: messageId }
			})
			const before = new Date(createdAt.getTime() - 1_000)
			assert.deepEqual(await intro.answeredAttempt(me, messageId, before), {
				species: 'cat',
				preset: 'cuddly'
			})
			assert.equal(await intro.answeredAttempt(other, messageId, before), null, 'not yours')
			assert.equal(
				await intro.answeredAttempt(me, messageId, new Date(createdAt.getTime() + 1_000)),
				null,
				'too old'
			)
			assert.equal(await intro.answeredAttempt(me, randomUUID(), before), null, 'never answered')
		})

		test('Skip ends the step for good; skipping twice changes nothing', async () => {
			const me = await person()
			assert.equal(await intro.skip(me, NOW), true)
			assert.equal(await intro.skip(me, new Date(NOW.getTime() + 60_000)), true)
			assert.equal(await intro.due(me), false)
			const [{ finished }] = await base.$queryRaw<{ finished: Date }[]>`
				select intro_finished_at as finished from public.pets where user_id = ${me}::uuid`
			assert.equal(finished.toISOString(), NOW.toISOString())
		})

		test("another pet's message id is never this person's retry", async () => {
			const me = await person()
			const someone = await person()
			const messageId = randomUUID()
			await record(someone, [fact('Likes tea')], { messageId })
			assert.deepEqual(await intro.status(me, messageId), { kind: 'closed' })
			assert.deepEqual(await record(me, [fact('Likes coffee')], { messageId }), {
				kind: 'conflict'
			})
			assert.equal((await memory.list(me, TODAY)).length, 0)
		})

		test('without a pet: nothing is due, open or skipped', async () => {
			const me = await person(false)
			assert.equal(await intro.due(me), null)
			assert.deepEqual(await intro.status(me, randomUUID()), { kind: 'no_pet' })
			assert.deepEqual(await record(me, [fact('Likes tea')]), { kind: 'no_pet' })
			assert.equal(await intro.skip(me), false)
		})

		test('the attempts go with the pet, and so with the account', async () => {
			const me = await person()
			await record(me, [])
			await base.$executeRaw`delete from public.pets where user_id = ${me}::uuid`
			const [{ count }] = await base.$queryRaw<{ count: number }[]>`
				select count(*)::int as count from public.pet_intro_attempts a
				where not exists (select 1 from public.pets p where p.id = a.pet_id)`
			assert.equal(count, 0)
		})
	}
)
