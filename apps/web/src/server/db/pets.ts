import type { Pet, PetNeeds, Prisma, PrismaClient } from '@prisma/client'
import {
	applyAction,
	decayNeeds,
	STARTING_NEEDS,
	type LookId,
	type Needs,
	type PetAction,
	type PetAppearance,
	type PresetId,
	type Traits
} from '@app/contract'
import { db } from './client'

// The person's pet and its needs (prisma/schema/pets.prisma: pets and pet_needs), for
// /api/app/v1/pet, /pet/actions and /pet/talk. One pet per account in v1, one needs row per pet.
// Every method takes the user id the route verified (requireUser), never one from the request,
// and scopes every query by it. Validation against the catalog (appearance, look, preset, traits)
// and whether it needs Plus are the route's, through the contract; this store trusts what it is
// given.

export type PetRecord = Pick<
	Pet,
	| 'id'
	| 'species'
	| 'fur'
	| 'pattern'
	| 'eyes'
	| 'ears'
	| 'body'
	| 'tail'
	| 'accent'
	| 'white'
	| 'trim'
	| 'look'
	| 'name'
	| 'preset'
	| 'affection'
	| 'playfulness'
	| 'energy'
	| 'curiosity'
	| 'loyalty'
	| 'independence'
	| 'createdAt'
	| 'updatedAt'
> & {
	/** Null only for a pet saved before pet_needs existed and not yet backfilled. */
	needs: Pick<PetNeeds, 'hunger' | 'happiness' | 'energy' | 'affection' | 'updatedAt'> | null
}

export type NewPet = {
	/** Generated on the phone, so a retry of the same save finds its row. */
	id: string
	appearance: PetAppearance
	/** The ready-made look it is exactly, or null for a pet built or customized. */
	look: LookId | null
	name: string
	preset: PresetId
	traits: Traits
}

/**
 * What a save did:
 * - `created`: the pet is new.
 * - `retried`: this id was already saved by this person (the phone lost the first answer).
 * - `existing`: this person already has a different pet; nothing was written, and that pet
 *   wins (product.md, "The pet").
 * - `conflict`: the id is someone else's pet.
 */
export type CreatePetResult =
	{ outcome: 'created' | 'retried' | 'existing'; row: PetRecord } | { outcome: 'conflict' }

const PET = {
	id: true,
	species: true,
	fur: true,
	pattern: true,
	eyes: true,
	ears: true,
	body: true,
	tail: true,
	accent: true,
	white: true,
	trim: true,
	look: true,
	name: true,
	preset: true,
	affection: true,
	playfulness: true,
	energy: true,
	curiosity: true,
	loyalty: true,
	independence: true,
	createdAt: true,
	updatedAt: true,
	needs: {
		select: { hunger: true, happiness: true, energy: true, affection: true, updatedAt: true }
	}
} as const

/** What a pet read selects, for a store that reads someone's pet as a `PetRecord` (friends). */
export const PET_SELECT = PET

/**
 * A pet's stored needs and when they were stored, as the shared needs logic takes them. A pet
 * with no needs row yet (saved before pet_needs, not backfilled) reads as the starting needs,
 * stored just now, so it shows no decay; its first care action creates the row.
 */
export function needsOf(row: PetRecord): { needs: Needs; storedAt: Date } {
	if (!row.needs) return { needs: { ...STARTING_NEEDS }, storedAt: new Date() }
	const { hunger, happiness, energy, affection, updatedAt } = row.needs
	return { needs: { hunger, happiness, energy, affection }, storedAt: updatedAt }
}

/**
 * What a change does with the needs, inside the lock: given them decayed to now, the needs to
 * store and anything it wants to report. It runs in the same transaction (`tx`), so whatever else
 * it reads or writes is serialised with every other change to this pet's needs.
 */
export type NeedsChange<T> = (
	current: Needs,
	petId: string,
	tx: Prisma.TransactionClient
) => Promise<{ needs: Needs; result: T }>

/**
 * The one way the needs change (Feed, Play and Pet; a talk reply): lock the person's needs row,
 * decay it to `now` in their time zone, let `change` decide, store the result stamped `now`, and
 * read the pet back. Only the needs row is locked, for the read and the write, so two quick
 * changes are applied one after the other and neither is lost, and the pet's identity row is
 * never held. A missing needs row is created first, at the starting needs. Null when the person
 * has no pet. The time zone is the route's to validate.
 */
