/**
 * The feedback around the pet on Home (m5-home-core-loop-requirements.md, Decision 6): bursts
 * float up and clear themselves, a face lasts a moment, care chips replace what is on their side,
 * and nothing is left running once Home is gone.
 */
import { act, renderHook } from '@testing-library/react-native'
import { usePetReactions } from '@/hooks/usePetReactions'
import { BURST_MS, CARE_EFFECT_MS } from '@/lib/petEffects'

const full = { hunger: 90, happiness: 90, energy: 90, affection: 90 }

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('usePetReactions', () => {
	it('floats a burst up for its species, then drops it', () => {
		const { result } = renderHook(() => usePetReactions('cat'))
		act(() => result.current.celebrate('feed', false))
		expect(result.current.bursts).toEqual([
			expect.objectContaining({ kind: 'feed', species: 'cat' })
		])
		expect(result.current.moment).toBeNull()
		act(() => jest.advanceTimersByTime(BURST_MS))
		expect(result.current.bursts).toEqual([])
	})

	it('keeps at most six bursts in the air, dropping the oldest', () => {
		const { result } = renderHook(() => usePetReactions('dog'))
		act(() => result.current.celebrate('pet', false))
		act(() => result.current.celebrate('pet', false))
		const [first, second] = result.current.bursts.map((b) => b.id)
		act(() => {
			for (let i = 0; i < 6; i++) result.current.celebrate('pet', false)
		})
		const ids = result.current.bursts.map((b) => b.id)
		expect(ids).toHaveLength(6)
		expect(ids).not.toContain(first)
		expect(ids).not.toContain(second)
	})

	it('cheers with a happy face for a moment', () => {
		const { result } = renderHook(() => usePetReactions('cat'))
		act(() => result.current.celebrate('pet', true))
		expect(result.current.moment).toBe('happy')
		act(() => jest.advanceTimersByTime(900))
		expect(result.current.moment).toBeNull()
	})

	it('lets a new face replace the one showing, with its own full moment', () => {
		const { result } = renderHook(() => usePetReactions('cat'))
		act(() => result.current.showMoment('happy'))
		act(() => jest.advanceTimersByTime(600))
		act(() => result.current.showMoment('sad'))
		act(() => jest.advanceTimersByTime(600))
		expect(result.current.moment).toBe('sad')
		act(() => jest.advanceTimersByTime(300))
		expect(result.current.moment).toBeNull()
	})

	it('does nothing before there is a pet', () => {
		const { result } = renderHook(() => usePetReactions(undefined))
		act(() => result.current.celebrate('feed', true))
		expect(result.current.bursts).toEqual([])
		expect(result.current.moment).toBeNull()
	})

	it('shows a chip for a need that changed, one per side, then clears it', () => {
		const { result } = renderHook(() => usePetReactions('cat'))
		act(() => result.current.showCareEffects({ ...full, hunger: 40 }, full))
		expect(result.current.careEffects).toEqual([
			expect.objectContaining({ need: 'hunger', up: true })
		])
		act(() => result.current.showCareEffects({ ...full, hunger: 50 }, full))
		expect(result.current.careEffects).toHaveLength(1)
		act(() => jest.advanceTimersByTime(CARE_EFFECT_MS))
		expect(result.current.careEffects).toEqual([])
	})

	it('shows nothing for a change too small to notice', () => {
		const { result } = renderHook(() => usePetReactions('cat'))
		act(() => result.current.showCareEffects(full, { ...full, happiness: 91 }))
		expect(result.current.careEffects).toEqual([])
	})

	it('leaves no timer running once Home is gone', () => {
		const { result, unmount } = renderHook(() => usePetReactions('cat'))
		act(() => {
			result.current.celebrate('play', true)
			result.current.showCareEffects({ ...full, energy: 40 }, full)
		})
		unmount()
		expect(jest.getTimerCount()).toBe(0)
	})
})
