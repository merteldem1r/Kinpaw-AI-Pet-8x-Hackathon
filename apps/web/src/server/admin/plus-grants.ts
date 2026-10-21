import { z } from 'zod'
import type { requireAdmin } from '@/lib/require-admin'
import type { ProfileStore } from '@/server/db/profiles'
import type { Logger } from '@/server/lib/logger'

// Granting and taking back Kinpaw Plus from the admin users screen (M7,
// docs/application/features/m7-plus-profile-settings-requirements.md, R1–R3). Money and
// entitlement (non-negotiable 3): the admin check comes first, before anything is read or
// written, and the writes are the profile store's, which also records the audit row.
//
// The server actions in app/admin/(protected)/users/actions.ts call these. This module is not a
// 'use server' file on purpose: every export of one is a public endpoint, so the logic lives here
// with its dependencies passed in, which is also what lets a test stand in for the admin check.

/** What the screen shows after an action: done, or why nothing changed. */
export type PlanActionResult = { ok: true; message: string } | { ok: false; message: string }

const REASON_MAX = 200

const input = z.object({
	userId: z.uuid(),
	reason: z
		.string()
		.trim()
		.max(REASON_MAX)
		.transform((reason) => reason || null)
		.nullable()
		.default(null)
})

type Deps = {
	requireAdmin: typeof requireAdmin
	profileStore: Pick<ProfileStore, 'grantPremium' | 'revokeGrant'>
	log: Pick<Logger, 'info'>
	/** Shows the change on the admin users screen. */
	revalidate: () => void
}

const NOT_AUTHORIZED: PlanActionResult = { ok: false, message: 'Not authorized.' }
const NOT_VALID: PlanActionResult = { ok: false, message: 'That request is not valid.' }

export function createPlusActions({ requireAdmin, profileStore, log, revalidate }: Deps) {
	return {
		async grantPlus(userId: string, reason: string | null): Promise<PlanActionResult> {
			const admin = await requireAdmin()
			if ('response' in admin) return NOT_AUTHORIZED
			const parsed = input.safeParse({ userId, reason })
			if (!parsed.success) return NOT_VALID

			const outcome = await profileStore.grantPremium(
				parsed.data.userId,
				admin.user.id,
				parsed.data.reason
			)
			log.info('admin plus grant', {
				admin_id: admin.user.id,
				user_id: parsed.data.userId,
				outcome
			})
			revalidate()
			switch (outcome) {
				case 'granted':
					return { ok: true, message: 'Kinpaw Plus granted.' }
				case 'already_premium':
					return { ok: false, message: 'This account already has Plus.' }
				case 'no_profile':
					return { ok: false, message: 'This account has no profile yet.' }
			}
		},

		async revokePlus(userId: string): Promise<PlanActionResult> {
			const admin = await requireAdmin()
			if ('response' in admin) return NOT_AUTHORIZED
			const parsed = input.safeParse({ userId })
			if (!parsed.success) return NOT_VALID

			const outcome = await profileStore.revokeGrant(parsed.data.userId, admin.user.id, null)
			log.info('admin plus revoke', {
				admin_id: admin.user.id,
				user_id: parsed.data.userId,
				outcome
			})
			revalidate()
			switch (outcome) {
				case 'revoked':
					return { ok: true, message: 'Kinpaw Plus taken back.' }
				case 'not_a_grant':
					return { ok: false, message: 'Only a grant can be taken back here, not a subscription.' }
				case 'no_profile':
					return { ok: false, message: 'This account has no profile yet.' }
			}
		}
	}
}
