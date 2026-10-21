import type { PetMemory, Prisma, PrismaClient } from '@prisma/client'
import {
	addDays,
	EVENT_KEEP_DAYS,
	isDue,
	isExpired,
	memoriesToEvict,
	memoryCategorySchema,
	memoryKindSchema,
	normaliseFact,
	pickMemories,
	type MemoryCategory,
	type MemoryKind,
	type MemorySource,
	type NewMemory
} from '@app/contract'
import { db } from './client'

// The pet's long-term memory (prisma/schema/memory.prisma: pet_memories), for the talk route, the
// intro and the memory routes (docs/application/features/v2-memory-requirements.md). Every method
// takes the user id the route verified, never one from the request, and reaches the facts through
// that person's pet. What a fact may be is decided before it gets here (`checkFact` in
// @app/contract); this store decides what is kept: no duplicates, events gone 14 days after their
// day, and the cap, by the shared score.

export type MemoryRecord = {
	id: string
	text: string
	followUp: string | null
	category: MemoryCategory
	kind: MemoryKind
	importance: number
	tags: string[]
	/** YYYY-MM-DD, events only. */
	followUpOn: string | null
	followedUpAt: Date | null
	source: MemorySource
	lastUsedAt: Date | null
	createdAt: Date
}

/** Where a page starts: after this fact, in newest-first order (`createdAt`, then `id`). */
export type MemoryCursor = { createdAt: Date; id: string }

export type MemoryPageQuery = {
	/** YYYY-MM-DD in the person's time zone: expired events are left out (R7). */
	today: string
	/** Words to look for in the fact or its tags; empty or absent is no search. */
	search?: string
	cursor?: MemoryCursor
	/** At most MEMORY_PAGE_MAX: the route bounds it. */
	limit: number
}

export type MemoryPage = {
	memories: MemoryRecord[]
	/** Everything the pet remembers. */
	total: number
	/** What the search found; `total` with no search. */
	matched: number
	/** The next page's start, or null at the end. */
	next: MemoryCursor | null
}

/** What a talk reply or the intro asks to keep: a new fact, or a new version of one shown. */
export type MemoryChange =
	{ action: 'add'; fact: NewMemory } | { action: 'replace'; id: string; fact: NewMemory }

export type SaveOptions = {
	/** MEMORY_CAP_FREE or MEMORY_CAP_PLUS, from the server's premium check (R5). */
	cap: number
	source: MemorySource
	/** YYYY-MM-DD in the person's time zone. */
	today: string
	now?: Date
}

/**
 * - `saved`: kept (added, or the shown fact replaced).
 * - `duplicate`: the pet already remembers exactly this (R6); nothing changed.
 * - `no_pet`: the person has no pet.
 */
export type SaveResult =
	| { kind: 'saved'; memory: MemoryRecord; replaced: boolean }
	| { kind: 'duplicate' }
	| { kind: 'no_pet' }

type Reader = PrismaClient | Prisma.TransactionClient

/**
 * Words to find as they are: Prisma's `contains` puts them inside a LIKE pattern without
 * escaping, so "%" would match every fact and "_" any letter (found by the database suite).
 */
const likeLiteral = (words: string) => words.replace(/[\\%_]/g, '\\$&')

/** A date column holds the day itself; Prisma passes it as midnight UTC. */
const asDate = (day: string) => new Date(`${day}T00:00:00.000Z`)
const asDay = (date: Date) => date.toISOString().slice(0, 10)

export function toRecord(row: PetMemory): MemoryRecord {
	return {
		id: row.id,
		text: row.text,
		followUp: row.followUp,
		// Only this store writes these, from the contract's lists; an unknown value is a list that
		// lost an entry, read as the neutral one rather than failing the person's whole memory.
		category: memoryCategorySchema.safeParse(row.category).data ?? 'other',
		kind: memoryKindSchema.safeParse(row.kind).data ?? 'lasting',
		importance: row.importance,
		tags: row.tags,
		followUpOn: row.followUpOn ? asDay(row.followUpOn) : null,
		followedUpAt: row.followedUpAt,
		source: row.source === 'intro' ? 'intro' : 'talk',
		lastUsedAt: row.lastUsedAt,
		createdAt: row.createdAt
	}
}

