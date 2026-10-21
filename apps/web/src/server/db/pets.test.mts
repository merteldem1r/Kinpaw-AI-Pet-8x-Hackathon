import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { lookById, STARTING_NEEDS } from '@app/contract'

// The pet store, against a real database: one pet per person, only their own, a retried save
// finds its row, a second pet is refused in favour of the first, someone else's id is a
// conflict, and deleting the account deletes the pet.
//
// Needs a database with the migrations applied (docs/rules/migrations.md, "A local replay"),
// named by TEST_DATABASE_URL, and run by `npm run test:db`. Without it the suite skips.
const url = process.env.TEST_DATABASE_URL
/** The needs are fractions (needs-rhythm R9): compare them at a fixed precision. */
const tenths = (n: number | undefined) => Math.round((n ?? NaN) * 10) / 10
const hundredths = (n: number | undefined) => Math.round((n ?? NaN) * 100) / 100

const TRAITS = {
	affection: 10,
	playfulness: 4,
	energy: 4,
	curiosity: 6,
	loyalty: 8,
	independence: 4
}

describe(
	'the pet store, on a real database',
	{ skip: url ? false : 'TEST_DATABASE_URL is not set' },
	() => {
		const base = new PrismaClient({ datasourceUrl: url })
		let pets: import('./pets').PetStore
		const sam = randomUUID()
		const alex = randomUUID()

		const signUp = (...ids: string[]) =>
			Promise.all(
				ids.map(
					(id) =>
						base.$executeRaw`insert into auth.users (id, email) values (${id}::uuid, ${`${id}@example.test`})`
				)
			)
		const deleteUsers = (...ids: string[]) =>
			base.$executeRaw`delete from auth.users where id = any(${ids}::uuid[])`
		const newPet = (overrides: Partial<import('./pets').NewPet> = {}) => ({
			id: randomUUID(),
			appearance: lookById('ginger').appearance,
			look: 'ginger' as const,
			name: 'Mochi',
			preset: 'cuddly' as const,
			traits: TRAITS,
			...overrides
		})

		before(async () => {
			// Loaded here: it imports server-only modules, which resolve only under the
			// react-server condition `npm run test:db` sets.
			pets = (await import('./pets')).createPetStore(base)
			await signUp(sam, alex)
		})

		after(async () => {
			await deleteUsers(sam, alex)
			await base.$disconnect()
		})

		test('nobody has a pet until they save one', async () => {
			assert.equal(await pets.get(sam), null)
		})

		test('a save is made once, and a retry of it finds the same pet', async () => {
			const input = newPet()
			const first = await pets.create(sam, input)
			assert.equal(first.outcome, 'created')
			assert.ok(first.outcome !== 'conflict')
			assert.equal(first.row.name, 'Mochi')
			assert.equal(first.row.affection, 10)

			const retry = await pets.create(sam, { ...input, name: 'Edited' })
			assert.equal(retry.outcome, 'retried')
			assert.ok(retry.outcome !== 'conflict' && retry.row.name === 'Mochi')
			assert.equal((await pets.get(sam))?.id, input.id)
		})

		test('a second pet is refused: the first one wins, and nothing is written', async () => {
			const second = await pets.create(
				sam,
				newPet({ name: 'Biscuit', appearance: lookById('biscuit').appearance, look: 'biscuit' })
			)
			assert.equal(second.outcome, 'existing')
			assert.ok(second.outcome !== 'conflict' && second.row.name === 'Mochi')
			assert.equal(await base.pet.count({ where: { userId: sam } }), 1)
		})

		test('a pet keeps its whole appearance, and a built pet has no look', async () => {
			const who = randomUUID()
			await signUp(who)
			const built = {
				...lookById('ginger').appearance,
				eyes: 'green',
				tail: 'curly',
				pattern: 'tabby',
				accent: 'chocolate',
				white: 'mittens',
				trim: 'golden'
			} as const
			const saved = await pets.create(who, newPet({ appearance: built, look: null }))
			assert.ok(saved.outcome === 'created')
			const { species, fur, pattern, eyes, ears, body, tail, accent, white, trim, look } = saved.row
			assert.deepEqual(
				{ species, fur, pattern, eyes, ears, body, tail, accent, white, trim },
				built
			)
			assert.equal(look, null)
			await deleteUsers(who)
		})

		test('a new pet starts with the starting needs', async () => {
			const who = randomUUID()
			await signUp(who)
			const saved = await pets.create(who, newPet())
			assert.ok(saved.outcome === 'created')
			const { needsOf } = await import('./pets')
			assert.deepEqual(needsOf(saved.row).needs, STARTING_NEEDS)
			assert.equal(await base.petNeeds.count({ where: { petId: saved.row.id } }), 1)
			await deleteUsers(who)
		})

		test('an action decays to now, applies, and stamps the time', async () => {
			const who = randomUUID()
			await signUp(who)
			const input = newPet()
			await pets.create(who, input)
			// Two hours ago, at noon UTC (awake): hunger 60 → 36, then Feed gives 40 × 64% = 25.6;
			// happiness 80 → 62, then 3 × 38% = 1.14. Stored as fractions (needs-rhythm R9).
			const twoHoursAgo = new Date('2026-10-01T10:00:00.000Z')
			await base.petNeeds.update({ where: { petId: input.id }, data: { updatedAt: twoHoursAgo } })
			const now = new Date('2026-10-01T12:00:00.000Z')
			const result = await pets.act(who, 'feed', 'UTC', now)
			assert.ok(result)
			assert.equal(result.changed, true)
			assert.equal(tenths(result.row.needs?.hunger), 61.6)
			assert.equal(hundredths(result.row.needs?.happiness), 63.14)
			assert.equal(result.row.needs?.updatedAt.toISOString(), now.toISOString())
			await deleteUsers(who)
		})

		test('two taps at once are both applied: the row lock loses neither', async () => {
			const who = randomUUID()
			await signUp(who)
			await pets.create(who, newPet())
			const now = new Date()
			// Affection 70: one Pet gives 30 × 30% = 9 (79); the second, applied after it, 30 × 21% =
			// 6.3 (85.3). Losing either would leave 79.
			await Promise.all([pets.act(who, 'pet', 'UTC', now), pets.act(who, 'pet', 'UTC', now)])
			assert.equal(tenths((await pets.get(who))?.needs?.affection), 85.3)
			await deleteUsers(who)
		})

		test('a pet with no needs row reads as the starting needs, and its first action creates it', async () => {
			const who = randomUUID()
			await signUp(who)
			const input = newPet()
			await pets.create(who, input)
			// As if saved before pet_needs existed.
			await base.petNeeds.delete({ where: { petId: input.id } })
			const { needsOf } = await import('./pets')
			const before = await pets.get(who)
			assert.ok(before && before.needs === null)
			assert.deepEqual(needsOf(before).needs, STARTING_NEEDS)
			const result = await pets.act(who, 'pet', 'UTC')
			assert.equal(Math.round(result?.row.needs?.affection ?? 0), 79)
			assert.equal(await base.petNeeds.count({ where: { petId: input.id } }), 1)
			await deleteUsers(who)
		})

		test('a retried save keeps the first needs row', async () => {
			const who = randomUUID()
			await signUp(who)
			const input = newPet()
			await pets.create(who, input)
			await pets.act(who, 'pet', 'UTC')
			await pets.create(who, input)
			assert.equal(Math.round((await pets.get(who))?.needs?.affection ?? 0), 79)
			await deleteUsers(who)
		})

		test('deleting the pet deletes its needs', async () => {
			const who = randomUUID()
			await signUp(who)
			const input = newPet()
			await pets.create(who, input)
			await deleteUsers(who)
			assert.equal(await base.petNeeds.count({ where: { petId: input.id } }), 0)
		})

		test('no pet, no action', async () => {
			assert.equal(await pets.act(alex, 'feed', 'UTC'), null)
		})

		test("someone else's pet id is a conflict, and their pet is untouched", async () => {
			const samsPet = await pets.get(sam)
			assert.ok(samsPet)
			assert.deepEqual(await pets.create(alex, newPet({ id: samsPet.id, name: 'Mine now' })), {
				outcome: 'conflict'
			})
			assert.equal((await pets.get(sam))?.name, 'Mochi')
			assert.equal(await pets.get(alex), null)
		})

		test('deleting the account deletes the pet', async () => {
			const who = randomUUID()
			await signUp(who)
			const input = newPet()
			await pets.create(who, input)
			await deleteUsers(who)
			assert.equal(await base.pet.count({ where: { id: input.id } }), 0)
		})
	}
)
