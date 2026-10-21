import { awayBucket, endpoints, localDay } from '@app/contract'
import { MEMORY_EVENTS, NOTIFICATION_EVENTS } from '@/lib/analytics/events'
import { recordUserEvent } from '@/lib/analytics/record'
import { createAppRoute } from '@/server/api/app-route'
import { requireTimeZone } from '@/server/api/time-zone'
import { memoryStore } from '@/server/db/memory'
import { profileStore } from '@/server/db/profiles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PATH = '/api/app/v1/pet/greeting'

/**
 * POST /api/app/v1/pet/greeting: called by Home when the app opens, at most once per foreground
 * ("I missed you", docs/application/features/v2-memory-requirements.md, R26–R28). No model call.
 *
 * 1. Reads and moves `profiles.last_seen_at` in one step (the app's only writer of it), and
 *    turns the time between into a bucket.
 * 2. Picks the most important remembered event whose day has come and marks it asked, so its
 *    question is served once, even to two phones opening at once.
 * 3. Records `greeting_shown` (daily) when there is a return line to say: time away, a question,
 *    or both. Never the question's words.
 * 4. For the pet's notes (v2-notifications-requirements.md, R16–R17): `notification_opened`
 *    (daily) when a tapped note opened the app, whatever the time away, and `notifications_state`
 *    (daily per state) whenever the phone says what it is. Labels only.
 *
 * The app writes the line itself, from the bucket and the question (lib/petLines.ts).
 *
 * - 200 `{ away, follow_up }`. No pet: the time away still moves, and no question.
 * - 400: a time zone that isn't a real IANA zone, or a note's labels the contract refuses
 *   (an unknown day or need, or `via` without both), before anything is written.
 */
export const POST = createAppRoute(endpoints.petGreeting, async ({ user, body }) => {
	requireTimeZone(body.time_zone)
	const now = new Date()
	const away = awayBucket(await profileStore.markSeen(user.id, now), now)

	const due = await memoryStore.due(user.id, localDay(now, body.time_zone))
	const asked =
		due?.followUp && (await memoryStore.markFollowedUp(user.id, due.id, now))
			? { id: due.id, question: due.followUp }
			: null

	if (away !== 'none' || asked) {
		await recordUserEvent(user.id, MEMORY_EVENTS.greetingShown, {
			path: PATH,
			metadata: { away, follow_up: asked !== null }
		})
	}
	if (body.via === 'notification') {
		await recordUserEvent(user.id, NOTIFICATION_EVENTS.notificationOpened, {
			path: PATH,
			metadata: { day: body.day, need: body.need }
		})
	}
	if (body.notifications) {
		await recordUserEvent(user.id, NOTIFICATION_EVENTS.notificationsState, {
			path: PATH,
			metadata: { state: body.notifications },
			dedupeMatch: { state: body.notifications }
		})
	}
	return { body: { away, follow_up: asked } }
})
