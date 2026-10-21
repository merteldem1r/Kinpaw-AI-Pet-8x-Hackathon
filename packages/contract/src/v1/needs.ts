import { z } from 'zod'
import type { Mood } from './appearance'

// The pet's four needs and every rule about them (docs/application/UI/kinpaw-screen-spec-v1.md,
// "Shared logic"; features/m5-home-core-loop-requirements.md, R2 and Decisions). Written once
// and used unchanged by the app (to show the needs) and the server (before it applies an
// action), so the two never disagree. The server owns the stored values; nothing here writes.

export const NEEDS = ['hunger', 'happiness', 'energy', 'affection'] as const
export type Need = (typeof NEEDS)[number]
export type Needs = Record<Need, number>

export const NEED_MIN = 0
export const NEED_MAX = 100
// Needs are stored as fractions (features/needs-rhythm-requirements.md, R9–R12): the rules
// below work in fractions and never round, so no decay is lost between changes. People see
// whole numbers (`wholeNeeds`), and every threshold reads the whole number shown, so a pill
// that shows 90 is full on both sides.
/** Below this a need is low: coral, "low", and it can pick the header line. */
export const LOW_NEED = 30
/** Every need at or above this is the all-good header and bubble. */
export const ALL_GOOD = 70

/** A stored need: any number from 0 to 100 (fractions since 2026-10-02, R10). */
const needValue = z.number().min(NEED_MIN).max(NEED_MAX)
export const needsSchema = z.object({
	hunger: needValue,
	happiness: needValue,
	energy: needValue,
	affection: needValue
})

/** The needs as stored: the values and when they were stored. Decay applies from then. */
export const storedNeedsSchema = needsSchema.extend({ updated_at: z.iso.datetime() })
export type StoredNeeds = z.infer<typeof storedNeedsSchema>

/** A new pet's needs (Decision 2): a little hungry, so the first Home invites a Feed. */
export const STARTING_NEEDS: Needs = { hunger: 60, happiness: 80, energy: 80, affection: 70 }

// ── Decay ────────────────────────────────────────────────────────────────────

/**
 * Points lost per hour in the day, 07:00–23:00 local (the daily rhythm, needs-rhythm R1, 2026-10-02;
 * tune freely). From full, hunger is low after about 6 hours, happiness 8, affection 10.
 */
export const DECAY_PER_HOUR: Needs = { hunger: 12, happiness: 9, energy: 5, affection: 7 }
/** While the pet sleeps, hunger, happiness and affection fall at this share of their day rate (R2). */
export const NIGHT_SLOWDOWN = 0.25
/** Energy gained per hour while the pet sleeps, in place of its decay (R2). */
export const SLEEP_ENERGY_PER_HOUR = 12
/** The local night window the pet sleeps in: from 23:00 to 07:00. */
export const NIGHT_STARTS = 23
export const NIGHT_ENDS = 7
/**
 * Decay looks back at most this far. By then every decaying need is long at 0 and energy is
 * back in its day-night rhythm, so a longer absence changes nothing, and the walk stays short.
 */
export const MAX_DECAY_MS = 7 * 24 * 60 * 60 * 1000

const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
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
	return formatter
}

/**
 * The phone's IANA time zone, as a request carries it. Only its shape is checked here; the
 * server checks it is a real zone with `isValidTimeZone`.
 */
export const timeZoneSchema = z.string().min(1).max(64)

/** Whether `timeZone` is an IANA zone this runtime knows ("Europe/Istanbul"). */
export function isValidTimeZone(timeZone: string): boolean {
	try {
		formatterFor(timeZone)
		return true
	} catch {
		return false
	}
}

/** Minutes since local midnight at `at`, in `timeZone`. */
function localMinutes(at: number, timeZone: string): number {
	let hour = 0
	let minute = 0
	for (const part of formatterFor(timeZone).formatToParts(at)) {
		if (part.type === 'hour') hour = Number(part.value)
		if (part.type === 'minute') minute = Number(part.value)
	}
	return hour * 60 + minute
}

