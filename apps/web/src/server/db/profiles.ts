import type { PrismaClient } from '@prisma/client'
import { db, Prisma } from './client'
import { postgrestTime, type PostgrestTimestamp } from './postgrest-time'

// The per-person table (prisma/schema/accounts.prisma). Every read and write of `profiles`
// outside the Play Stats API goes through here; the Play Stats API's own reads are in
// ./play-stats.
//
// Money and entitlement (AGENTS.md, non-negotiable 3): three writers of plan_type and
// premium_*. `applyEntitlement`, whose only caller is the RevenueCat webhook; `grantPremium` and
// `revokeGrant`, whose only callers are the admin users screen's server actions, behind
// requireAdmin(). A grant is `premium_source = 'grant'` (the dashboard's `granted` bucket, never
// revenue), and a revoke undoes only a grant, never a store subscription.
// `recordRegion` writes region, from the lifecycle route; `markSeen` writes last_seen_at, from
// the greeting route (the app's one "opened" moment, so time away is read and moved in one
// step). Both are server routes that verified their caller first; nothing here is reachable from a browser or the
// app. Review a diff to either twice. The one write the app reaches, through PATCH
// /api/app/v1/profile, is `updateOwnSettings`: the person's own display name, avatar, locale
// and marketing consent, by name, and nothing else.
//
// Reads throw on a database error, and a missing row is null: never an error dressed as an
// empty answer (docs/rules/database.md). Writes by id use updateMany, which matches zero
// rows without throwing, as the PostgREST update they replace did: a webhook for an app user
// id with no profile is not an error.

/** The fields of a profile the lifecycle route and its Play Event need. */
export type SessionProfile = {
	region: string | null
	displayName: string | null
	locale: string | null
	marketingConsent: boolean
	planType: string
}

/** The fields of a profile a RevenueCat Play Event is sent with. */
export type PlayEventProfile = Omit<SessionProfile, 'displayName'>

/** The person's own profile, as GET /api/app/v1/profile shows it. */
export type AppProfile = {
	displayName: string | null
	/** A path in the user-uploads bucket, or an absolute URL (src/server/storage/avatars.ts). */
	avatarUrl: string | null
	planType: string
	locale: string | null
	marketingConsent: boolean
	createdAt: Date | null
}

/**
 * What a person may change about their own profile, from PATCH /api/app/v1/profile, and
 * nothing else. Money (see the note at the top): no field here reaches plan_type, premium_*,
 * is_admin, region or last_seen_at, and `updateOwnSettings` copies these four by name, so an
 * object carrying more writes no more. undefined leaves a field as it is; null clears it.
 */
export type OwnSettings = {
	displayName?: string | null
	avatarUrl?: string | null
	locale?: string | null
	marketingConsent?: boolean
}

/** What the RevenueCat webhook writes. Money: see the note at the top. */
export type EntitlementPatch = {
	planType: 'free' | 'premium'
	premiumSource: string | null
	premiumEnvironment: string | null
	premiumStatus: string
	premiumWillRenew: boolean
	premiumExpiresAt: Date | null
	premiumStore?: string | null
	premiumProduct?: string | null
	premiumStartedAt?: Date
}

/** One row of the admin user list: the profile half, joined to auth users by id. */
export type AdminProfileRow = {
	id: string
	plan_type: string
	premium_source: string | null
	premium_environment: string | null
	premium_status: string | null
	is_admin: boolean
	region: string | null
}

/** What an admin's grant did: given, or nothing (already Plus, or no such profile). */
export type GrantOutcome = 'granted' | 'already_premium' | 'no_profile'
/** What an admin's revoke did: taken back, or nothing (not a grant, or no such profile). */
export type RevokeOutcome = 'revoked' | 'not_a_grant' | 'no_profile'

/** A subscription ending soon without renewal (the lifecycle cron). */
export type ExpiringProfile = {
	id: string
	plan_type: string
	locale: string | null
	region: string | null
	marketing_consent: boolean
	premium_expires_at: PostgrestTimestamp
	premium_product: string | null
}

/** Someone not seen since the cutoff (the lifecycle cron). */
export type InactiveProfile = {
	id: string
	plan_type: string
	locale: string | null
	region: string | null
	marketing_consent: boolean
	last_seen_at: PostgrestTimestamp
}

const APP_PROFILE = {
	displayName: true,
	avatarUrl: true,
	planType: true,
	locale: true,
	marketingConsent: true,
	createdAt: true
} as const satisfies Prisma.ProfileSelect

