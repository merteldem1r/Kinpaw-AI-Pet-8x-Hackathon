import { moonPath, moonPhaseAt } from '@/lib/sky'

const near = (phase: number, target: number) => {
	// The cycle wraps: 0.99 is as close to 0 as 0.01 is.
	const d = Math.abs(phase - target)
	return Math.min(d, 1 - d)
}

describe('moonPhaseAt', () => {
	it('finds known new and full moons within about a day', () => {
		const dayOfCycle = 1 / 29.53
		expect(near(moonPhaseAt(new Date(Date.UTC(2024, 3, 8, 18, 21))), 0)).toBeLessThan(dayOfCycle)
		expect(near(moonPhaseAt(new Date(Date.UTC(2024, 8, 18, 2, 34))), 0.5)).toBeLessThan(dayOfCycle)
		expect(near(moonPhaseAt(new Date(Date.UTC(2026, 0, 3, 10, 3))), 0.5)).toBeLessThan(dayOfCycle)
	})

	it('stays in [0, 1) before the reference date too', () => {
		const phase = moonPhaseAt(new Date(Date.UTC(1990, 5, 1)))
		expect(phase).toBeGreaterThanOrEqual(0)
		expect(phase).toBeLessThan(1)
	})
})

describe('moonPath', () => {
	it('lights the right half while waxing and the left while waning', () => {
		// The first arc runs top to bottom: sweep 1 goes round the right side.
		expect(moonPath(0.2, 23)).toMatch(/^M23 0 A23 23 0 0 1 23 46/)
		expect(moonPath(0.8, 23)).toMatch(/^M23 0 A23 23 0 0 0 23 46/)
	})

	it('never draws a new moon thinner than a crescent', () => {
		const rx = Number(moonPath(0, 23).split(' A')[2]!.split(' ')[0])
		expect(rx).toBeLessThan(23)
	})

	it('draws a full moon as a whole disc', () => {
		// The left half down, then a full-width arc back up the right.
		expect(moonPath(0.5, 23)).toBe('M23 0 A23 23 0 0 0 23 46 A23 23 0 0 0 23 0 Z')
	})
})