function isNight(minutes: number): boolean {
	return minutes >= NIGHT_STARTS * 60 || minutes < NIGHT_ENDS * 60
}

/** Minutes from `minutes` until the next 07:00 or 23:00, whichever changes the window. */
function minutesToWindowChange(minutes: number): number {
	const target = (isNight(minutes) ? NIGHT_ENDS : NIGHT_STARTS) * 60
	return (target - minutes + 24 * 60) % (24 * 60) || 24 * 60
}

const clamp = (value: number) => Math.min(NEED_MAX, Math.max(NEED_MIN, value))

/** A need's change per hour, awake or asleep: energy recovers at night, the rest slow down. */
function ratePerHour(need: Need, night: boolean): number {
	if (need === 'energy') return night ? SLEEP_ENERGY_PER_HOUR : -DECAY_PER_HOUR.energy
	return -DECAY_PER_HOUR[need] * (night ? NIGHT_SLOWDOWN : 1)
}

/**
 * The needs at `now`, from the values stored at `storedAt`: each changes at its day rate, or its
 * night rate while the pet sleeps (the local night window, in `timeZone`). Fractions between 0
 * and 100, never rounded (show them with `wholeNeeds`). A clock behind `storedAt` decays nothing.
 *
 * The walk goes window by window, at most an hour at a time, so a daylight-saving change costs
 * at most that hour's accuracy; every need is clamped as it goes (a pet that ran out of energy
 * at dusk still recovers overnight).
 */
export function decayNeeds(stored: Needs, storedAt: Date, now: Date, timeZone: string): Needs {
	const elapsed = Math.min(Math.max(0, now.getTime() - storedAt.getTime()), MAX_DECAY_MS)
	const start = now.getTime() - elapsed
	// Only the four needs, whatever else the caller's object carries (a database row's id, its time).
	const needs: Needs = {
		hunger: stored.hunger,
		happiness: stored.happiness,
		energy: stored.energy,
		affection: stored.affection
	}
	for (let t = start; t < now.getTime();) {
		const minutes = localMinutes(t, timeZone)
		const step = Math.min(minutesToWindowChange(minutes) * MINUTE_MS, HOUR_MS, now.getTime() - t)
		const hours = step / HOUR_MS
		const night = isNight(minutes)
		for (const need of NEEDS) needs[need] = clamp(needs[need] + ratePerHour(need, night) * hours)
		t += step
	}
	return needs
}

/** The needs as people see them: whole numbers (R11). */
export function wholeNeeds(needs: Needs): Needs {
	return {
		hunger: Math.round(needs.hunger),
		happiness: Math.round(needs.happiness),
		energy: Math.round(needs.energy),
		affection: Math.round(needs.affection)
	}
}

/** The whole number a need shows as: what every threshold compares (R12). */
export function shown(value: number): number {
	return Math.round(value)
}

// ── Actions ──────────────────────────────────────────────────────────────────

export const ACTIONS = ['feed', 'play', 'pet'] as const
export const actionSchema = z.enum(ACTIONS)
export type PetAction = z.infer<typeof actionSchema>

/** Feed does nothing at this hunger or above ("I couldn't eat another bite."). */
export const FULL_HUNGER = 90
/** Play does nothing below this energy ("Too sleepy to play. Tomorrow?"). */
export const TOO_SLEEPY_TO_PLAY = 15

/**
 * What a care action fills, and how much at most (needs-rhythm R4): the gain is the base times
 * the room left, `base × (100 − value) / 100`, so each tap gives less the fuller the need is,
 * never less than MIN_GAIN and never past 100. From low, Feed goes +30, +18, +11, +6.5, then full.
 */
