import { ACTION_GAIN, DECAY_PER_HOUR, FULL_HUNGER, NEEDS } from '@app/contract'
import { hourLabel, needInfo, signed } from '@/lib/needInfo'

describe('needInfo', () => {
	it('says something about every need, with the pet’s name', () => {
		for (const need of NEEDS) {
			const info = needInfo(need, 'Mochi')
			expect(info.about).toContain('Mochi')
			expect(info.lines.some((line) => line.kind === 'down')).toBe(true)
			expect(info.lines.some((line) => line.kind === 'up')).toBe(true)
		}
	})

	it('reads its numbers from the game’s rules', () => {
		const hunger = needInfo('hunger', 'Mochi')
			.lines.map((line) => line.text)
			.join(' ')
		expect(hunger).toContain(`about ${DECAY_PER_HOUR.hunger} every hour`)
		expect(hunger).toContain(`Feed: up to +${ACTION_GAIN.feed.base}`)
		expect(hunger).toContain('3 while asleep')
		expect(hunger).toContain(`${FULL_HUNGER} or more`)
		const energy = needInfo('energy', 'Mochi')
			.lines.map((line) => line.text)
			.join(' ')
		expect(energy).toContain('from 11pm to 7am')
	})
})

describe('signed', () => {
	it('uses a real minus sign', () => {
		expect(signed(30)).toBe('+30')
		expect(signed(-8)).toBe('−8')
	})
})

describe('hourLabel', () => {
	it('reads as a person would say it', () => {
		expect(hourLabel(23)).toBe('11pm')
		expect(hourLabel(7)).toBe('7am')
		expect(hourLabel(0)).toBe('midnight')
		expect(hourLabel(12)).toBe('noon')
	})
})
