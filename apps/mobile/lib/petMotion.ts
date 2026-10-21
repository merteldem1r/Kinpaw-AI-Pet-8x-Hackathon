import type { EarId, Mood, PetAppearance, TailId } from '@app/contract'

// How each part of the pet moves, by species and mood (docs/application/features/
// v3-pet-looks-requirements.md, R3–R5): the numbers only, so they can be tuned and tested in one
// place. usePetBehaviour plays them on the pose; PetArt turns the parts by them.
//
// Angles are degrees, clockwise on screen. The tail sits on the pet's right and curls up, so a
// positive turn lowers it and a negative one lifts it. An ear's positive turn is outward (the
// left ear to the left): out and down, as a sad pet's ears go.

/** A swing of the tail either side of where it rests. */
export type Swing = {
	/** How far it swings each way, degrees; 0 holds it still. */
	swing: number
	/** Half a swing, ms. */
	halfMs: number
}

/**
 * How the tail moves in a mood: where it rests, its calm motion, and now and then a burst. A tail
 * never wags nonstop: a happy dog wags in bursts of a few quick wags, then sways calmly (Mert,
 * 2026-10-09: a fast wag all the time looked wrong).
 */
export type TailMotion = {
	/** Its resting angle: below 0 held up, above 0 hanging low. */
	rest: number
	/** The motion between bursts: a slow sway, or still. */
	calm: Swing
	/** A few quick swings now and then (a wag, a cat's quiver or flick); null for none. */
	burst: (Swing & { count: readonly [number, number]; every: readonly [number, number] }) | null
}

/**
 * A dog sways its tail and wags it in bursts: often and wide when happy, now and then when
 * content. A cat swishes slowly when content, with a flick now and then, and holds its tail up
 * when happy, the tip quivering in bursts. Either hangs its tail when sad and lets it rest when
 * sleepy.
 */
const TAIL: Record<'cat' | 'dog', Record<Mood, TailMotion>> = {
	dog: {
		happy: {
			rest: -4,
			calm: { swing: 4, halfMs: 900 },
			burst: { swing: 13, halfMs: 170, count: [3, 6], every: [2500, 6000] }
		},
		content: {
			rest: 0,
			calm: { swing: 5, halfMs: 1100 },
			burst: { swing: 9, halfMs: 220, count: [2, 3], every: [8000, 16000] }
		},
		sad: { rest: 18, calm: { swing: 2, halfMs: 1800 }, burst: null },
		sleepy: { rest: 10, calm: { swing: 0, halfMs: 0 }, burst: null }
	},
	cat: {
		happy: {
			rest: -10,
			calm: { swing: 2, halfMs: 1500 },
			burst: { swing: 3, halfMs: 110, count: [4, 8], every: [3000, 7000] }
		},
		content: {
			rest: 0,
			calm: { swing: 7, halfMs: 1600 },
			burst: { swing: 10, halfMs: 450, count: [1, 2], every: [9000, 18000] }
		},
		sad: { rest: 16, calm: { swing: 2, halfMs: 2000 }, burst: null },
		sleepy: { rest: 10, calm: { swing: 0, halfMs: 0 }, burst: null }
	}
}

/** A short tail moves less, a curled one a little less: their tips are near their roots. */
const TAIL_SWING: Record<TailId, number> = { long: 1, fluffy: 1, plume: 1, curly: 0.7, bob: 0.5 }

export function tailMotion(a: Pick<PetAppearance, 'species' | 'tail'>, mood: Mood): TailMotion {
	const { rest, calm, burst } = TAIL[a.species][mood]
	const share = TAIL_SWING[a.tail]
	return {
		rest,
		calm: { ...calm, swing: calm.swing * share },
		burst: burst ? { ...burst, swing: burst.swing * share } : null
	}
}

/** How the ears sit and move in a mood. */
export type EarMotion = {
	/** Where they rest: 0 upright (or hanging, for floppy ears), above 0 out and down. */
	rest: number
	/** How far a twitch flicks one ear out. */
	twitch: number
	/** How far they swing out as the pet rises in a hop; they settle back with a spring. */
	hopSwing: number
	/** Where they go when the pet perks up (tapped, listening): in and up. */
	perk: number
}

/** Ears that hang or fold (and a cat's folded ears) move less than upright ones. */
const HANGING: ReadonlySet<EarId> = new Set(['floppy', 'button', 'rose', 'folded'])

/** How far the ears go out and down by mood, for upright ears (hanging ones go a third). */
const EAR_REST: Record<Mood, number> = { happy: -2, content: 0, sad: 14, sleepy: 8 }

export function earMotion(a: Pick<PetAppearance, 'ears'>, mood: Mood): EarMotion {
	const hanging = HANGING.has(a.ears)
	const share = hanging ? 1 / 3 : 1
	return {
		rest: EAR_REST[mood] * share,
		twitch: hanging ? 6 : 10,
		// Hanging ears are the ones a hop throws about.
		hopSwing: hanging ? 12 : 4,
		perk: hanging ? -2 : -6
	}
}

/** Ears twitch every this many ms, at random (never during a move). */
export const EAR_TWITCH_EVERY: [number, number] = [4000, 10000]

/** While the mic is held the pet listens: its head tilts this far, degrees. */
export const LISTEN_TILT = -8

/** While it speaks its head nods: this far down (drawing units), each half nod this long. */
export const NOD = { depth: 1.4, halfMs: 210 } as const

/**
 * How far the head follows the eyes: when they look to one side, the head moves a little that
 * way (drawing units) and tilts a little (degrees). A first hint of depth.
 */
export const HEAD_FOLLOW = { shift: 1.4, tilt: 3 } as const

// ─── How the drawing answers the pose: the same in both renderers (PetArt, PetCanvas) ───

/** How far a look moves the eye and, further, the pupil, in drawing units. */
export const LOOK_IRIS = 1.2
export const LOOK_PUPIL = 1.8
/** How much less the eyes move up and down than side to side. */
export const LOOK_Y = 0.7
/** An eye never shuts flatter than this share of its height: a blink leaves a line. */
export const EYE_FLAT = 0.06
/** Below this openness the eye reads as shut: the lid line shows. */
export const EYE_SHUT = 0.25
/** Below this openness the glints go: a closing eye catches no light. */
export const GLINT_GONE = 0.6
/** How far a lifted paw turns, degrees for each unit it rises. */
export const PAW_TURN = 1.5
/** How far open the mouth is before its line has gone: the open mouth takes over from there. */
export const MOUTH_LINE_GONE = 0.2
/** How far open the mouth is before it shows at all, and before the tongue does. */
export const MOUTH_SHOWS = 0.04
export const TONGUE_SHOWS = 0.3
