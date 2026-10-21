import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { FRIENDS_MAX, lookById, normalizeFriendCode } from '@app/contract'

// The friend store, against a real database (v2-friends-requirements.md): a code made once and
// replaced on demand, adds that are mutual and safe to retry, the 50-friend cap on either side,
// removal for both and never by a stranger, and everything gone with an account.
//
// Needs a database with the migrations applied (docs/rules/migrations.md, "A local replay"),
// named by TEST_DATABASE_URL, and run by `npm run test:db`. Without it the suite skips.
const url = process.env.TEST_DATABASE_URL

describe(
	'the friend store, on a real database',
	{ skip: url ? false : 'TEST_DATABASE_URL is not set' },
	() => {
		const base = new PrismaClient({ datasourceUrl: url })
		let friends: import('./friends').FriendStore
		let pets: import('./pets').PetStore
		const sam = randomUUID()
		const alex = randomUUID()
		const kai = randomUUID()
		const made: string[] = []

		const signUp = async (...ids: string[]) => {
			made.push(...ids)
			await Promise.all(
				ids.map(
					(id) =>
						base.$executeRaw`insert into auth.users (id, email) values (${id}::uuid, ${`${id}@example.test`})`
				)
			)
		}
		const deleteUsers = (...ids: string[]) =>
			base.$executeRaw`delete from auth.users where id = any(${ids}::uuid[])`
		const savePet = (userId: string, name: string) =>
			pets.create(userId, {
				id: randomUUID(),
				appearance: lookById('ginger').appearance,
				look: 'ginger',
				name,
				preset: 'cuddly',
				traits: {
					affection: 5,
					playfulness: 5,
					energy: 5,
					curiosity: 5,
					loyalty: 5,
					independence: 5
				}
			})

		before(async () => {
			friends = (await import('./friends')).createFriendStore(base)
			pets = (await import('./pets')).createPetStore(base)
			await signUp(sam, alex, kai)
			await base.profile.update({ where: { id: alex }, data: { displayName: 'Alex' } })
			await savePet(sam, 'Mochi')
			await savePet(alex, 'Luna')
		})

		after(async () => {
			await deleteUsers(...made)
			await base.$disconnect()
		})

		test('a code is made once, valid, and the same on every read', async () => {
			const code = await friends.codeFor(sam)
			assert.equal(normalizeFriendCode(code), code)
			assert.equal(await friends.codeFor(sam), code)
			assert.equal((await friends.ownerOf(code))?.userId, sam)
		})

		test('a new code replaces the old one, which stops working', async () => {
			const old = await friends.codeFor(alex)
			const fresh = await friends.resetCode(alex)
			assert.notEqual(fresh, old)
			assert.equal(await friends.ownerOf(old), null)
			const owner = await friends.ownerOf(fresh)
			assert.equal(owner?.userId, alex)
			assert.equal(owner?.displayName, 'Alex')
			assert.equal(owner?.pet?.name, 'Luna')
		})

		test('an add is mutual, and a retry or the other way round finds the same friendship', async () => {
			const added = await friends.add(sam, alex)
			assert.equal(added.outcome, 'added')
			assert.ok(added.outcome === 'added')
			assert.equal(added.friendCount, 1)
			assert.equal(added.friend.displayName, 'Alex')
			assert.equal(added.friend.pet?.name, 'Luna')

			const retry = await friends.add(sam, alex)
			assert.equal(retry.outcome, 'existing')
			const reverse = await friends.add(alex, sam)
			assert.equal(reverse.outcome, 'existing')
			assert.ok(reverse.outcome === 'existing')
			assert.equal(reverse.friend.id, added.friend.id)
			assert.equal(reverse.friend.pet?.name, 'Mochi')
			assert.equal(reverse.friend.displayName, null)

			const [samsList, alexsList] = await Promise.all([friends.list(sam), friends.list(alex)])
			assert.deepEqual(
				samsList.map((f) => f.id),
				[added.friend.id]
			)
			assert.deepEqual(
				alexsList.map((f) => f.id),
				[added.friend.id]
			)
		})

		test('a stranger cannot remove a friendship; one of the two removes it for both', async () => {
			const [friendship] = await friends.list(sam)
			assert.ok(friendship)
			assert.deepEqual(await friends.remove(kai, friendship.id), { removed: false })
			assert.equal((await friends.list(alex)).length, 1)

			assert.deepEqual(await friends.remove(alex, friendship.id), { removed: true })
			assert.equal((await friends.list(sam)).length, 0)
			assert.deepEqual(await friends.remove(alex, friendship.id), { removed: false })
		})

		test('the cap holds on either side', async () => {
			const crowd = Array.from({ length: FRIENDS_MAX }, () => randomUUID())
			await signUp(...crowd)
			await base.friendship.createMany({
				data: crowd.map((id) =>
					kai < id ? { userLow: kai, userHigh: id } : { userLow: id, userHigh: kai }
				)
			})
			assert.equal(await friends.count(kai), FRIENDS_MAX)
			assert.deepEqual(await friends.add(kai, sam), { outcome: 'self_full' })
			assert.deepEqual(await friends.add(sam, kai), { outcome: 'friend_full' })
			assert.equal(await friends.count(sam), 0)
		})

		test('deleting an account deletes its code and its friendships', async () => {
			const who = randomUUID()
			await signUp(who)
			const code = await friends.codeFor(who)
			const added = await friends.add(sam, who)
			assert.equal(added.outcome, 'added')
			await deleteUsers(who)
			assert.equal(await friends.ownerOf(code), null)
			assert.equal((await friends.list(sam)).length, 0)
		})
	}
)
