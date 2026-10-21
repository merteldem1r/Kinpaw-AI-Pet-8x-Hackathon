import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { friendStore } from '@/server/db/friends'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/app/v1/friends/code: a new friend code for the caller (docs/application/features/
 * v2-friends-requirements.md, R6, R21). The old one stops working at once; friends they already
 * have stay. This is also how someone stops a code that went further than they meant.
 */
export const POST = createAppRoute(endpoints.resetFriendCode, async ({ user }) => {
	return { body: { code: await friendStore.resetCode(user.id) } }
})