function factData(fact: NewMemory) {
	return {
		text: fact.text,
		followUp: fact.followUp,
		category: fact.category,
		kind: fact.kind,
		importance: fact.importance,
		tags: fact.tags,
		followUpOn: fact.followUpOn ? asDate(fact.followUpOn) : null
	}
}

/** The person's facts, expired events left out. */
async function factsOf(reader: Reader, userId: string, today: string): Promise<MemoryRecord[]> {
	const rows = await reader.petMemory.findMany({
		where: { pet: { userId } },
		orderBy: { createdAt: 'desc' }
	})
	return rows.map(toRecord).filter((fact) => !isExpired(fact, today))
}

/**
 * Keeps a fact (R5–R8, R12) inside the caller's transaction, holding this pet's memory lock, so two
 * replies at once can't both take the last place:
 *
 *   1. events more than 14 days past their day are deleted (R7)
 *   2. a replace of a fact this pet has updates it in place (and asks about it afresh); a replace
 *      of anything else is an add
 *   3. an add the pet already remembers, by normalised text, changes nothing (R6)
 *   4. past the cap, the lowest-worth facts go first (R5, R8), then the new one is added
 *
 * `petId` must be the verified caller's pet. The intro calls it once per fact in one transaction.
 */
export async function keepFact(
	tx: Prisma.TransactionClient,
	petId: string,
	change: MemoryChange,
	{ cap, source, today, now = new Date() }: SaveOptions
): Promise<Exclude<SaveResult, { kind: 'no_pet' }>> {
	await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`pet_memories:${petId}`}))`

	const all = (
		await tx.petMemory.findMany({ where: { petId }, orderBy: { createdAt: 'desc' } })
	).map(toRecord)
	const expired = all.filter((fact) => isExpired(fact, today))
	if (expired.length > 0) {
		await tx.petMemory.deleteMany({ where: { id: { in: expired.map((fact) => fact.id) } } })
	}
	const facts = all.filter((fact) => !isExpired(fact, today))

	const target =
		change.action === 'replace' ? facts.find((fact) => fact.id === change.id) : undefined
	const text = normaliseFact(change.fact.text)
	const twin = facts.find((fact) => fact.id !== target?.id && normaliseFact(fact.text) === text)

	if (target) {
		// The new version says what another fact already does: keep that one, drop this.
		if (twin) {
			await tx.petMemory.delete({ where: { id: target.id } })
			return { kind: 'duplicate' }
		}
		const row = await tx.petMemory.update({
			where: { id: target.id },
			data: { ...factData(change.fact), source, followedUpAt: null, updatedAt: now }
		})
		return { kind: 'saved', memory: toRecord(row), replaced: true }
	}
	if (twin) return { kind: 'duplicate' }

	const evict = memoriesToEvict(facts, cap, 1, today, now)
	if (evict.length > 0) {
		await tx.petMemory.deleteMany({ where: { id: { in: evict.map((fact) => fact.id) } } })
	}
	const row = await tx.petMemory.create({
		data: { ...factData(change.fact), petId, source, createdAt: now, updatedAt: now }
	})
	return { kind: 'saved', memory: toRecord(row), replaced: false }
}

export function createMemoryStore(client: PrismaClient) {
	return {
		/** "Mochi remembers…" (R16): the person's facts, newest first. Throws on a database error. */
		async list(userId: string, today: string): Promise<MemoryRecord[]> {
			return factsOf(client, userId, today)
		},

		/**
		 * One page of the person's facts, newest first (R16), with the counts the screen shows.
		 * Everything is scoped to the caller's pet in SQL. The search is the fact's words, any
		 * case, or one of its tags exactly. Pages are a keyset on (created_at, id), so a fact
		 * deleted between pages never makes the next skip or repeat one. The page and both counts
		 * are read in one transaction, so they agree. With the cap at 100 facts a pet, even the
		 * full list is small.
		 */
		async page(
			userId: string,
			{ today, search, cursor, limit }: MemoryPageQuery
		): Promise<MemoryPage> {
			// Not expired (R7): lasting facts, and events up to EVENT_KEEP_DAYS past their day.
			const kept: Prisma.PetMemoryWhereInput = {
				pet: { userId },
				OR: [
					{ kind: { not: 'event' } },
					{ followUpOn: null },
					{ followUpOn: { gte: asDate(addDays(today, -EVENT_KEEP_DAYS)) } }
				]
			}
			const words = search?.trim()
			const found: Prisma.PetMemoryWhereInput = words
				? {
						AND: [
							kept,
							{
								OR: [
									{ text: { contains: likeLiteral(words), mode: 'insensitive' } },
									{ tags: { has: words.toLowerCase() } }
								]
							}
						]
					}
				: kept
			const after: Prisma.PetMemoryWhereInput = cursor
				? {
						OR: [
							{ createdAt: { lt: cursor.createdAt } },
							{ createdAt: cursor.createdAt, id: { lt: cursor.id } }
						]
					}
				: {}
			const [rows, total, matched] = await client.$transaction([
				client.petMemory.findMany({
					where: { AND: [found, after] },
					orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
					take: limit + 1
				}),
				client.petMemory.count({ where: kept }),
				words ? client.petMemory.count({ where: found }) : client.petMemory.count({ where: kept })
			])
			const memories = rows.slice(0, limit).map(toRecord)
			const last = memories.at(-1)
			return {
				memories,
				total,
				matched,
				next: rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null
			}
		},

		/**
		 * The facts for this message (R9), best first, at most MEMORY_IN_PROMPT, each marked used
		 * now. The records come back as they were before the mark. Empty without a pet.
		 */
		async pick(
			userId: string,
			said: string,
			today: string,
			now: Date = new Date()
		): Promise<MemoryRecord[]> {
			const picked = pickMemories(await factsOf(client, userId, today), said, today, now)
			if (picked.length > 0) {
				await client.petMemory.updateMany({
					where: { id: { in: picked.map((fact) => fact.id) }, pet: { userId } },
					data: { lastUsedAt: now }
				})
			}
			return picked
		},

		/** Keeps a fact (R5–R8, R12) in a transaction of its own: see `keepFact`. */
		async save(userId: string, change: MemoryChange, options: SaveOptions): Promise<SaveResult> {
			return client.$transaction(async (tx) => {
				const pet = await tx.pet.findUnique({ where: { userId }, select: { id: true } })
				if (!pet) return { kind: 'no_pet' }
				return keepFact(tx, pet.id, change, options)
			})
		},

		/** Deletes one of this person's facts (R17). False when they have none with this id. */
		async remove(userId: string, id: string): Promise<boolean> {
			const { count } = await client.petMemory.deleteMany({ where: { id, pet: { userId } } })
			return count > 0
		},

		/**
		 * The due event to ask about on return (R27): the most important, then the oldest day. Only
		 * one with a question to ask: the greeting has nothing to say about one without.
		 */
		async due(userId: string, today: string): Promise<MemoryRecord | null> {
			const due = (await factsOf(client, userId, today)).filter(
				(fact) => isDue(fact, today) && fact.followUp !== null
			)
			due.sort((a, b) => b.importance - a.importance || a.followUpOn!.localeCompare(b.followUpOn!))
			return due[0] ?? null
		},

		/** Marks an event asked about (R27). False when this person has no fact with this id. */
		async markFollowedUp(userId: string, id: string, now: Date = new Date()): Promise<boolean> {
			const { count } = await client.petMemory.updateMany({
				where: { id, pet: { userId }, followedUpAt: null },
				data: { followedUpAt: now, updatedAt: now }
			})
			return count > 0
		}
	}
}

export type MemoryStore = ReturnType<typeof createMemoryStore>

export const memoryStore = createMemoryStore(db)
