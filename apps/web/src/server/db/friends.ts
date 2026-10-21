import { randomInt } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { FRIEND_CODE_ALPHABET, FRIEND_CODE_LENGTH, FRIENDS_MAX } from '@app/contract'
import { db } from './client'
import { PET_SELECT, type PetRecord } from './pets'

// Friends (prisma/schema/friends.prisma: friend_codes and friendships), for /api/app/v1/friends
// (docs/application/features/v2-friends-requirements.md). Every method takes the user id the
// route verified, never one from the request. A friend is only ever read through a friendship
// the caller is in. What a friend may see is the wire's to cut down (server/api/friend-wire.ts):
// this store reads the friend's pet as a whole `PetRecord`.

/** A friend as the store reads them: the friendship, the other person's name and their pet. */
export type FriendRecord = {
	/** The friendship's id, never the friend's user id. */
	id: string
	createdAt: Date
	displayName: string | null
	pet: PetRecord | null
}

/** Who a code belongs to: their user id (for the add) and what the preview shows. */
export type CodeOwner = { userId: string; displayName: string | null; pet: PetRecord | null }

/**
 * What an add did:
 * - `added`: the two are friends now.
 * - `existing`: they already were; nothing written.
 * - `self_full` / `friend_full`: the caller, or the code's owner, has `FRIENDS_MAX` friends.
 */
export type AddFriendResult =
	| { outcome: 'added' | 'existing'; friend: FriendRecord; friendCount: number }
	| { outcome: 'self_full' }
	| { outcome: 'friend_full' }

/** How many times a new code is drawn when it clashes with one that exists (31⁸ codes). */
const CODE_ATTEMPTS = 5

export function newFriendCode(): string {
	let code = ''
	for (let i = 0; i < FRIEND_CODE_LENGTH; i++) {
		code += FRIEND_CODE_ALPHABET[randomInt(FRIEND_CODE_ALPHABET.length)]
	}
	return code
}

/** Prisma's unique-constraint error (P2002), told by its code: only types come from Prisma here. */
function isUniqueViolation(error: unknown): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

/** A pair in the order it is stored: `user_low` < `user_high`. */
function pair(a: string, b: string): { userLow: string; userHigh: string } {
	return a < b ? { userLow: a, userHigh: b } : { userLow: b, userHigh: a }
}

const PERSON = { displayName: true, pet: { select: PET_SELECT } } as const

export function createFriendStore(client: PrismaClient) {
	/** Write a fresh code for the person (create or replace), drawing again on a clash. */
	async function writeCode(userId: string): Promise<string> {
		for (let attempt = 1; ; attempt++) {
			const code = newFriendCode()
			try {
				await client.friendCode.upsert({
					where: { userId },
					create: { userId, code },
					update: { code, createdAt: new Date() }
				})
				return code
			} catch (error) {
				if (!isUniqueViolation(error) || attempt >= CODE_ATTEMPTS) throw error
			}
		}
	}

	async function count(tx: Prisma.TransactionClient, userId: string): Promise<number> {
		return tx.friendship.count({ where: { OR: [{ userLow: userId }, { userHigh: userId }] } })
	}

	async function friendOf(
		tx: Prisma.TransactionClient,
		userId: string,
		friendshipId: string
	): Promise<FriendRecord | null> {
		const row = await tx.friendship.findFirst({
			where: { id: friendshipId, OR: [{ userLow: userId }, { userHigh: userId }] },
			select: {
				id: true,
				createdAt: true,
				userLow: true,
				low: { select: PERSON },
				high: { select: PERSON }
			}
		})
		if (!row) return null
		const other = row.userLow === userId ? row.high : row.low
		return { id: row.id, createdAt: row.createdAt, displayName: other.displayName, pet: other.pet }
	}

	return {
		/** The person's code, made the first time it is asked for (R7). */
		async codeFor(userId: string): Promise<string> {
			const found = await client.friendCode.findUnique({
				where: { userId },
				select: { code: true }
			})
			if (found) return found.code
			try {
				return await writeCode(userId)
			} catch (error) {
				// Two first loads at once: the other one made it.
				if (!isUniqueViolation(error)) throw error
				const made = await client.friendCode.findUniqueOrThrow({
					where: { userId },
					select: { code: true }
				})
				return made.code
			}
		},

		/** A new code; the old one stops working at once (R6). */
		async resetCode(userId: string): Promise<string> {
			return writeCode(userId)
		},

		/** Whose code this is (normalised), or null when no one has it. */
		async ownerOf(code: string): Promise<CodeOwner | null> {
			const row = await client.friendCode.findUnique({
				where: { code },
				select: { userId: true, profile: { select: PERSON } }
			})
			if (!row) return null
			return { userId: row.userId, displayName: row.profile.displayName, pet: row.profile.pet }
		},

		/** The person's friends, newest first. */
		async list(userId: string): Promise<FriendRecord[]> {
			const rows = await client.friendship.findMany({
				where: { OR: [{ userLow: userId }, { userHigh: userId }] },
				orderBy: { createdAt: 'desc' },
				take: FRIENDS_MAX,
				select: {
					id: true,
					createdAt: true,
					userLow: true,
					low: { select: PERSON },
					high: { select: PERSON }
				}
			})
			return rows.map((row) => {
				const other = row.userLow === userId ? row.high : row.low
				return {
					id: row.id,
					createdAt: row.createdAt,
					displayName: other.displayName,
					pet: other.pet
				}
			})
		},

		/**
		 * Make the two friends (R9). Both profiles are locked, in id order, so two adds at once
		 * can't both pass a cap, and a retry finds the row it made. The caller is never `friendId`:
		 * the route refuses its own code first.
		 */
		async add(userId: string, friendId: string): Promise<AddFriendResult> {
			const { userLow, userHigh } = pair(userId, friendId)
			return client.$transaction(async (tx) => {
				await tx.$queryRaw`
					select id from public.profiles
					where id in (${userLow}::uuid, ${userHigh}::uuid)
					order by id
					for update`
				const existing = await tx.friendship.findUnique({
					where: { userLow_userHigh: { userLow, userHigh } },
					select: { id: true }
				})
				if (existing) {
					const friend = await friendOf(tx, userId, existing.id)
					if (friend) return { outcome: 'existing', friend, friendCount: await count(tx, userId) }
				}
				const mine = await count(tx, userId)
				if (mine >= FRIENDS_MAX) return { outcome: 'self_full' }
				if ((await count(tx, friendId)) >= FRIENDS_MAX) return { outcome: 'friend_full' }
				const made = await tx.friendship.create({
					data: { userLow, userHigh },
					select: { id: true }
				})
				const friend = await friendOf(tx, userId, made.id)
				if (!friend) throw new Error('A friendship just made could not be read back.')
				return { outcome: 'added', friend, friendCount: mine + 1 }
			})
		},

		/** How many friends the person has. */
		async count(userId: string): Promise<number> {
			return count(client, userId)
		},

		/**
		 * End a friendship the person is in, for both (R12). `removed` is false when there was
		 * none to remove: already gone, or not theirs.
		 */
		async remove(userId: string, friendshipId: string): Promise<{ removed: boolean }> {
			const { count: removed } = await client.friendship.deleteMany({
				where: { id: friendshipId, OR: [{ userLow: userId }, { userHigh: userId }] }
			})
			return { removed: removed > 0 }
		}
	}
}

export type FriendStore = ReturnType<typeof createFriendStore>

export const friendStore = createFriendStore(db)
