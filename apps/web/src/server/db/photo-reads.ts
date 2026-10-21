import type { PrismaClient } from '@prisma/client'
import type { PhotoLimit, PhotoMiss } from '@app/contract'
import { db } from './client'

// The photo reads, counted for the limits (prisma/schema/photo.prisma; v2-pet-from-photo-
// requirements.md, R19–R22). Holds hashes and counts only, never a photo.

export type PhotoContext = 'create' | 'redo'
/** How a counted read ended. `pending` while the model is asked. */
export type PhotoReadOutcome = 'pending' | 'read' | PhotoMiss

/**
 * What one read is counted against. Hashes are made by the caller (`src/server/photo/read-photo.ts`,
 * with `keyedHash` from `hash.ts`).
 */
export type PhotoReadClaim =
	| {
			context: 'create'
			deviceHash: string
			ipHash: string
			/** Set when someone signed in creates a pet; the limit is still the phone's. */
			userId: string | null
			/** YYYY-MM-DD, UTC. */
			day: string
	  }
	| {
			context: 'redo'
			ipHash: string
			userId: string
			/** YYYY-MM-DD in the phone's time zone. */
			day: string
	  }

export type PhotoLimits = {
	/** Reads per phone while creating, ever. */
	perDevice: number
	/** Reads per network per UTC day while creating. */
	perNetwork: number
	/** Redos per account per local day. */
	perAccountDay: number
	/** Reads per UTC day for the whole app. */
	perAppDay: number
}

export type ReserveResult =
	| { kind: 'reserved'; id: string; left: number }
	| { kind: 'limit'; limit: PhotoLimit; left: number }

/**
 * A pending read older than this was abandoned (the server stopped mid-read): it no longer
 * counts, so a crash never costs someone a try.
 */
const PENDING_EXPIRES_MS = 2 * 60 * 1000

/** One lock for every reservation: the app-wide count must be exact, and a reservation is quick. */
const LOCK = 'pet_photo_reads'

export function createPhotoReadStore(client: PrismaClient) {
	return {
		/**
		 * Reserves one read, or names the limit it would pass. Inside one transaction holding the
		 * photo lock, so two reads at once can't both take the last try (R20). A pending read
		 * counts like a finished one until it is settled or released.
		 */
		async reserve(
			claim: PhotoReadClaim,
			limits: PhotoLimits,
			now = new Date()
		): Promise<ReserveResult> {
			const dayStart = new Date(`${utcDay(now)}T00:00:00Z`)
			const counted = {
				OR: [
					{ outcome: { not: 'pending' } },
					{ createdAt: { gt: new Date(now.getTime() - PENDING_EXPIRES_MS) } }
				]
			}
			return client.$transaction(async (tx) => {
				await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${LOCK}))`

				let left: number
				if (claim.context === 'create') {
					const used = await tx.petPhotoRead.count({
						where: { context: 'create', deviceHash: claim.deviceHash, ...counted }
					})
					left = limits.perDevice - used
					if (left <= 0) return { kind: 'limit', limit: 'device', left: 0 }
					const network = await tx.petPhotoRead.count({
						where: {
							context: 'create',
							ipHash: claim.ipHash,
							createdAt: { gte: dayStart },
							...counted
						}
					})
					if (network >= limits.perNetwork) return { kind: 'limit', limit: 'network', left }
				} else {
					const used = await tx.petPhotoRead.count({
						where: {
							context: 'redo',
							userId: claim.userId,
							localDay: new Date(`${claim.day}T00:00:00Z`),
							...counted
						}
					})
					left = limits.perAccountDay - used
					if (left <= 0) return { kind: 'limit', limit: 'today', left: 0 }
				}

				const app = await tx.petPhotoRead.count({
					where: { createdAt: { gte: dayStart }, ...counted }
				})
				if (app >= limits.perAppDay) return { kind: 'limit', limit: 'app', left }

				const row = await tx.petPhotoRead.create({
					data: {
						context: claim.context,
						deviceHash: claim.context === 'create' ? claim.deviceHash : null,
						ipHash: claim.ipHash,
						userId: claim.userId,
						localDay: new Date(`${claim.day}T00:00:00Z`),
						outcome: 'pending',
						createdAt: now
					},
					select: { id: true }
				})
				return { kind: 'reserved', id: row.id, left: left - 1 }
			})
		},

		/** The model answered: the read stays counted, with what it found. */
		async settle(id: string, outcome: Exclude<PhotoReadOutcome, 'pending'>): Promise<void> {
			await client.petPhotoRead.update({ where: { id }, data: { outcome } })
		},

		/** Our side failed (a bad image, the model unreachable): the read never counts (R17). */
		async release(id: string): Promise<void> {
			await client.petPhotoRead.deleteMany({ where: { id } })
		}
	}
}

export type PhotoReadStore = ReturnType<typeof createPhotoReadStore>

export const photoReadStore = createPhotoReadStore(db)

/** YYYY-MM-DD, in UTC. */
export function utcDay(at: Date): string {
	return at.toISOString().slice(0, 10)
}
