import { phaseAt } from '@/lib/sky'

const at = (hour: number, minute = 0) => new Date(2026, 9, 1, hour, minute)

describe('phaseAt', () => {
	it.each([
		[5, 'morning'],
		[11, 'morning'],
		[12, 'afternoon'],
		[16, 'afternoon'],
		[17, 'evening'],
		[20, 'evening'],
		[21, 'night'],
		[0, 'night'],
		[4, 'night']
	] as const)('%i:00 is %s', (hour, phase) => {
		expect(phaseAt(at(hour))).toBe(phase)
	})

	it('changes on the hour, not before', () => {
		expect(phaseAt(at(4, 59))).toBe('night')
		expect(phaseAt(at(16, 59))).toBe('afternoon')
	})
})
