import { endpoints, type IntroSendBody } from '@app/contract'
import { MEMORY_EVENTS } from '@/lib/analytics/events'
import { recordUserEvent } from '@/lib/analytics/record'
import { ApiError } from '@/server/api/app-errors'
import { createAppRoute } from '@/server/api/app-route'
import { toWireMemory } from '@/server/api/memory-wire'
import { requireTimeZone } from '@/server/api/time-zone'
import type { AppUser } from '@/server/auth/require-user'
import { introStore } from '@/server/db/intro'
import type { MemoryRecord } from '@/server/db/memory'
import { introduce } from '@/server/talk/intro'
import { talkProvider } from '@/server/talk/provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PATH = '/api/app/v1/pet/intro'

/**
 * POST /api/app/v1/pet/intro: "Tell me about you" (docs/application/features/
 * v2-memory-requirements.md, R18–R24). The person tells their pet about themselves once; one model
 * call keeps up to 8 facts and gives the pet's first reaction. At most 2 answered calls per pet,
 * counted on the server; these never count against the day's messages. The flow is `introduce`;
 * this turns its result into a response and records the events. What was said and the pet's line
 * are never stored, logged or recorded.
 *
 * - 200 `saved`: the model answered; `facts` are what was kept. With a fact kept,
 *   `intro_completed` (once ever) and `memory_saved` (daily, source intro) are recorded.
 * - 200 `retried`: this message id was already answered: the facts it kept, no new call.
 * - 200 `skipped`: `{ skip: true, step }` ends the step for good; `intro_skipped` (once ever).
 * - 400: a time zone that isn't a real IANA zone, or a body the contract refuses (over 60 words).
 * - 404: no pet yet.
 * - 409 `intro_closed`: the step is over (skipped, kept a fact, or used both attempts).
 * - 409 `conflict`: the message id is another pet's.
 * - 503 `talk_unavailable`: the model can't be reached; no attempt used.
 * - 503 `not_configured`: no model in production (no GROQ_API_KEY).
 * - 500: the model answered in a shape we can't use; no attempt used.
 */
export const POST = createAppRoute(endpoints.petIntro, async ({ user, body }) => {
	if ('skip' in body) {
		if (!(await introStore.skip(user.id))) {
			throw new ApiError('not_found', 'There is no pet to tell about yourself yet.')
		}
		await recordUserEvent(user.id, MEMORY_EVENTS.introSkipped, {
			path: PATH,
			metadata: { step: body.step },
			dedupeForever: true
		})
		return {
			body: {
				outcome: 'skipped' as const,
				facts: [],
				line: null,
				attempts_left: 0,
				intro_due: false
			}
		}
	}

	requireTimeZone(body.time_zone)
	const provider = talkProvider()
	if (!provider) throw new ApiError('not_configured', "Your pet can't listen right now.")

	const result = await introduce({ userId: user.id, body, provider })
	switch (result.kind) {
		case 'no_pet':
			throw new ApiError('not_found', 'There is no pet to tell about yourself yet.')
		case 'closed':
			throw new ApiError('intro_closed', 'Your pet already knows you.')
		case 'conflict':
			throw new ApiError('conflict', 'That message belongs to someone else.')
		case 'failed':
			throw result.failure === 'unavailable'
				? new ApiError('talk_unavailable', 'Your pet is a bit sleepy. Try again in a moment.')
				: new ApiError('internal', 'Your pet lost its train of thought. Try again.', {
						cause: new Error('the model answered in a shape the intro check refused')
					})
		case 'answered':
			if (result.outcome === 'saved') await recordKept(user, body, result.facts)
			return {
				body: {
					outcome: result.outcome,
					facts: result.facts.map(toWireMemory),
					line: result.line,
					attempts_left: result.attemptsLeft,
					intro_due: result.due
				}
			}
	}
})

/** How many facts the intro kept, as analytics may see it: a bucket, never the facts. */
function factsBucket(count: number): '1-2' | '3-5' | '6-8' {
	if (count <= 2) return '1-2'
	return count <= 5 ? '3-5' : '6-8'
}

/** The events for an intro that kept facts: labels only, never the words. */
async function recordKept(user: AppUser, body: IntroSendBody, facts: MemoryRecord[]) {
	const first = facts[0]
	if (!first) return
	await recordUserEvent(user.id, MEMORY_EVENTS.introCompleted, {
		path: PATH,
		metadata: { input: body.input, facts: factsBucket(facts.length) },
		dedupeForever: true
	})
	await recordUserEvent(user.id, MEMORY_EVENTS.memorySaved, {
		path: PATH,
		metadata: { source: 'intro', category: first.category, kind: first.kind, replaced: false },
		dedupeMatch: { source: 'intro' }
	})
}
