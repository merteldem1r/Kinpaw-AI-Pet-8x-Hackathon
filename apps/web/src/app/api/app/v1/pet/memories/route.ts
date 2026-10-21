import {
	endpoints,
	localDay,
	MEMORY_CAP_FREE,
	MEMORY_CAP_PLUS,
	MEMORY_PAGE_MAX
} from '@app/contract'
import { invalidInput } from '@/server/api/app-errors'
import { createAppRoute } from '@/server/api/app-route'
import { decodeCursor, encodeCursor } from '@/server/api/memory-cursor'
import { toWireMemory } from '@/server/api/memory-wire'
import { requireTimeZone } from '@/server/api/time-zone'
import { memoryStore } from '@/server/db/memory'
import { profileStore } from '@/server/db/profiles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/app/v1/pet/memories?time_zone=…&q=…&cursor=…&limit=…: one page of what the caller's
 * pet remembers, newest first, searchable (docs/application/features/v2-memory-requirements.md,
 * R16–R17). Only the caller's own facts, scoped in the query. Events past their 14 days are left
 * out by the caller's own day. The cap is the server's premium check, never the app's. The tags
 * and scores never leave the server. No pet: an empty page.
 *
 * - 200: `{ memories, cap, total, matched, next_cursor }`.
 * - 400: a time zone that isn't a real IANA zone, or a cursor this server didn't hand out.
 */
export const GET = createAppRoute(endpoints.petMemories, async ({ user, query }) => {
	requireTimeZone(query.time_zone)
	const cursor = query.cursor ? decodeCursor(query.cursor) : undefined
	if (cursor === null) throw invalidInput({ path: 'cursor', message: 'Not a place in this list.' })

	const [page, premium] = await Promise.all([
		memoryStore.page(user.id, {
			today: localDay(new Date(), query.time_zone),
			search: query.q,
			cursor,
			limit: query.limit ?? MEMORY_PAGE_MAX
		}),
		profileStore.isPremium(user.id)
	])
	return {
		body: {
			memories: page.memories.map(toWireMemory),
			cap: premium ? MEMORY_CAP_PLUS : MEMORY_CAP_FREE,
			total: page.total,
			matched: page.matched,
			next_cursor: page.next ? encodeCursor(page.next) : null
		}
	}
})
