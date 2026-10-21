/**
 * When the pet's daily notes fire (docs/application/features/v2-notifications-requirements.md,
 * R4–R7): the first low need after you leave, never within 3 hours, only 09:00–21:00, one a day,
 * three in all, through daylight-saving changes.
 */
import type { Needs } from '@app/contract'
import { intoWindow, NUDGE_MIN_AWAY_MS, planNudges } from '@/lib/nudge'

const FULL: Needs = { hunger: 100, happiness: 100, energy: 100, affection: 100 }
const HOUR = 60 * 60 * 1000
// Istanbul is UTC+3 all year: local times are easy to read.
const IST = 'Europe/Istanbul'

function localTime(at: Date, timeZone: string): string {
	return new Intl.DateTimeFormat('en-GB', {
		timeZone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).format(at)
}

function localDate(at: Date, timeZone: string): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone }).format(at)
}

function plan(leftAt: string, needs: Needs = FULL, timeZone = IST) {
	const left = new Date(leftAt)
	return planNudges({ needs, storedAt: left, leftAt: left, timeZone })
}

describe('day 1', () => {
	it('fires when the first need goes low', () => {
		// Left at 10:00 with everything full: hunger (−12/h) shows 28 at 16:00.
		const [first] = plan('2026-10-05T07:00:00Z')
		expect(localTime(first.at, IST)).toBe('16:00')
		expect(first).toMatchObject({ day: 1, need: 'hunger' })
	})

	it('waits 3 hours when a need is already low at leave', () => {
		const [first] = plan('2026-10-05T07:00:00Z', { ...FULL, affection: 20 })
		expect(first.at.getTime() - Date.parse('2026-10-05T07:00:00Z')).toBe(NUDGE_MIN_AWAY_MS)
		expect(localTime(first.at, IST)).toBe('13:00')
		expect(first.need).toBe('affection')
	})

	it('moves a late-evening low to 09:00 the next morning', () => {
		// Left at 16:30: hunger goes low at 22:30, after the window closes.
		const [first] = plan('2026-10-05T13:30:00Z')
		expect(localDate(first.at, IST)).toBe('2026-10-06')
		expect(localTime(first.at, IST)).toBe('09:00')
	})

	it('lets the pet sleep first when you leave at night', () => {
		// Left at 23:50: decay is slowed to a quarter until 07:00 (hunger 78.5), so it reads 29.5
		// at 11:05, shown as 30, and below 30 at the next step.
		const [first] = plan('2026-10-05T20:50:00Z')
		expect(localDate(first.at, IST)).toBe('2026-10-06')
		expect(localTime(first.at, IST)).toBe('11:20')
	})

	it('decays from when the needs were stored, not from leaving', () => {
		const storedAt = new Date('2026-10-05T07:00:00Z')
		const leftAt = new Date('2026-10-05T09:00:00Z')
		const [first] = planNudges({ needs: FULL, storedAt, leftAt, timeZone: IST })
		// Full at 10:00, left at 12:00: hunger is low at 16:00, after the 3 hours away (15:00).
		expect(localTime(first.at, IST)).toBe('16:00')
	})
})

describe('days 2 and 3', () => {
	it('follow a day apart, then stop', () => {
		const nudges = plan('2026-10-05T07:00:00Z')
		expect(nudges.map((n) => n.day)).toEqual([1, 2, 3])
		expect(nudges.map((n) => localDate(n.at, IST))).toEqual([
			'2026-10-05',
			'2026-10-06',
			'2026-10-07'
		])
		expect(nudges.map((n) => localTime(n.at, IST))).toEqual(['16:00', '16:00', '16:00'])
	})

	it('speak about the lowest need at their own time', () => {
		const [, second] = plan('2026-10-05T07:00:00Z')
		// A day later every need but sleep-restored energy is at 0; the tie goes to missing you.
		expect(second.need).toBe('affection')
	})
})

describe('intoWindow', () => {
	it('keeps a time inside 09:00–21:00 as it is', () => {
		const at = Date.parse('2026-10-05T12:34:56Z')
		expect(intoWindow(at, IST)).toBe(at)
	})

	it('moves 21:00 sharp to 09:00 the next day', () => {
		const moved = new Date(intoWindow(Date.parse('2026-10-05T18:00:00Z'), IST))
		expect(localDate(moved, IST)).toBe('2026-10-06')
		expect(localTime(moved, IST)).toBe('09:00')
	})

	it('lands on 09:00 across a daylight-saving change', () => {
		// New York falls back at 02:00 on 2026-11-01: 23:00 the night before is 10 clock hours,
		// but 11 real hours, from 09:00.
		const ny = 'America/New_York'
		const moved = new Date(intoWindow(Date.parse('2026-11-01T03:00:00Z'), ny))
		expect(localDate(moved, ny)).toBe('2026-11-01')
		expect(localTime(moved, ny)).toBe('09:00')
	})
})

describe('every plan, a week of leave times in three time zones', () => {
	const zones = ['Europe/Istanbul', 'America/New_York', 'Europe/London']
	// Every 37 minutes from 2026-10-26 to 2026-11-03: both daylight-saving changes fall inside.
	const start = Date.parse('2026-10-26T00:00:00Z')
	const leaves = Array.from({ length: (8 * 24 * 60) / 37 }, (_, i) => start + i * 37 * 60 * 1000)

	it('keeps every rule', () => {
		for (const timeZone of zones) {
			for (const left of leaves) {
				const needs = { hunger: 70, happiness: 55, energy: 80, affection: 90 }
				const storedAt = new Date(left - 2 * HOUR)
				const nudges = planNudges({ needs, storedAt, leftAt: new Date(left), timeZone })
				expect(nudges).toHaveLength(3)
				expect(nudges[0].at.getTime()).toBeGreaterThanOrEqual(left + NUDGE_MIN_AWAY_MS)
				const dates = new Set<string>()
				for (const [i, nudge] of nudges.entries()) {
					const time = localTime(nudge.at, timeZone)
					expect(time >= '09:00' && time < '21:00').toBe(true)
					dates.add(localDate(nudge.at, timeZone))
					if (i > 0) {
						expect(nudge.at.getTime() - nudges[i - 1].at.getTime()).toBeGreaterThanOrEqual(
							22 * HOUR
						)
					}
				}
				expect(dates.size).toBe(3)
			}
		}
	})
})
