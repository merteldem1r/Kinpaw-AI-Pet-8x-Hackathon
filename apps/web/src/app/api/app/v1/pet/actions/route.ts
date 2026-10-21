import { endpoints } from '@app/contract'
import { PET_EVENTS } from '@/lib/analytics/events'
import { recordUserEvent } from '@/lib/analytics/record'
import { ApiError } from '@/server/api/app-errors'
import { createAppRoute } from '@/server/api/app-route'
import { toWirePet } from '@/server/api/pet-wire'
import { requireTimeZone } from '@/server/api/time-zone'
import { petStore } from '@/server/db/pets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/app/v1/pet/actions: Feed, Play or Pet the caller's pet (docs/application/features/
 * m5-home-core-loop-requirements.md, R4–R5). The server decays the stored needs to now, in the
 * phone's time zone, applies the action and stores the result; the app only shows it. Its own
 * pet only: the owner is the verified caller.
 *
 * - 200: `{ pet, changed }`. `changed` is false when the action can't help (Feed when full, Play
 *   when too sleepy); the decayed needs are still stored, so the answer is always current.
 *   `pet_action_taken` is recorded first-party, once a day per action.
 * - 400: an unknown action (the contract) or a time zone that isn't a real IANA zone.
 * - 404: the caller has no pet yet.
 */
export const POST = createAppRoute(endpoints.petAction, async ({ user, body }) => {
	requireTimeZone(body.time_zone)

	const result = await petStore.act(user.id, body.action, body.time_zone)
	if (!result) throw new ApiError('not_found', 'There is no pet to care for yet.')

	await recordUserEvent(user.id, PET_EVENTS.petActionTaken, {
		path: '/api/app/v1/pet/actions',
		metadata: { action: body.action, need_changed: result.changed },
		dedupeMatch: { action: body.action }
	})

	return { body: { pet: toWirePet(result.row), changed: result.changed } }
})
