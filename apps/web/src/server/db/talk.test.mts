import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, describe, test } from 'node:test'
import { PrismaClient } from '@prisma/client'
import { lookById, TALK_DAILY_CAP, TALK_EFFECTS, type Intent } from '@app/contract'

// The talk store, against a real database (m6-talk-requirements.md, R7–R12): a reply counts once
// and moves the needs by its intent; a retry changes nothing; a full day is refused; the caps
// hold across a day and reset the next; the first reply is marked; the rows go with the pet, and
// usage history outlives the account.
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
const ZONE = 'Europe/Istanbul'
const DAY = '2026-10-01'
const NOW = new Date('2026-10-01T12:00:00Z')

describe(
	'the talk store, on a real database',
	{ skip: url ? false : 'TEST_DATABASE_URL is not set' },
	() => {
		const base = new PrismaClient({ datasourceUrl: url })
		let talk: import('./talk').TalkStore
		let usage: import('./ai-usage').AiUsageStore
		let pets: import('./pets').PetStore

		const signUp = async () => {
			const id = randomUUID()
			await base.$executeRaw`insert into auth.users (id, email) values (${id}::uuid, ${`${id}@example.test`})`
			await pets.create(id, {
				id: randomUUID(),
				appearance: lookById('ginger').appearance,
				look: 'ginger',
				name: 'Mochi',
				preset: 'cuddly',
				traits: TRAITS
			})
			// Middling needs, stored at NOW, so nothing decays and every change is the intent's.
			await base.$executeRaw`
				update public.pet_needs n set happiness = 50, affection = 50, updated_at = ${NOW}
				from public.pets p where p.id = n.pet_id and p.user_id = ${id}::uuid`
			return id
		}
		const users: string[] = []
		const person = async () => {
			const id = await signUp()
			users.push(id)
			return id
		}
		const say = (
			userId: string,
			intent: Intent,
			overrides: Partial<import('./talk').NewTalk> = {}
		) =>
			talk.apply(userId, {
				messageId: randomUUID(),
				intent,
				input: 'typed',
				timeZone: ZONE,
				day: DAY,
				dailyLimit: 10,
				now: NOW,
				...overrides
			})

		before(async () => {
			// Loaded here: they import server-only modules, which resolve only under the
			// react-server condition `npm run test:db` sets.
			talk = (await import('./talk')).createTalkStore(base)
			usage = (await import('./ai-usage')).createAiUsageStore(base)
			pets = (await import('./pets')).createPetStore(base)
		})

		after(async () => {
			await base.$executeRaw`delete from auth.users where id = any(${users}::uuid[])`
			await base.$disconnect()
		})

		test('a reply counts once, moves the needs by its intent, and is the first', async () => {
			const sam = await person()
			const applied = await say(sam, 'kind')
			assert.equal(applied?.outcome, 'replied')
			assert.deepEqual(applied?.added, TALK_EFFECTS.kind)
			assert.equal(applied?.row.needs?.happiness, 50 + TALK_EFFECTS.kind.happiness)
			assert.equal(applied?.row.needs?.affection, 50 + TALK_EFFECTS.kind.affection)
			assert.equal(applied?.countedToday, 1)
			assert.equal(applied?.first, true)

			const second = await say(sam, 'neutral')
			assert.equal(second?.first, false)
			assert.equal(second?.countedToday, 2)
		})

		test('a retry of a counted message changes nothing and counts nothing', async () => {
			const sam = await person()
			const messageId = randomUUID()
			const first = await say(sam, 'affectionate', { messageId })
			const retry = await say(sam, 'affectionate', { messageId })
			assert.equal(retry?.outcome, 'retried')
			assert.deepEqual(retry?.added, { happiness: 0, affection: 0 })
			assert.equal(retry?.countedToday, 1)
			assert.deepEqual(retry?.row.needs?.affection, first?.row.needs?.affection)

			const status = await talk.status(sam, messageId, DAY)
			assert.equal(status?.alreadyCounted, true)
			assert.equal(status?.counted, 1)
		})

		test('a full day is refused without a change, and the next day is a new one', async () => {
			const sam = await person()
			await say(sam, 'neutral', { dailyLimit: 2 })
			await say(sam, 'neutral', { dailyLimit: 2 })
			const third = await say(sam, 'neutral', { dailyLimit: 2 })
			assert.equal(third?.outcome, 'limit_reached')
			assert.equal(third?.countedToday, 2)

			const tomorrow = await say(sam, 'neutral', { dailyLimit: 2, day: '2026-10-02' })
			assert.equal(tomorrow?.outcome, 'replied')
			assert.equal(tomorrow?.countedToday, 1)
		})

		test('Plus has no daily limit', async () => {
			const sam = await person()
			for (let i = 0; i < 12; i++) await say(sam, 'neutral', { dailyLimit: null })
			const status = await talk.status(sam, randomUUID(), DAY)
			assert.equal(status?.counted, 12)
		})

		test('the caps hold across the day; a harsh word makes no room for more', async () => {
			const sam = await person()
			await say(sam, 'harsh')
			// Affectionate adds happiness 3 and affection 6: nine replies reach both caps (25, 30).
			for (let i = 0; i < 9; i++) await say(sam, 'affectionate', { dailyLimit: null })
			const status = await talk.status(sam, randomUUID(), DAY)
			assert.deepEqual(status?.gained, TALK_DAILY_CAP)
		})

		test("the voice's reads: a counted reply in the window, and the day's voices (v2 voice)", async () => {
			const sam = await person()
			const kim = await person()
			const messageId = randomUUID()
			await say(sam, 'playful', { messageId })
			const { createdAt } = await base.petTalk.findUniqueOrThrow({ where: { messageId } })
			const before = new Date(createdAt.getTime() - 1_000)
			assert.deepEqual(await talk.countedReply(sam, messageId, before), {
				intent: 'playful',
				species: 'cat',
				preset: 'cuddly'
			})
			assert.equal(await talk.countedReply(kim, messageId, before), null, 'not your reply')
			assert.equal(
				await talk.countedReply(sam, messageId, new Date(createdAt.getTime() + 1_000)),
				null,
				'too old'
			)
			assert.equal(await talk.countedReply(sam, randomUUID(), before), null, 'never counted')

			const since = new Date()
			const voice = (userId: string, outcome: 'replied' | 'unavailable') =>
				usage.record({
					userId,
					provider: 'fal',
					model: 'minimax/speech-2.8-turbo',
					inputTokens: 40,
					outputTokens: null,
					latencyMs: 900,
					outcome,
					intent: 'playful',
					purpose: 'voice'
				})
			const allBefore = await usage.countSince('voice', since)
			await voice(sam, 'replied')
			await voice(sam, 'unavailable')
			await voice(kim, 'replied')
			assert.equal(await usage.countSince('voice', since, sam), 1, 'only voices made count')
			assert.equal((await usage.countSince('voice', since)) - allBefore, 2)
			assert.equal(await usage.countSince('talk', since, sam), 0, 'by purpose')
		})

		test("only the person's own pet: no pet, no count", async () => {
			const stranger = randomUUID()
			assert.equal(await talk.status(stranger, randomUUID(), DAY), null)
			assert.equal(await say(stranger, 'kind'), null)
		})

		test('the counted replies go with the pet; usage outlives the account', async () => {
			const sam = await signUp()
			await say(sam, 'kind')
			await usage.record({
				userId: sam,
				provider: 'stub',
				model: 'stub',
				inputTokens: null,
				outputTokens: null,
				latencyMs: 0,
				outcome: 'replied',
				intent: 'kind'
			})
			const petId = (await base.pet.findUniqueOrThrow({ where: { userId: sam } })).id
			await base.$executeRaw`delete from auth.users where id = ${sam}::uuid`

			assert.equal(await base.petTalk.count({ where: { petId } }), 0)
			const rows = await base.aiUsage.findMany({ where: { provider: 'stub', userId: null } })
			assert.ok(rows.length >= 1)
		})
	}
)
