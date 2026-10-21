import { useCallback, useEffect, useRef } from 'react'

// Left alone on Home for a minute, the pet does something to say so (m5-home-core-loop-
// requirements.md): once per quiet spell, and again only after someone has touched anything.

/** Nobody has touched anything for this long: the pet nudges, ms. */
const IGNORED_MS = 60_000
const IGNORED_CHECK_MS = 5_000

/**
 * Calls `onIdle` once after a minute without a `touched()` while `active` (Home focused, a pet
 * shown). Returns `touched`, for every tap, word or gesture on the screen.
 */
export function useIdleNudge(active: boolean, onIdle: () => void) {
	const lastTouch = useRef(Date.now())
	const nudged = useRef(false)
	const latest = useRef(onIdle)
	latest.current = onIdle

	const touched = useCallback(() => {
		lastTouch.current = Date.now()
		nudged.current = false
	}, [])

	useEffect(() => {
		if (!active) return
		const id = setInterval(() => {
			if (nudged.current || Date.now() - lastTouch.current < IGNORED_MS) return
			nudged.current = true
			latest.current()
		}, IGNORED_CHECK_MS)
		return () => clearInterval(id)
	}, [active])

	return touched
}
