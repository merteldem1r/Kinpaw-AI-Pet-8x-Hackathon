/**
 * How long a pet has been home, for its details page: days together, counted
 * from its first day as day 1, and the milestones along the way.
 */

const DAY_MS = 86_400_000

/** The milestones a pet reaches, in order: day 1, a week, a month, 100 days, a year. */
const MILESTONES: readonly { days: number; label: string }[] = [
	{ days: 1, label: 'First day' },
	{ days: 7, label: 'One week' },
	{ days: 30, label: 'One month' },
	{ days: 100, label: '100 days' },
	{ days: 365, label: 'One year' }
]

/** Local midnight of a date, so "days together" turns over at midnight, not 24 h after the save. */
function startOfDay(date: Date): number {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Days together, counting the day the pet came home as day 1. */
export function daysTogether(createdAt: Date, now: Date): number {
	const days = Math.round((startOfDay(now) - startOfDay(createdAt)) / DAY_MS)
	return Math.max(1, days + 1)
}

/** The last milestone reached and the next one, with how many days until it (null after a year). */
export function milestoneFor(days: number): {
	reached: string
	next: { label: string; inDays: number } | null
} {
	let reached = MILESTONES[0]!
	for (const milestone of MILESTONES) if (days >= milestone.days) reached = milestone
	const upcoming = MILESTONES.find((milestone) => milestone.days > days)
	return {
		reached: reached.label,
		next: upcoming ? { label: upcoming.label, inDays: upcoming.days - days } : null
	}
}
