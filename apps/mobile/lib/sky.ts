/**
 * The part of day, by fixed local clock hours: morning 05–12, afternoon 12–17,
 * evening 17–21, night 21–05. The sky, Home's eyebrow and Welcome all use these
 * (docs/application/UI/kinpaw-screen-spec-v1.md, "Header and bubble lines").
 */
import { useEffect, useState } from 'react'
import type { Scheme, SkyPhase } from '@app/brand'

/** How often a mounted screen re-checks the phase. */
const PHASE_CHECK_MS = 60_000

export function phaseAt(date: Date): SkyPhase {
	const hour = date.getHours()
	if (hour >= 5 && hour < 12) return 'morning'
	if (hour >= 12 && hour < 17) return 'afternoon'
	if (hour >= 17 && hour < 21) return 'evening'
	return 'night'
}

/** The scheme the app takes at a phase: light by day, dark from the evening on. */
export function schemeForPhase(phase: SkyPhase): Scheme {
	return phase === 'morning' || phase === 'afternoon' ? 'light' : 'dark'
}

/** The current phase, re-checked once a minute while the screen is mounted. */
export function useSkyPhase(): SkyPhase {
	const [phase, setPhase] = useState(() => phaseAt(new Date()))
	useEffect(() => {
		const id = setInterval(() => setPhase(phaseAt(new Date())), PHASE_CHECK_MS)
		return () => clearInterval(id)
	}, [])
	return phase
}

// ─── The moon ────────────────────────────────────────────────────────────────

/** The synodic month, days, and a known new moon (2000-01-06 18:14 UTC). */
const SYNODIC_DAYS = 29.530588853
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14)
const DAY_MS = 86_400_000

/**
 * Where the moon is in its cycle on `date`: 0 new, 0.25 first quarter, 0.5
 * full, 0.75 last quarter. Accurate to about a day, which is all a drawing needs.
 */
export function moonPhaseAt(date: Date): number {
	const days = (date.getTime() - KNOWN_NEW_MOON_MS) / DAY_MS
	const cycle = (days / SYNODIC_DAYS) % 1
	return cycle < 0 ? cycle + 1 : cycle
}

/** A crescent never thinner than this share of the radius, so the moon never vanishes. */
const MIN_CRESCENT = 0.28

/**
 * The lit part of the moon at `phase` (0 new, 0.5 full) in a box of 2R: one
 * half of the disc plus the terminator, an ellipse arc. Waxing is lit on the
 * right. A crescent is kept at least MIN_CRESCENT wide.
 */
export function moonPath(phase: number, r: number): string {
	const c = Math.cos(2 * Math.PI * phase)
	const crescent = c > 0
	const rx = crescent ? Math.min(r * c, r * (1 - MIN_CRESCENT)) : r * -c
	const waxing = phase < 0.5
	const half = waxing ? 1 : 0
	const back = waxing ? (crescent ? 0 : 1) : crescent ? 1 : 0
	return `M${r} 0 A${r} ${r} 0 0 ${half} ${r} ${2 * r} A${rx} ${r} 0 0 ${back} ${r} 0 Z`
}