export function createProfileStore(client: PrismaClient) {
	// updateOwnSettings, in one transaction. Money: the four settings are copied by name.
	const writeOwnSettings = (userId: string, settings: OwnSettings) =>
		client.$transaction(async (tx) => {
			await tx.profile.createMany({ data: [{ id: userId }], skipDuplicates: true })
			let consentChanged = false
			if (settings.marketingConsent !== undefined) {
				const { count } = await tx.profile.updateMany({
					where: { id: userId, marketingConsent: !settings.marketingConsent },
					data: { marketingConsent: settings.marketingConsent }
				})
				consentChanged = count > 0
			}
			const profile = await tx.profile.update({
				where: { id: userId },
				data: {
					displayName: settings.displayName,
					avatarUrl: settings.avatarUrl,
					locale: settings.locale
				},
				select: APP_PROFILE
			})
			return { profile, consentChanged }
		})

	return {
		/** Whether this account may use the admin panel. False when there is no profile. */
		async isAdmin(userId: string): Promise<boolean> {
			const row = await client.profile.findUnique({
				where: { id: userId },
				select: { isAdmin: true }
			})
			return row?.isAdmin === true
		},

		async sessionProfile(userId: string): Promise<SessionProfile | null> {
			return client.profile.findUnique({
				where: { id: userId },
				select: {
					region: true,
					displayName: true,
					locale: true,
					marketingConsent: true,
					planType: true
				}
			})
		},

		/**
		 * Sets the person's market. The caller decides it is written once (only while `region` is
		 * empty); this writes what it is told.
		 */
		async recordRegion(userId: string, region: string): Promise<void> {
			await client.profile.updateMany({ where: { id: userId }, data: { region } })
		},

		/**
		 * Stamps the person as seen at `seenAt` and returns when they were seen before (null: never,
		 * or no profile). One statement holding the row, so two opens at once can't both read the
		 * old time: the second sees the first's stamp and gets no time away (R28).
		 */
		async markSeen(userId: string, seenAt: Date): Promise<Date | null> {
			const rows = await client.$queryRaw<{ previous: Date | null }[]>`
				with previous as (
					select last_seen_at from public.profiles where id = ${userId}::uuid for update
				)
				update public.profiles set last_seen_at = ${seenAt}
				from previous
				where id = ${userId}::uuid
				returning previous.last_seen_at as previous`
			return rows[0]?.previous ?? null
		},

		/**
		 * Whether the person has Kinpaw Plus, decided by the server from `plan_type` (AGENTS.md,
		 * non-negotiable 3): only 'premium' is. Read by every route that gives Plus something (a
		 * Plus look, unlimited talking). No profile is not premium.
		 */
		async isPremium(userId: string): Promise<boolean> {
			const row = await client.profile.findUnique({
				where: { id: userId },
				select: { planType: true }
			})
			return row?.planType === 'premium'
		},

		/**
		 * The name the person set on their profile, for the pet to call them by (profile-edit
		 * R16, R18); null when none is set. Its own read, so the entitlement read above stays
		 * exactly as it is.
		 */
		async personName(userId: string): Promise<string | null> {
			const row = await client.profile.findUnique({
				where: { id: userId },
				select: { displayName: true }
			})
			return row?.displayName?.trim() || null
		},

		/** The person's own profile. Null when the signup trigger never made one. */
		async appProfile(userId: string): Promise<AppProfile | null> {
			return client.profile.findUnique({ where: { id: userId }, select: APP_PROFILE })
		},

		/**
		 * Writes the person's own settings, and makes their profile row first if the signup
		 * trigger never did (the app's onboarding upserted it before /api/app/v1 existed).
		 *
		 * Null when the person has no auth user any more: a profile needs one, and the
		 * profiles_require_auth_user trigger refuses the row (20260924000400). That is an account
		 * deleted while its access token was still valid, so nothing is written for it.
		 *
		 * `consentChanged` is true only when this call flipped marketing_consent: the flip is its
		 * own conditional UPDATE, so of two requests toggling it at once, exactly one reports it.
		 */
		async updateOwnSettings(
			userId: string,
			settings: OwnSettings
		): Promise<{ profile: AppProfile; consentChanged: boolean } | null> {
			try {
				return await writeOwnSettings(userId, settings)
			} catch (err) {
				// The trigger raises SQLSTATE 23503, which Prisma reports as the foreign key it
				// stands in for.
				if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
					return null
				}
				throw err
			}
		},

		async playEventProfile(userId: string): Promise<PlayEventProfile | null> {
			return client.profile.findUnique({
				where: { id: userId },
				select: { region: true, locale: true, marketingConsent: true, planType: true }
			})
		},

		/**
		 * Writes a RevenueCat event's entitlement onto the profile whose id is the app user id.
		 * Returns how many profiles it changed: 0 when there is no such profile, which the
		 * webhook answers the same as 1, as it always has.
		 */
		async applyEntitlement(userId: string, patch: EntitlementPatch): Promise<number> {
			const { count } = await client.profile.updateMany({ where: { id: userId }, data: patch })
			return count
		},

		/**
		 * An admin gives Kinpaw Plus (M7): the profile becomes premium with `premium_source =
		 * 'grant'`, and a `premium_grants` row records who, to whom and why, in one transaction.
		 * An account that is already premium (a grant or a store subscription) is left as it is,
		 * decided by the same conditional update that writes it, so two grants at once write one.
		 */
		async grantPremium(
			userId: string,
			adminId: string,
			reason: string | null
		): Promise<GrantOutcome> {
			return client.$transaction(async (tx) => {
				const { count } = await tx.profile.updateMany({
					where: { id: userId, planType: { not: 'premium' } },
					data: {
						planType: 'premium',
						premiumSource: 'grant',
						premiumEnvironment: null,
						premiumStatus: 'active',
						premiumStore: null,
						premiumProduct: null,
						premiumStartedAt: new Date(),
						premiumExpiresAt: null,
						premiumWillRenew: false
					}
				})
				if (count === 0) {
					const exists = await tx.profile.count({ where: { id: userId } })
					return exists ? 'already_premium' : 'no_profile'
				}
				await tx.premiumGrant.create({
					data: { userId, grantedBy: adminId, reason, action: 'grant' }
				})
				return 'granted'
			})
		},

		/**
		 * An admin takes a grant back: the profile returns to free, and a `premium_grants` row
		 * (`action = 'revoke'`) records it, in one transaction. Only a grant: a profile whose Plus
		 * came from a store subscription is never touched here.
		 */
		async revokeGrant(
			userId: string,
			adminId: string,
			reason: string | null
		): Promise<RevokeOutcome> {
			return client.$transaction(async (tx) => {
				const { count } = await tx.profile.updateMany({
					where: { id: userId, planType: 'premium', premiumSource: 'grant' },
					data: {
						planType: 'free',
						premiumSource: null,
						premiumEnvironment: null,
						premiumStatus: 'revoked',
						premiumWillRenew: false,
						premiumExpiresAt: new Date()
					}
				})
				if (count === 0) {
					const exists = await tx.profile.count({ where: { id: userId } })
					return exists ? 'not_a_grant' : 'no_profile'
				}
				await tx.premiumGrant.create({
					data: { userId, grantedBy: adminId, reason, action: 'revoke' }
				})
				return 'revoked'
			})
		},

		/** The person's stored market (ISO alpha-2), or null. */
		async regionOf(userId: string): Promise<string | null> {
			const row = await client.profile.findUnique({
				where: { id: userId },
				select: { region: true }
			})
			return row?.region ?? null
		},

		/** The profile half of the admin user list, for these auth user ids. */
		async adminRows(ids: string[]): Promise<AdminProfileRow[]> {
			const rows = await client.profile.findMany({
				where: { id: { in: ids } },
				select: {
					id: true,
					planType: true,
					premiumSource: true,
					premiumEnvironment: true,
					premiumStatus: true,
					isAdmin: true,
					region: true
				}
			})
			return rows.map((r) => ({
				id: r.id,
				plan_type: r.planType,
				premium_source: r.premiumSource,
				premium_environment: r.premiumEnvironment,
				premium_status: r.premiumStatus,
				is_admin: r.isAdmin,
				region: r.region
			}))
		},

		/**
		 * Subscriptions that end between `from` and `to` and will not renew. Every match: the
		 * window bounds it. Timestamps as PostgREST rendered them (./postgrest-time): the cron
		 * sends them to the Play Events API, and stamps the event id with their date.
		 */
		async expiringSubscriptions(from: Date, to: Date): Promise<ExpiringProfile[]> {
			return client.$queryRaw<ExpiringProfile[]>`
				select id::text as id, plan_type, locale, region, marketing_consent,
				       ${postgrestTime('premium_expires_at')} as premium_expires_at, premium_product
				from public.profiles
				where premium_expires_at is not null
				  and premium_will_renew = false
				  and premium_expires_at >= ${from}
				  and premium_expires_at <= ${to}`
		},

		/** Everyone last seen before `cutoff`. Timestamps as PostgREST rendered them. */
		async inactiveSince(cutoff: Date): Promise<InactiveProfile[]> {
			return client.$queryRaw<InactiveProfile[]>`
				select id::text as id, plan_type, locale, region, marketing_consent,
				       ${postgrestTime('last_seen_at')} as last_seen_at
				from public.profiles
				where last_seen_at is not null
				  and last_seen_at < ${cutoff}`
		}
	}
}

export type ProfileStore = ReturnType<typeof createProfileStore>

export const profileStore = createProfileStore(db)
