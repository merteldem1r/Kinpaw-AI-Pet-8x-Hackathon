import { z } from 'zod'
import { MEMORY_TEXT_MAX } from './memory'
import { NEEDS, timeZoneSchema } from './needs'

// "I missed you" (docs/application/features/v2-memory-requirements.md, R26–R28): when the app
// opens, the server says how long the person was away and, when a remembered event is due, the
// question to ask about it. The app turns that into the pet's return line. No model call.

/** Time away, as the return line sees it (Decision 3): under 6 hours is Home as usual. */
export const AWAY_BUCKETS = ['none', '6-24h', '1-3d', '3d+'] as const
export type AwayBucket = (typeof AWAY_BUCKETS)[number]

const HOUR_MS = 3_600_000
/** Where each bucket starts, in hours away. */
export const AWAY_FROM_HOURS = { '6-24h': 6, '1-3d': 24, '3d+': 72 } as const

/**
 * The bucket for the time between the last open and now. Never seen before (a new account) is
 * `none`: there is nobody to have missed yet.
 */
export function awayBucket(lastSeen: Date | null, now: Date): AwayBucket {
	if (!lastSeen) return 'none'
	const hours = (now.getTime() - lastSeen.getTime()) / HOUR_MS
	if (hours >= AWAY_FROM_HOURS['3d+']) return '3d+'
	if (hours >= AWAY_FROM_HOURS['1-3d']) return '1-3d'
	if (hours >= AWAY_FROM_HOURS['6-24h']) return '6-24h'
	return 'none'
}

/**
 * The pet's daily notes (v2-notifications-requirements.md, R16–R17): which of the three a tapped
 * one was, and whether notes can reach this person at all (the Settings toggle and iOS's answer).
 */
export const NUDGE_DAYS = [1, 2, 3] as const
export type NudgeDay = (typeof NUDGE_DAYS)[number]
export const NOTES_STATES = ['on', 'off', 'denied', 'unasked'] as const
export type NotesState = (typeof NOTES_STATES)[number]

/**
 * POST /api/app/v1/pet/greeting. The phone's time zone decides which events are due today.
 * Optional, for the notes (R16–R17): `via: 'notification'` with the tapped note's `day` and
 * `need` (all three or none), and `notifications`, the notes' state, on every call. An older
 * build sends none of them.
 */
export const greetingBody = z
	.object({
		time_zone: timeZoneSchema,
		via: z.literal('notification').optional(),
		day: z.union(NUDGE_DAYS.map((day) => z.literal(day))).optional(),
		need: z.enum(NEEDS).optional(),
		notifications: z.enum(NOTES_STATES).optional()
	})
	.strict()
	.refine(
		(body) =>
			(body.via === undefined) === (body.day === undefined) &&
			(body.via === undefined) === (body.need === undefined),
		{ message: 'A note open carries via, day and need together', path: ['via'] }
	)
export type GreetingBody = z.infer<typeof greetingBody>

/**
 * `away`: how long since the last greeting. `follow_up`: a remembered event whose day has come,
 * with the question written when it was kept; it is marked asked when served, so it comes once.
 */
export const greetingResponse = z.object({
	away: z.enum(AWAY_BUCKETS),
	follow_up: z.object({ id: z.uuid(), question: z.string().min(1).max(MEMORY_TEXT_MAX) }).nullable()
})
export type GreetingResponse = z.infer<typeof greetingResponse>
