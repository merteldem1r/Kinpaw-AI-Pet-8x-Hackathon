import { useRef } from 'react'

/**
 * A ref that always holds `value` as of the last render. For an effect that reads a value
 * without following it: the effect runs on what it watches, and reads `.current` for the rest.
 * The ref itself never changes, so listing it as a dependency re-runs nothing.
 */
export function useLatest<T>(value: T) {
	const ref = useRef(value)
	ref.current = value
	return ref
}
