import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { PrismaClient } from '@prisma/client'

// The photo read limits, against a real database (v2-pet-from-photo-requirements.md, R19–R22):
// two tries per phone ever, a released read never counts, two reads at once can't both take the
// last try, a network's and the app's day are capped, a Plus redo is once a local day, and an
// abandoned read stops counting. Each test uses its own hashes, so tests don't see each other's
// rows; the app-wide cap is checked against the rows already there.
//
// Needs a database with the migrations applied (docs/rules/migrations.md, "A local replay"),
// named by TEST_DATABASE_URL, and run by `npm run test:db`. Without it the suite skips.
const url = process.env.TEST_DATABASE_URL

const LIMITS = { perDevice: 2, perNetwork: 6, perAccountDay: 1, perAppDay: 10_000 }
const NOW = new Date('2026-10-04T12:00:00Z')
const DAY = '2026-10-04'

describe(
	'the photo read limits, on a real database',
	{ skip: url ? false : 'TEST_DATABASE_URL is not set' },
	() => {
		const base = new PrismaClient({ datasourceUrl: url })
		let store: import('./photo-reads').PhotoReadStore
		const users: string[] = []
		const hashes: string[] = []
		const hash = () => {
			const value = randomUUID().replaceAll('-', '')
			hashes.push(value)
			return value
		}
		const create = (deviceHash: string, ipHash = hash()) => ({
			context: 'create' as const,
			deviceHash,
			ipHash,
			userId: null,
			day: DAY
		})

		before(async () => {
			const { createPhotoReadStore } = await import('./photo-reads')
			store = createPhotoReadStore(base)
		})
		after(async () => {
			await base.petPhotoRead.deleteMany({
				where: { OR: [{ deviceHash: { in: hashes } }, { ipHash: { in: hashes } }] }
			})
			for (const id of users) await base.$executeRaw`delete from auth.users where id = ${id}::uuid`
			await base.$disconnect()
		})

		test('two tries per phone, ever; the third names the device and leaves none', async () => {
			const device = hash()
			const first = await store.reserve(create(device), LIMITS, NOW)
			assert.equal(first.kind === 'reserved' && first.left, 1)
			if (first.kind === 'reserved') await store.settle(first.id, 'read')
			const second = await store.reserve(create(device), LIMITS, NOW)
			assert.equal(second.kind === 'reserved' && second.left, 0)
			if (second.kind === 'reserved') await store.settle(second.id, 'no_pet')
			// A year later, still none.
			const later = new Date('2027-10-04T12:00:00Z')
			assert.deepEqual(await store.reserve(create(device), LIMITS, later), {
				kind: 'limit',
				limit: 'device',
				left: 0
			})
		})

		test('a released read never counts', async () => {
			const device = hash()
			for (let i = 0; i < 5; i += 1) {
				const reserved = await store.reserve(create(device), LIMITS, NOW)
				assert.equal(reserved.kind, 'reserved')
				if (reserved.kind === 'reserved') await store.release(reserved.id)
			}
			assert.equal((await store.reserve(create(device), LIMITS, NOW)).kind, 'reserved')
		})

		test('two reads at once for the last try: exactly one gets it', async () => {
			const device = hash()
			const first = await store.reserve(create(device), LIMITS, NOW)
			if (first.kind === 'reserved') await store.settle(first.id, 'read')
			const [a, b] = await Promise.all([
				store.reserve(create(device), LIMITS, NOW),
				store.reserve(create(device), LIMITS, NOW)
			])
			assert.deepEqual([a.kind, b.kind].sort(), ['limit', 'reserved'])
		})

		test('a read abandoned mid-way (still pending after two minutes) stops counting', async () => {
			const device = hash()
			await store.reserve(create(device), LIMITS, NOW)
			await store.reserve(create(device), LIMITS, NOW)
			assert.equal((await store.reserve(create(device), LIMITS, NOW)).kind, 'limit')
			const later = new Date(NOW.getTime() + 3 * 60 * 1000)
			assert.equal((await store.reserve(create(device), LIMITS, later)).kind, 'reserved')
		})

		test('one network: six counted reads a UTC day across phones, then the network limit', async () => {
			const ip = hash()
			for (let i = 0; i < 6; i += 1) {
				const reserved = await store.reserve(create(hash(), ip), LIMITS, NOW)
				assert.equal(reserved.kind, 'reserved', `read ${i + 1}`)
				if (reserved.kind === 'reserved') await store.settle(reserved.id, 'read')
			}
			const seventh = await store.reserve(create(hash(), ip), LIMITS, NOW)
			assert.deepEqual(seventh, { kind: 'limit', limit: 'network', left: 2 })
			const tomorrow = new Date('2026-10-05T00:30:00Z')
			assert.equal((await store.reserve(create(hash(), ip), LIMITS, tomorrow)).kind, 'reserved')
		})

		test("the app's day: past its cap, every read is refused with the app limit", async () => {
			const later = new Date('2026-10-06T12:00:00Z')
			const today = await base.petPhotoRead.count({
				where: { createdAt: { gte: new Date('2026-10-06T00:00:00Z') } }
			})
			const cap = { ...LIMITS, perAppDay: today + 1 }
			const one = await store.reserve(create(hash()), cap, later)
			assert.equal(one.kind, 'reserved')
			assert.deepEqual(await store.reserve(create(hash()), cap, later), {
				kind: 'limit',
				limit: 'app',
				left: 2
			})
		})

		test("a Plus redo: once a local day, by account; tomorrow there's another", async () => {
			const userId = randomUUID()
			users.push(userId)
			await base.$executeRaw`insert into auth.users (id, email) values (${userId}::uuid, ${`${userId}@example.test`})`
			const redo = (day: string) => ({ context: 'redo' as const, ipHash: hash(), userId, day })
			const first = await store.reserve(redo(DAY), LIMITS, NOW)
			assert.equal(first.kind === 'reserved' && first.left, 0)
			assert.deepEqual(await store.reserve(redo(DAY), LIMITS, NOW), {
				kind: 'limit',
				limit: 'today',
				left: 0
			})
			assert.equal((await store.reserve(redo('2026-10-05'), LIMITS, NOW)).kind, 'reserved')
			// Deleting the account keeps the counts, without the person.
			await base.$executeRaw`delete from auth.users where id = ${userId}::uuid`
			const kept = await base.petPhotoRead.count({
				where: { context: 'redo', localDay: new Date(`${DAY}T00:00:00Z`), userId: null }
			})
			assert.ok(kept >= 1)
		})
	}
)
