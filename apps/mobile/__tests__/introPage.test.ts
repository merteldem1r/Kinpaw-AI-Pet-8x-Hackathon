/**
 * What "Tell me about you" says, and when (kinpaw-screen-spec-v1.md, "Tell me about you (v2)"):
 * the pet's line, where Skip leaves the step, the line under the mic and the eyebrow.
 */
import { ASK_LINE, introEyebrow, introLine, introSkipStep, introStatus } from '@/lib/introPage'

const mic = { available: true, refused: false, listening: false }

describe('introPage', () => {
	it('asks until there is something else to say', () => {
		expect(introLine(null)).toBe(ASK_LINE)
		expect(introLine('heard')).toMatch(/tell me more/i)
		expect(introLine('later')).toMatch(/sleepy/)
	})

	it('skips from the step the person is on', () => {
		expect(introSkipStep(null, false)).toBe('record')
		expect(introSkipStep('heard', true)).toBe('review')
		expect(introSkipStep('empty', true)).toBe('empty_result')
	})

	it('says how to use the mic, or why there is none', () => {
		expect(introStatus(mic, false, 'Mochi')).toBe('Hold or tap to talk')
		expect(introStatus(mic, true, 'Mochi')).toBe('Talk again to add more')
		expect(introStatus({ ...mic, listening: true }, true, 'Mochi')).toBe('Tap or let go to stop')
		expect(introStatus({ ...mic, available: false }, false, 'Mochi')).toBe(
			'Type a few sentences for Mochi.'
		)
		expect(introStatus({ ...mic, available: false, refused: true }, false, 'Mochi')).toMatch(
			/microphone is off/
		)
	})

	it('names what is happening over the title', () => {
		expect(introEyebrow(false, false)).toBe('One last thing')
		expect(introEyebrow(false, true)).toBe('Listening…')
		expect(introEyebrow(true, false)).toBe('Getting to know you')
	})
})
