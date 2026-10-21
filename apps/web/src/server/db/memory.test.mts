import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { lookById, MEMORY_CAP_FREE, MEMORY_IN_PROMPT, type NewMemory } from '@app/contract'

// The memory store, against a real database (v2-memory-requirements.md, R5–R9, R16–R17, R27):
// what is kept, what is shown, and what goes when full; nobody reaches another person's facts;
// the facts go with the pet.
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
const TODAY = '2026-10-03'
const NOW = new Date('2026-10-03T12:00:00Z')
const HOUR = 3_600_000

const fact = (text: string, over: Partial<NewMemory> = {}): NewMemory => ({
	text,
	followUp: null,
	category: 'other',
	kind: 'lasting',
	importance: 1,
	tags: [text.split(' ').at(-1)!.toLowerCase()],
	followUpOn: null,
	...over
})
const exam = fact('Has an exam on Friday', {
	category: 'study',
	kind: 'event',
	followUp: 'How did the exam go?',
	tags: ['exam', 'test'],
	followUpOn: '2026-10-09'
})

describe(
	'the memory store, on a real database',
	{ skip: url ? false : 'TEST_DATABASE_URL is not set' },
	() => {
		const base = new PrismaClient({ datasourceUrl: url })
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
		const save = (
			userId: string,
			change: import('./memory').MemoryChange,
			over: Partial<import('./memory').SaveOptions> = {}
		) =>
			memory.save(userId, change, {
				cap: MEMORY_CAP_FREE,
				source: 'talk',
				today: TODAY,
				now: NOW,
				...over
			})
		const add = (userId: string, newFact: NewMemory, over = {}) =>
			save(userId, { action: 'add', fact: newFact }, over)

		before(async () => {
			const { createMemoryStore } = await import('./memory')
			const { createPetStore } = await import('./pets')
			memory = createMemoryStore(base)
			pets = createPetStore(base)
		})

		after(async () => {
			await base.$executeRaw`delete from auth.users where id = any(${users}::uuid[])`
			await base.$disconnect()
		})

		test('a fact is kept with every field, and listed newest first', async () => {
			const me = await person()
			const first = await add(
				me,
				fact('Has a dog called Kara', { category: 'pets', importance: 2 })
			)
			assert.equal(first.kind, 'saved')
			await add(me, exam, { now: new Date(NOW.getTime() + 1000) })

			const listed = await memory.list(me, TODAY)
			assert.deepEqual(
				listed.map((f) => f.text),
				['Has an exam on Friday', 'Has a dog called Kara']
			)
			const [stored] = listed
			assert.equal(stored!.followUpOn, '2026-10-09')
			assert.equal(stored!.followUp, 'How did the exam go?')
			assert.equal(stored!.kind, 'event')
			assert.equal(stored!.category, 'study')
			assert.deepEqual(stored!.tags, ['exam', 'test'])
			assert.equal(stored!.source, 'talk')
		})

		test('the same fact again is a duplicate, whatever its case and punctuation (R6)', async () => {
			const me = await person()
			await add(me, fact('Lives in Istanbul'))
			assert.deepEqual(await add(me, fact('lives in istanbul.')), { kind: 'duplicate' })
			assert.equal((await memory.list(me, TODAY)).length, 1)
		})

		test('a replace updates the fact in place and asks about it afresh (R6)', async () => {
			const me = await person()
			const saved = await add(me, fact('Lives in Istanbul', { category: 'place' }))
			assert.equal(saved.kind, 'saved')
			const id = saved.kind === 'saved' ? saved.memory.id : ''
			await base.$executeRaw`update public.pet_memories set followed_up_at = now() where id = ${id}::uuid`

			const replaced = await save(me, {
				action: 'replace',
				id,
				fact: fact('Lives in Berlin', { category: 'place' })
			})
			assert.equal(replaced.kind === 'saved' && replaced.replaced, true)
			const [only, ...rest] = await memory.list(me, TODAY)
			assert.equal(rest.length, 0)
			assert.equal(only!.id, id)
			assert.equal(only!.text, 'Lives in Berlin')
			assert.equal(only!.followedUpAt, null)
		})

		test("a replace naming someone else's fact, or none, is an add", async () => {
			const me = await person()
			const other = await person()
			const theirs = await add(other, fact('Works at a bank'))
			const theirId = theirs.kind === 'saved' ? theirs.memory.id : ''

			const result = await save(me, {
				action: 'replace',
				id: theirId,
				fact: fact('Works at a bakery')
			})
			assert.equal(result.kind === 'saved' && result.replaced, false)
			assert.deepEqual(
				(await memory.list(other, TODAY)).map((f) => f.text),
				['Works at a bank'],
				'their fact is untouched'
			)
			assert.equal((await memory.list(me, TODAY)).length, 1)
		})

		test('a replace that says what another fact already does drops it, keeping the other', async () => {
			const me = await person()
			await add(me, fact('Works as a barista'))
			const old = await add(me, fact('Works at a bakery'))
			const oldId = old.kind === 'saved' ? old.memory.id : ''
			assert.deepEqual(
				await save(me, { action: 'replace', id: oldId, fact: fact('Works as a barista') }),
				{ kind: 'duplicate' }
			)
			assert.deepEqual(
				(await memory.list(me, TODAY)).map((f) => f.text),
				['Works as a barista']
			)
		})

		test('full: the lowest worth goes to make room, never past the cap (R5)', async () => {
			const me = await person()
			const cap = 3
			await add(me, fact('Sister called Ece', { importance: 2 }), { cap })
			await add(me, fact('Likes sushi', { importance: 0 }), {
				cap,
				now: new Date(NOW.getTime() - 2 * HOUR)
			})
			await add(me, fact('Likes rain', { importance: 0 }), { cap })
			await add(me, fact('Has a dog called Kara', { importance: 2 }), { cap })

			const texts = (await memory.list(me, TODAY)).map((f) => f.text).sort()
			assert.deepEqual(texts, ['Has a dog called Kara', 'Likes rain', 'Sister called Ece'])
		})

		test('over the cap after Plus ends, nothing goes until a new fact comes (R8)', async () => {
			const me = await person()
			for (let i = 0; i < 4; i++) await add(me, fact(`Likes thing ${i}`), { cap: 100 })
			assert.equal((await memory.list(me, TODAY)).length, 4)
			await add(me, fact('Likes the sea'), { cap: 2 })
			assert.equal((await memory.list(me, TODAY)).length, 2)
		})

		test('an event 14 days past its day is gone: not listed, deleted on the next save (R7)', async () => {
			const me = await person()
			await add(me, { ...exam, followUpOn: '2026-10-09' })
			assert.equal((await memory.list(me, '2026-10-23')).length, 1, 'day 14')
			assert.equal((await memory.list(me, '2026-10-24')).length, 0, 'day 15')
			await add(me, fact('Likes tea'), { today: '2026-10-24' })
			const [{ count }] = await base.$queryRaw<{ count: number }[]>`
				select count(*)::int as count from public.pet_memories m
				join public.pets p on p.id = m.pet_id where p.user_id = ${me}::uuid`
			assert.equal(count, 1)
		})

		test('the pick: at most six, by the score, each marked used (R9)', async () => {
			const me = await person()
			await add(me, exam)
			for (let i = 0; i < 7; i++) await add(me, fact(`Likes colour ${i}`, { importance: 0 }))
			const picked = await memory.pick(me, 'I am nervous about the exam', TODAY, NOW)
			assert.equal(picked.length, MEMORY_IN_PROMPT)
			assert.equal(picked[0]!.text, 'Has an exam on Friday')

			const [{ used }] = await base.$queryRaw<{ used: number }[]>`
				select count(*)::int as used from public.pet_memories m join public.pets p on p.id = m.pet_id
				where p.user_id = ${me}::uuid and m.last_used_at = ${NOW}`
			assert.equal(used, MEMORY_IN_PROMPT)
		})

		test('delete: only the owner, and only once (R17)', async () => {
			const me = await person()
			const other = await person()
			const saved = await add(me, fact('Has a cat called Pamuk'))
			const id = saved.kind === 'saved' ? saved.memory.id : ''
			assert.equal(await memory.remove(other, id), false)
			assert.equal((await memory.list(me, TODAY)).length, 1)
			assert.equal(await memory.remove(me, id), true)
			assert.equal(await memory.remove(me, id), false)
		})

		test('the due event: the most important first, asked once (R27)', async () => {
			const me = await person()
			await add(me, { ...exam, importance: 1, followUpOn: '2026-10-04' })
			await add(
				me,
				fact('Job interview on Monday', {
					kind: 'event',
					importance: 2,
					tags: ['interview'],
					followUpOn: '2026-10-05',
					followUp: 'How did the interview go?'
				})
			)
			assert.equal(await memory.due(me, TODAY), null, 'nothing has happened yet')

			const due = await memory.due(me, '2026-10-06')
			assert.equal(due?.text, 'Job interview on Monday')
			assert.equal(await memory.markFollowedUp(me, due!.id, NOW), true)
			assert.equal(await memory.markFollowedUp(me, due!.id, NOW), false, 'asked once')
			assert.equal((await memory.due(me, '2026-10-06'))?.text, 'Has an exam on Friday')
		})

		test('pages: newest first, no skips or repeats even when a fact goes between pages', async () => {
			const me = await person()
			for (let i = 0; i < 7; i++) {
				await add(me, fact(`Likes thing ${i}`), { now: new Date(NOW.getTime() + i * 1000) })
			}
			const first = await memory.page(me, { today: TODAY, limit: 3 })
			assert.deepEqual(
				first.memories.map((f) => f.text),
				['Likes thing 6', 'Likes thing 5', 'Likes thing 4']
			)
			assert.equal(first.total, 7)
			assert.equal(first.matched, 7)
			assert.ok(first.next)

			// "Likes thing 5" is forgotten while the first page is on screen.
			await memory.remove(me, first.memories[1]!.id)
			const second = await memory.page(me, { today: TODAY, limit: 3, cursor: first.next! })
			assert.deepEqual(
				second.memories.map((f) => f.text),
				['Likes thing 3', 'Likes thing 2', 'Likes thing 1']
			)
			const third = await memory.page(me, { today: TODAY, limit: 3, cursor: second.next! })
			assert.deepEqual(
				third.memories.map((f) => f.text),
				['Likes thing 0']
			)
			assert.equal(third.next, null)
			assert.equal(third.total, 6)
		})

		test('search: the words in any case, or a tag exactly; counts what it found', async () => {
			const me = await person()
			await add(me, exam)
			await add(me, fact('Sister called Ece', { tags: ['sister', 'family'] }))
			await add(me, fact('Likes sushi', { tags: ['food'] }))

			const byWord = await memory.page(me, { today: TODAY, limit: 20, search: 'EXAM' })
			assert.deepEqual(
				byWord.memories.map((f) => f.text),
				['Has an exam on Friday']
			)
			assert.equal(byWord.matched, 1)
			assert.equal(byWord.total, 3)

			const byTag = await memory.page(me, { today: TODAY, limit: 20, search: 'Family' })
			assert.deepEqual(
				byTag.memories.map((f) => f.text),
				['Sister called Ece']
			)

			const none = await memory.page(me, { today: TODAY, limit: 20, search: 'berlin' })
			assert.deepEqual([none.memories.length, none.matched, none.total], [0, 0, 3])

			const wildcard = await memory.page(me, { today: TODAY, limit: 20, search: '%' })
			assert.equal(wildcard.matched, 0, 'a % is a character, not "everything"')
			const underscore = await memory.page(me, { today: TODAY, limit: 20, search: 'L_kes' })
			assert.equal(underscore.matched, 0, 'a _ is a character, not "any letter"')
		})

		test("pages leave out expired events and never show another person's facts", async () => {
			const me = await person()
			const other = await person()
			await add(me, { ...exam, followUpOn: '2026-10-09' })
			await add(me, fact('Likes tea'))
			await add(other, fact('Likes coffee'))
			const later = await memory.page(me, { today: '2026-10-24', limit: 20 })
			assert.deepEqual(
				later.memories.map((f) => f.text),
				['Likes tea']
			)
			assert.equal(later.total, 1)
			const mine = await memory.page(me, { today: TODAY, limit: 20, search: 'coffee' })
			assert.equal(mine.matched, 0)
		})

		test('without a pet: nothing to save, list or pick', async () => {
			const me = await person(false)
			assert.deepEqual(await add(me, fact('Likes tea')), { kind: 'no_pet' })
			assert.deepEqual(await memory.list(me, TODAY), [])
			assert.deepEqual(await memory.pick(me, 'tea', TODAY, NOW), [])
		})

		test('the facts go with the pet, and so with the account', async () => {
			const me = await person()
			await add(me, fact('Likes tea'))
			await base.$executeRaw`delete from public.pets where user_id = ${me}::uuid`
			const [{ count }] = await base.$queryRaw<{ count: number }[]>`
				select count(*)::int as count from public.pet_memories m
				where not exists (select 1 from public.pets p where p.id = m.pet_id)`
			assert.equal(count, 0)
		})
	}
)
