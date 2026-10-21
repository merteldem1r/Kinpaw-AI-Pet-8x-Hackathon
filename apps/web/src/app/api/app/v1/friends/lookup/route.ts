import { endpoints } from '@app/contract'
import { ApiError } from '@/server/api/app-errors'
import { createAppRoute } from '@/server/api/app-route'
import { toWireFriendPreview } from '@/server/api/friend-wire'
import { requireTimeZone } from '@/server/api/time-zone'
import { friendStore } from '@/server/db/friends'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/app/v1/friends/lookup: whose code this is, so the add screen can show their pet and
 * name before anything is added (docs/application/features/v2-friends-requirements.md, R8, R18).
 * No ids in the answer. Writes nothing.
 *
 * - 200 `{ friend }`.
 * - 400 `friend_own_code`; 404 `friend_code_unknown`.
 */
export const POST = createAppRoute(endpoints.lookupFriend, async ({ user, body }) => {
	const timeZone = requireTimeZone(body.time_zone)
	const owner = await friendStore.ownerOf(body.code)
	if (!owner) throw new ApiError('friend_code_unknown', "That code didn't work.")
	if (owner.userId === user.id) throw new ApiError('friend_own_code', "That's your own code.")
	return { body: { friend: toWireFriendPreview(owner, timeZone) } }
})
