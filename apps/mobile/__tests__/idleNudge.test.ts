/**
 * Left alone on Home for a minute, the pet nudges: once per quiet spell, again only after a touch,
 * and never while Home isn't showing a pet.
 */
import { act, renderHook } from '@testing-library/react-native'
import { useIdleNudge } from '@/hooks/useIdleNudge'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const MINUTE = 60_000

describe('useIdleNudge', () => {
	it('nudges once after a quiet minute, not before', () => {
		const onIdle = jest.fn()
		renderHook(() => useIdleNudge(true, onIdle))
		act(() => jest.advanceTimersByTime(MINUTE - 5_000))
		expect(onIdle).not.toHaveBeenCalled()
		act(() => jest.advanceTimersByTime(5_000))
		expect(onIdle).toHaveBeenCalledTimes(1)
		act(() => jest.advanceTimersByTime(5 * MINUTE))
		expect(onIdle).toHaveBeenCalledTimes(1)
	})

	it('starts the minute again on a touch, and nudges again after the next quiet one', () => {
		const onIdle = jest.fn()
		const { result } = renderHook(() => useIdleNudge(true, onIdle))
		act(() => jest.advanceTimersByTime(MINUTE - 10_000))
		act(() => result.current())
		act(() => jest.advanceTimersByTime(MINUTE - 10_000))
		expect(onIdle).not.toHaveBeenCalled()
		act(() => jest.advanceTimersByTime(10_000))
		expect(onIdle).toHaveBeenCalledTimes(1)
		act(() => result.current())
		act(() => jest.advanceTimersByTime(MINUTE))
		expect(onIdle).toHaveBeenCalledTimes(2)
	})

	it('waits while Home is away or has no pet', () => {
		const onIdle = jest.fn()
		renderHook(() => useIdleNudge(false, onIdle))
		act(() => jest.advanceTimersByTime(5 * MINUTE))
		expect(onIdle).not.toHaveBeenCalled()
		expect(jest.getTimerCount()).toBe(0)
	})

	it('calls the latest onIdle, not the one from the first render', () => {
		const first = jest.fn()
		const latest = jest.fn()
		const { rerender } = renderHook(
			({ onIdle }: { onIdle: () => void }) => useIdleNudge(true, onIdle),
			{ initialProps: { onIdle: first } }
		)
		rerender({ onIdle: latest })
		act(() => jest.advanceTimersByTime(MINUTE))
		expect(first).not.toHaveBeenCalled()
		expect(latest).toHaveBeenCalledTimes(1)
	})
})
