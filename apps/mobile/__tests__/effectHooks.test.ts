/**
 * The two hooks that replace effects' dependency suppressions: `useMountEffect` runs once and
 * cleans up once, whatever re-renders; `useLatest` is one ref that always holds the last value.
 */
import { renderHook } from '@testing-library/react-native'
import { useLatest } from '@/hooks/useLatest'
import { useMountEffect } from '@/hooks/useMountEffect'

describe('useMountEffect', () => {
	it('runs once on mount and cleans up once on unmount, however often it re-renders', () => {
		const cleanup = jest.fn()
		const effect = jest.fn((_n: number) => cleanup)
		const { rerender, unmount } = renderHook(
			({ n }: { n: number }) => useMountEffect(() => effect(n)),
			{
				initialProps: { n: 1 }
			}
		)
		rerender({ n: 2 })
		rerender({ n: 3 })
		expect(effect).toHaveBeenCalledTimes(1)
		expect(effect).toHaveBeenCalledWith(1)
		expect(cleanup).not.toHaveBeenCalled()
		unmount()
		expect(cleanup).toHaveBeenCalledTimes(1)
	})
})

describe('useLatest', () => {
	it('keeps one ref, holding the value of the last render', () => {
		const { result, rerender } = renderHook(({ value }: { value: string }) => useLatest(value), {
			initialProps: { value: 'first' }
		})
		const ref = result.current
		rerender({ value: 'second' })
		expect(result.current).toBe(ref)
		expect(ref.current).toBe('second')
	})
})
