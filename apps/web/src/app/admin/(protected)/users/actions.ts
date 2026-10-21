'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/require-admin'
import { createPlusActions, type PlanActionResult } from '@/server/admin/plus-grants'
import { profileStore } from '@/server/db/profiles'
import { log } from '@/server/lib/logger'

// Granting and taking back Kinpaw Plus from the admin users screen (M7). A server action is a
// public endpoint: the (protected) layout doesn't guard it, so each one checks requireAdmin()
// itself before anything is read or written (server/admin/plus-grants.ts, which is tested).
// Export only actions from this file: every export of a 'use server' file is an endpoint.

export type { PlanActionResult }

const plus = createPlusActions({
	requireAdmin,
	profileStore,
	log,
	revalidate: () => revalidatePath('/admin/users')
})

export async function grantPlus(userId: string, reason: string | null): Promise<PlanActionResult> {
	return plus.grantPlus(userId, reason)
}

export async function revokePlus(userId: string): Promise<PlanActionResult> {
	return plus.revokePlus(userId)
}