export async function changeNeeds<T>(
	client: PrismaClient,
	userId: string,
	timeZone: string,
	now: Date,
	change: NeedsChange<T>
): Promise<{ row: PetRecord; result: T } | null> {
	return client.$transaction(async (tx) => {
		await tx.$executeRaw`
			insert into public.pet_needs (pet_id)
			select id from public.pets where user_id = ${userId}::uuid
			on conflict (pet_id) do nothing`
		const [stored] = await tx.$queryRaw<
			(Pick<PetNeeds, 'hunger' | 'happiness' | 'energy' | 'affection'> & {
				pet_id: string
				updated_at: Date
			})[]
		>`
			select n.pet_id, n.hunger, n.happiness, n.energy, n.affection, n.updated_at
			from public.pet_needs n
			join public.pets p on p.id = n.pet_id
			where p.user_id = ${userId}::uuid
			for update of n`
		if (!stored) return null
		const { needs, result } = await change(
			decayNeeds(stored, stored.updated_at, now, timeZone),
			stored.pet_id,
			tx
		)
		await tx.petNeeds.update({
			where: { petId: stored.pet_id },
			data: { ...needs, updatedAt: now }
		})
		const row = await tx.pet.findUniqueOrThrow({ where: { userId }, select: PET })
		return { row, result }
	})
}

export function createPetStore(client: PrismaClient) {
	return {
		/** The person's pet, or null when they have none. Throws on a database error. */
		async get(userId: string): Promise<PetRecord | null> {
			return client.pet.findUnique({ where: { userId }, select: PET })
		},

		/**
		 * Feed, Play or Pet (M5): the action applied to the needs decayed to now, under the needs
		 * lock (`changeNeeds`). `changed` is false when the action can't help; the decayed needs
		 * are still stored. Null when the person has no pet.
		 */
		async act(
			userId: string,
			action: PetAction,
			timeZone: string,
			now: Date = new Date()
		): Promise<{ row: PetRecord; changed: boolean } | null> {
			const applied = await changeNeeds(client, userId, timeZone, now, async (current) => {
				const { needs, changed } = applyAction(current, action)
				return { needs, result: changed }
			})
			return applied && { row: applied.row, changed: applied.result }
		},

		/**
		 * Inserts unless the id or the owner already has a row (ON CONFLICT DO NOTHING, so a race
		 * between two tries is decided by one statement), gives the pet its needs row at the
		 * starting needs (again ON CONFLICT DO NOTHING, so a retry keeps the first one), then reads
		 * back what is there.
		 */
		async create(userId: string, input: NewPet): Promise<CreatePetResult> {
			const { count } = await client.pet.createMany({
				data: [
					{
						id: input.id,
						userId,
						...input.appearance,
						look: input.look,
						name: input.name,
						preset: input.preset,
						...input.traits
					}
				],
				skipDuplicates: true
			})
			const owner = await client.pet.findUnique({
				where: { id: input.id },
				select: { userId: true }
			})
			if (owner) {
				if (owner.userId !== userId) return { outcome: 'conflict' }
				await client.petNeeds.createMany({ data: [{ petId: input.id }], skipDuplicates: true })
				const row = await client.pet.findUniqueOrThrow({ where: { id: input.id }, select: PET })
				return { outcome: count === 1 ? 'created' : 'retried', row }
			}
			// Nothing with this id: the insert was skipped because this person already has a pet.
			const mine = await client.pet.findUnique({ where: { userId }, select: PET })
			return mine ? { outcome: 'existing', row: mine } : { outcome: 'conflict' }
		},

		/**
		 * Change look (M7): the person's pet gets a new appearance and the ready-made look it now
		 * is, or null. The species and nine attributes are written by name, never the needs, so
		 * this takes no needs lock. The species changes only when the route allowed it (Plus, from
		 * a photo: v2-pet-from-photo-requirements.md, R28). Null when the person has no pet.
		 */
		async updateAppearance(
			userId: string,
			appearance: PetAppearance,
			look: string | null
		): Promise<PetRecord | null> {
			const { species, fur, pattern, eyes, ears, body, tail, accent, white, trim } = appearance
			const { count } = await client.pet.updateMany({
				where: { userId },
				data: {
					species,
					fur,
					pattern,
					eyes,
					ears,
					body,
					tail,
					accent,
					white,
					trim,
					look,
					updatedAt: new Date()
				}
			})
			if (count === 0) return null
			return client.pet.findUniqueOrThrow({ where: { userId }, select: PET })
		}
	}
}

export type PetStore = ReturnType<typeof createPetStore>

export const petStore = createPetStore(db)
