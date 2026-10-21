import { endpoints } from '@app/contract'
import { FRIEND_EVENTS } from '@/lib/analytics/events'
import { recordUserEvent } from '@/lib/analytics/record'
import { ApiError } from '@/server/api/app-errors'
import { createAppRoute } from '@/server/api/app-route'
import { toWireFriend } from '@/server/api/friend-wire'
import { requireTimeZone } from '@/server/api/time-zone'
import { friendStore } from '@/server/db/friends'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PATH = '/api/app/v1/friends'

/**
 * GET /api/app/v1/friends?time_zone=…: the caller's friend code (made the first time) and their
 * friends' pets, newest first (docs/application/features/v2-friends-requirements.md, R17). Each
 * pet as a friend may see it (R13), decayed in the caller's time zone. `friends_viewed` is
 * recorded first-party, daily, when there is at least one friend.
 */
export const GET = createAppRoute(endpoints.getFriends, async ({ user, query }) => {
	const timeZone = requireTimeZone(query.time_zone)
	const [code, friends] = await Promise.all([
		friendStore.codeFor(user.id),
		friendStore.list(user.id)
	])
	if (friends.length > 0) {
		await recordUserEvent(user.id, FRIEND_EVENTS.friendsViewed, {
			path: PATH,
			metadata: { friend_count: friends.length }
		})
	}
	return { body: { code, friends: friends.map((friend) => toWireFriend(friend, timeZone)) } }
})

/**
 * POST /api/app/v1/friends: add the owner of `code` as a friend, for both people (R9, R19).
 * Showing a code is the consent, so there is no request to accept. Safe to retry.
 *
 * - 201 `{ friend, existing: false }`: friends now. `friend_added` is recorded for both.
 * - 200 `{ friend, existing: true }`: they already were; nothing written or recorded.
 * - 400 `friend_own_code`; 404 `friend_code_unknown` (never made, or replaced);
 *   409 `friends_full` (the caller) or `friend_friends_full` (the code's owner).
 */
export const POST = createAppRoute(endpoints.addFriend, async ({ user, body }) => {
	const timeZone = requireTimeZone(body.time_zone)
	const owner = await friendStore.ownerOf(body.code)
	if (!owner) throw new ApiError('friend_code_unknown', "That code didn't work.")
	if (owner.userId === user.id) throw new ApiError('friend_own_code', "That's your own code.")

	const result = await friendStore.add(user.id, owner.userId)
	if (result.outcome === 'self_full') {
		throw new ApiError('friends_full', 'You can have up to 50 friends.')
	}
	if (result.outcome === 'friend_full') {
		throw new ApiError('friend_friends_full', "They can't add more friends right now.")
	}

	if (result.outcome === 'added') {
		const theirCount = await friendStore.count(owner.userId)
		await Promise.all([
			recordUserEvent(user.id, FRIEND_EVENTS.friendAdded, {
				path: PATH,
				metadata: { source: body.source, side: 'adder', friend_count: result.friendCount },
				dedupeDaily: false
			}),
			recordUserEvent(owner.userId, FRIEND_EVENTS.friendAdded, {
				path: PATH,
				metadata: { source: body.source, side: 'added', friend_count: theirCount },
				dedupeDaily: false
			})
		])
	}

	return {
		body: {
			friend: toWireFriend(result.friend, timeZone),
			existing: result.outcome === 'existing'
		},
		status: result.outcome === 'added' ? 201 : 200
	}
})
