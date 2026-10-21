import { endpoints } from '@app/contract'
import { MEMORY_EVENTS } from '@/lib/analytics/events'
import { recordUserEvent } from '@/lib/analytics/record'
import { ApiError } from '@/server/api/app-errors'
import { createAppRoute } from '@/server/api/app-route'
import { memoryStore } from '@/server/db/memory'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/app/v1/pet/memories/:id?from=list|intro: the caller forgets one thing the pet
 * remembers (docs/application/features/v2-memory-requirements.md, R17, R23). Only their own
 * pet's: anyone else's id is a 404, never a 403, so nobody learns it exists. `memory_deleted`
 * is recorded first-party with where it happened, never the fact.
 *
 * - 200 `{ ok: true }`: gone.
 * - 404: not one of theirs, or already deleted.
 */
export const DELETE = createAppRoute(endpoints.deletePetMemory, async ({ user, params, query }) => {
	if (!(await memoryStore.remove(user.id, params.id))) {
		throw new ApiError('not_found', 'That memory is already gone.')
	}
	await recordUserEvent(user.id, MEMORY_EVENTS.memoryDeleted, {
		path: '/api/app/v1/pet/memories',
		metadata: { from: query.from },
		dedupeMatch: { from: query.from }
	})
	return { body: { ok: true as const } }
})