export const ACTION_GAIN: Record<PetAction, { need: Need; base: number }> = {
	feed: { need: 'hunger', base: 40 },
	play: { need: 'happiness', base: 35 },
	pet: { need: 'affection', base: 30 }
}
/** A tap that can help always shows: at least this much, room allowing. */
export const MIN_GAIN = 3
/** Feed and Pet also cheer the pet a little: this times the room left in happiness (R5). */
export const SIDE_HAPPINESS = 3
/** Each Play tires the pet: energy lost, flat (R5). */
export const PLAY_ENERGY_COST = 10

/** A gain of `base` to a need at `value`, shrinking with the room left; `min` floors it. */
function gainTo(value: number, base: number, min: number): number {
	const room = NEED_MAX - value
	return Math.min(room, Math.max(min, (base * room) / NEED_MAX))
}

/**
 * The needs after an action, and whether any of them changed. An action that can't help (Feed
 * when full, Play when too sleepy) changes nothing; the reaction line is the feedback, and
 * there are no cooldowns (Mert, 2026-10-02: nothing remembers recent actions).
 */
export function applyAction(needs: Needs, action: PetAction): { needs: Needs; changed: boolean } {
	if (!canHelp(needs, action)) return { needs, changed: false }
	const { need, base } = ACTION_GAIN[action]
	const next = { ...needs }
	next[need] = clamp(needs[need] + gainTo(needs[need], base, MIN_GAIN))
	if (action === 'play') next.energy = clamp(needs.energy - PLAY_ENERGY_COST)
	else next.happiness = clamp(next.happiness + gainTo(next.happiness, SIDE_HAPPINESS, 0))
	return { needs: next, changed: NEEDS.some((n) => next[n] !== needs[n]) }
}

/** The need each action is for. Energy has none: it only comes back with sleep. */
export const HELPS: Record<PetAction, Need> = {
	feed: 'hunger',
	play: 'happiness',
	pet: 'affection'
}

/** Whether an action can help now: Feed not when full, Play not when too sleepy; Pet always. */
export function canHelp(needs: Needs, action: PetAction): boolean {
	if (action === 'feed') return shown(needs.hunger) < FULL_HUNGER
	if (action === 'play') return shown(needs.energy) >= TOO_SLEEPY_TO_PLAY
	return true
}

// ── What the needs mean ──────────────────────────────────────────────────────

export function isLow(value: number): boolean {
	return shown(value) < LOW_NEED
}

export function lowCount(needs: Needs): number {
	return NEEDS.filter((need) => isLow(needs[need])).length
}

export function isAllGood(needs: Needs): boolean {
	return NEEDS.every((need) => shown(needs[need]) >= ALL_GOOD)
}

/**
 * The need the header and the bubble speak about: the lowest, ties going in the spec's order,
 * so a pet equally hungry and lonely says it missed you.
 */
const TIE_ORDER: readonly Need[] = ['affection', 'hunger', 'energy', 'happiness']

export function lowestNeed(needs: Needs): Need {
	return TIE_ORDER.reduce((lowest, need) =>
		shown(needs[need]) < shown(needs[lowest]) ? need : lowest
	)
}

/** The mood that picks the pet's face, by the spec's rules, in order. */
export function moodFor(exact: Needs): Mood {
	const needs = wholeNeeds(exact)
	if (needs.energy < 30) return 'sleepy'
	if (needs[lowestNeed(needs)] < 20) return 'sad'
	const average = NEEDS.reduce((sum, need) => sum + needs[need], 0) / NEEDS.length
	return average >= 75 ? 'happy' : 'content'
}

/**
 * The action the pet wants most: the one for its lowest need, when that need is low and the
 * action can help. Null when nothing is low, or the lowest is energy (sleep, not a button).
 */
export function wantedAction(needs: Needs): PetAction | null {
	const lowest = lowestNeed(needs)
	if (!isLow(needs[lowest])) return null
	const action = ACTIONS.find((candidate) => HELPS[candidate] === lowest)
	return action && canHelp(needs, action) ? action : null
}
