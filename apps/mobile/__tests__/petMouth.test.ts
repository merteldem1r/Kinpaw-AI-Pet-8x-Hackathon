/**
 * The pet's mouth on its voice (docs/application/features/v3-pet-looks-requirements.md, R6): a
 * batch of audio frames gives how open the mouth is, silence shuts it, and it closes a little
 * slower than it opens so it never flickers.
 */
import { nextMouth, opennessOf } from '@/lib/petMouth'

jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'))
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'))

/** A sine wave at `amplitude` (-1 to 1), as a batch of frames. */
const tone = (amplitude: number, length = 1024) =>
	Array.from({ length }, (_, i) => amplitude * Math.sin((i / 16) * Math.PI))

describe('opennessOf', () => {
	it('keeps the mouth shut for silence and for an empty batch', () => {
		expect(opennessOf([])).toBe(0)
		expect(opennessOf(tone(0))).toBe(0)
		expect(opennessOf(tone(0.01))).toBe(0)
	})

	it('opens it wide for a loud sound, and never past 1', () => {
		expect(opennessOf(tone(0.6))).toBe(1)
		expect(opennessOf(tone(1))).toBe(1)
	})

	it('opens it more the louder the sound, with quiet speech still opening it a little', () => {
		const quiet = opennessOf(tone(0.05))
		const speech = opennessOf(tone(0.15))
		expect(quiet).toBeGreaterThan(0.1)
		expect(speech).toBeGreaterThan(quiet)
		expect(speech).toBeLessThan(1)
	})
})

describe('nextMouth', () => {
	it('opens at once with a louder batch', () => {
		expect(nextMouth(0.2, 0.9)).toBe(0.9)
	})

	it('closes over a few batches, not at once', () => {
		const next = nextMouth(0.9, 0)
		expect(next).toBeGreaterThan(0)
		expect(next).toBeLessThan(0.9)
		let mouth = 0.9
		for (let i = 0; i < 10; i++) mouth = nextMouth(mouth, 0)
		expect(mouth).toBeLessThan(0.01)
	})
})
