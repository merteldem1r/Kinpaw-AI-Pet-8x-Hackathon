import { NEEDS, type Need, type Needs, type Species } from '@app/contract'

// What floats around the pet on Home after care (m5-home-core-loop-requirements.md, Decision 6):
// which changes are shown and how long each lives. Pure, so the hook that times them is tested
// without the components that draw them (components/pet/CareEffects, ReactionBursts).

// ─── Bursts ───────────────────────────────────────────────────────────────────

/** What floats up from the pet after a care action. */
export type BurstKind = 'pet' | 'feed' | 'play' | 'sleepy'
export type Burst = { id: number; kind: BurstKind; species: Species }

/** How long a burst lives, ms: its particles have faded by then and it can be dropped. */
export const BURST_MS = 1600

// ─── Care effects ─────────────────────────────────────────────────────────────

/** Which side of the pet each need's pill is on; its change rises from that side of the head. */
export type Side = 'left' | 'right'
const SIDE: Record<Need, Side> = {
	hunger: 'left',
	energy: 'left',
	happiness: 'right',
	affection: 'right'
}

/** One change a care action made, shown beside the pet's head on its need's side. */
export type CareEffect = { id: number; need: Need; up: boolean; side: Side }

/** How long an effect lives, ms: everything in it has faded by then and it can be dropped. */
export const CARE_EFFECT_MS = 2125
/** Smaller changes (Feed's and Pet's little lift to happiness) are left to the pills. */
const NOTICEABLE = 3

/**
 * What a care action changed, at most one per side: the biggest change on that side, and only
 * changes the eye would notice. `before` and `after` are the needs either side of the tap.
 */
export function careEffectsFor(before: Needs, after: Needs, nextId: () => number): CareEffect[] {
	const bySide = new Map<Side, { need: Need; delta: number }>()
	for (const need of NEEDS) {
		const delta = after[need] - before[need]
		if (Math.abs(delta) < NOTICEABLE) continue
		const current = bySide.get(SIDE[need])
		if (!current || Math.abs(delta) > Math.abs(current.delta)) {
			bySide.set(SIDE[need], { need, delta })
		}
	}
	return [...bySide.entries()].map(([side, { need, delta }]) => ({
		id: nextId(),
		need,
		up: delta > 0,
		side
	}))
}
