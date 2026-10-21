import { useEffect, type EffectCallback } from 'react'

/**
 * Runs `effect` once, when the component mounts, and its cleanup when it unmounts: a screen's
 * "viewed" event, an entrance animation, a draft's step. Whatever it reads, it reads as it is at
 * that moment, on purpose; an effect that should follow a value is a `useEffect` on that value.
 */
export function useMountEffect(effect: EffectCallback) {
	// The one place an effect leaves its dependencies out: the name says it runs once.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(effect, [])
}
