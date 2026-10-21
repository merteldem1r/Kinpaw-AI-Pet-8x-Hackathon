import { endpoints } from '@app/contract'
import { FRIEND_EVENTS } from '@/lib/analytics/events'
import { recordUserEvent } from '@/lib/analytics/record'
import { createAppRoute } from '@/server/api/app-route'
import { friendStore } from '@/server/db/friends'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/app/v1/friends/:id: end a friendship the caller is in, for both people; neither is
 * told (docs/application/features/v2-friends-requirements.md, R12, R20). Idempotent: 200 also
 * when it was already gone, and for an id that isn't theirs, which is never touched, so nobody
 * learns whether it exists. `friend_removed` is recorded only when one was removed.
 */
export const DELETE = createAppRoute(endpoints.removeFriend, async ({ user, params }) => {
	const { removed } = await friendStore.remove(user.id, params.id)
	if (removed) {
		await recordUserEvent(user.id, FRIEND_EVENTS.friendRemoved, {
			path: '/api/app/v1/friends',
			metadata: { friend_count: await friendStore.count(user.id) },
			dedupeDaily: false
		})
	}
	return { body: { ok: true as const } }
})
