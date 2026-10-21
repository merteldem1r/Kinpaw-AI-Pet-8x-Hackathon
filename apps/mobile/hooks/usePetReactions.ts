import { useCallback, useEffect, useRef, useState } from 'react'
import type { Mood, Needs, Species } from '@app/contract'
import {
	BURST_MS,
	CARE_EFFECT_MS,
	careEffectsFor,
	type Burst,
	type BurstKind,
	type CareEffect
} from '@/lib/petEffects'

// The moving feedback around the pet on Home (m5-home-core-loop-requirements.md, Decision 6):
// what floats up after care or a reply, the face it keeps for a moment, and the chips that say
// which need changed. Each one clears itself after its animation.

/** How long the pet keeps a face for a moment (happy after care, sad after harsh words), ms. */
const MOMENT_MS = 900
/** At most this many bursts in the air at once; fast tapping drops the oldest. */
const MAX_BURSTS = 6

export function usePetReactions(species: Species | undefined) {
	const [bursts, setBursts] = useState<Burst[]>([])
	const [moment, setMoment] = useState<Mood | null>(null)
	const [careEffects, setCareEffects] = useState<CareEffect[]>([])
	const nextId = useRef(0)
	const momentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
	// Read when a reaction starts, so the callbacks below stay the same between renders.
	const speciesNow = useRef(species)
	speciesNow.current = species

	useEffect(() => {
		const pending = timers.current
		return () => {
			if (momentTimer.current) clearTimeout(momentTimer.current)
			for (const timer of pending) clearTimeout(timer)
		}
	}, [])

	const later = useCallback((run: () => void, ms: number) => {
		const timer = setTimeout(() => {
			timers.current.delete(timer)
			run()
		}, ms)
		timers.current.add(timer)
	}, [])

	/** A face for a moment: happy after care, sad after harsh words. A new one replaces it. */
	const showMoment = useCallback((mood: Mood) => {
		setMoment(mood)
		if (momentTimer.current) clearTimeout(momentTimer.current)
		momentTimer.current = setTimeout(() => setMoment(null), MOMENT_MS)
	}, [])

	/** Something floats up (hearts, treats, stars, z's), and with `cheer` a happy face. */
	const celebrate = useCallback(
		(kind: BurstKind | null, cheer: boolean) => {
			const current = speciesNow.current
			if (!current) return
			if (kind) {
				const id = ++nextId.current
				setBursts((shown) => [...shown.slice(-(MAX_BURSTS - 1)), { id, kind, species: current }])
				later(() => setBursts((shown) => shown.filter((b) => b.id !== id)), BURST_MS)
			}
			if (cheer) showMoment('happy')
		},
		[later, showMoment]
	)

	/** The chips beside the pet for what a care action changed: one per side, the newest wins. */
	const showCareEffects = useCallback(
		(before: Needs, after: Needs) => {
			const effects = careEffectsFor(before, after, () => ++nextId.current)
			if (effects.length === 0) return
			const ids = new Set(effects.map((e) => e.id))
			setCareEffects((shown) => [
				...shown.filter((e) => !effects.some((n) => n.side === e.side)),
				...effects
			])
			later(() => setCareEffects((shown) => shown.filter((e) => !ids.has(e.id))), CARE_EFFECT_MS)
		},
		[later]
	)

	return { bursts, moment, careEffects, celebrate, showMoment, showCareEffects }
}
