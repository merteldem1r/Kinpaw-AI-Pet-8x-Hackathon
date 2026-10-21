/**
 * When the pet's daily notes fire (docs/application/features/v2-notifications-requirements.md,
 * R4–R7). Pure: no Expo, no clock of its own. lib/notifications.ts schedules what this returns.
 *
 * Day 1 is the first moment a need would show below 30 after you leave, at least 3 hours after
 * you left, moved into 09:00–21:00. Days 2 and 3 follow 24 hours after the one before, moved
 * into the same window. Each speaks about the lowest need at its own time. Three at most, then
 * nothing until the app is opened again (R7).
 */
import { decayNeeds, isLow, lowestNeed, type Need, type Needs, type NudgeDay } from '@app/contract'

/** Never sooner than this after the app goes to the background (R5). */
export const NUDGE_MIN_AWAY_MS = 3 * 60 * 60 * 1000
/** Notes fire only from this local hour (R6)… */
const NUDGE_WINDOW_START = 9
/** …until this one, exclusive. */
const NUDGE_WINDOW_END = 21
/** Notes in all, one a day, before going quiet (R7). */
export const NUDGE_DAYS = 3
/** How finely the needs are projected forward to find the moment one goes low (R4). */
const NUDGE_STEP_MS = 15 * 60 * 1000
/** How far ahead day 1 looks for a low need. Hunger alone is low within a day, night or not. */
const NUDGE_HORIZON_MS = 72 * 60 * 60 * 1000

const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const WINDOW_START_MINUTES = NUDGE_WINDOW_START * 60
const WINDOW_END_MINUTES = NUDGE_WINDOW_END * 60

export type { NudgeDay }

export type Nudge = { at: Date; day: NudgeDay; need: Need }

export type NudgeInput = {
	/** The needs as stored, and when (the pet's `needs` and `updated_at`). */
	needs: Needs
	storedAt: Date
	/** When the app went to the background. */
	leftAt: Date
	/** The phone's IANA time zone. */
	timeZone: string
}

const formatters = new Map<string, Intl.DateTimeFormat>()

/** Minutes since local midnight at `at`, in `timeZone`. */
function localMinutes(at: number, timeZone: string): number {
	let formatter = formatters.get(timeZone)
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			hour: 'numeric',
			minute: 'numeric'
		})
		formatters.set(timeZone, formatter)
	}
	let hour = 0
	let minute = 0
	for (const part of formatter.formatToParts(at)) {
		if (part.type === 'hour') hour = Number(part.value)
		if (part.type === 'minute') minute = Number(part.value)
	}
	return hour * 60 + minute
}

/**
 * `at`, or the next local 09:00 when `at` is outside 09:00–21:00. The first jump counts minutes
 * on the clock; a second corrects it when a daylight-saving change fell in between.
 */
export function intoWindow(at: number, timeZone: string): number {
	const minutes = localMinutes(at, timeZone)
	if (minutes >= WINDOW_START_MINUTES && minutes < WINDOW_END_MINUTES) return at
	const wholeMinute = at - (at % MINUTE_MS)
	const jump = (WINDOW_START_MINUTES - minutes + 24 * 60) % (24 * 60)
	const moved = wholeMinute + jump * MINUTE_MS
	return moved + (WINDOW_START_MINUTES - localMinutes(moved, timeZone)) * MINUTE_MS
}

/**
 * Walks the needs forward from `from` (already decayed to that moment) to `to`, a step at a time,
 * calling `stop` after each step. Returns the moment `stop` said yes, or null.
 */
function firstMoment(
	needs: Needs,
	from: number,
	to: number,
	timeZone: string,
	stop: (needs: Needs) => boolean
): number | null {
	let current = needs
	for (let t = from; t < to;) {
		const next = Math.min(t + NUDGE_STEP_MS, to)
		current = decayNeeds(current, new Date(t), new Date(next), timeZone)
		if (stop(current)) return next
		t = next
	}
	return null
}

/** The pet's notes for this absence, earliest first: up to three, or none. */
export function planNudges({ needs, storedAt, leftAt, timeZone }: NudgeInput): Nudge[] {
	const left = leftAt.getTime()
	const atLeave = decayNeeds(needs, storedAt, leftAt, timeZone)
	const low = (current: Needs) => isLow(current[lowestNeed(current)])
	const firstLow = low(atLeave)
		? left
		: firstMoment(atLeave, left, left + NUDGE_HORIZON_MS, timeZone, low)
	if (firstLow == null) return []

	const plan: Nudge[] = []
	let at = intoWindow(Math.max(firstLow, left + NUDGE_MIN_AWAY_MS), timeZone)
	for (let day = 1; day <= NUDGE_DAYS; day++) {
		const then = decayNeeds(needs, storedAt, new Date(at), timeZone)
		plan.push({ at: new Date(at), day: day as NudgeDay, need: lowestNeed(then) })
		at = intoWindow(at + DAY_MS, timeZone)
	}
	return plan
}
