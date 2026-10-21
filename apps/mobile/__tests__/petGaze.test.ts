/**
 * Where the pet on Home looks (v2-voice-requirements.md): every look is a new cue, even to the same
 * spot, and while it speaks its reply it glances around until it stops.
 */
import { act, renderHook } from '@testing-library/react-native'
import { usePetGaze } from '@/hooks/usePetGaze'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('usePetGaze', () => {
	it('makes each look a new cue, so the same spot twice still moves the eyes', () => {
		const { result } = renderHook(() => usePetGaze(false))
		expect(result.current.cue).toBeNull()
		act(() => result.current.look(0, -1, false))
		const first = result.current.cue
		act(() => result.current.look(0, -1, false))
		expect(result.current.cue).toEqual({ lookX: 0, lookY: -1, hop: false, key: first!.key + 1 })
	})

	it('glances around while the pet speaks, and stops when it is done', () => {
		const { result, rerender } = renderHook(
			({ speaking }: { speaking: boolean }) => usePetGaze(speaking),
			{
				initialProps: { speaking: true }
			}
		)
		const glances = [result.current.cue]
		for (let i = 0; i < 4; i++) {
			act(() => jest.advanceTimersByTime(600))
			glances.push(result.current.cue)
		}
		expect(glances.map((c) => [c?.lookX, c?.lookY])).toEqual([
			[0.3, 0.15],
			[-0.25, 0.1],
			[0.55, -0.35],
			[-0.1, 0.2],
			[0.3, 0.15]
		])

		rerender({ speaking: false })
		const still = result.current.cue
		act(() => jest.advanceTimersByTime(3000))
		expect(result.current.cue).toBe(still)
		expect(jest.getTimerCount()).toBe(0)
	})
})
