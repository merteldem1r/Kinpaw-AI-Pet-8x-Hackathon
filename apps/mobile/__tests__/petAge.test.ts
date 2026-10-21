import { daysTogether, milestoneFor } from '@/lib/petAge'

describe('daysTogether', () => {
	it('counts the day the pet came home as day 1', () => {
		expect(daysTogether(new Date(2026, 9, 1, 9), new Date(2026, 9, 1, 23))).toBe(1)
	})

	it('turns over at local midnight, not 24 hours after the save', () => {
		expect(daysTogether(new Date(2026, 9, 1, 23, 30), new Date(2026, 9, 2, 0, 10))).toBe(2)
		expect(daysTogether(new Date(2026, 9, 1), new Date(2026, 9, 31))).toBe(31)
	})

	it('never goes below 1 if the phone clock is behind', () => {
		expect(daysTogether(new Date(2026, 9, 5), new Date(2026, 9, 1))).toBe(1)
	})
})

describe('milestoneFor', () => {
	it('names the last milestone reached and the next', () => {
		expect(milestoneFor(1)).toEqual({
			reached: 'First day',
			next: { label: 'One week', inDays: 6 }
		})
		expect(milestoneFor(7)).toEqual({
			reached: 'One week',
			next: { label: 'One month', inDays: 23 }
		})
		expect(milestoneFor(120).reached).toBe('100 days')
	})

	it('has nothing next after a year', () => {
		expect(milestoneFor(400)).toEqual({ reached: 'One year', next: null })
	})
})
