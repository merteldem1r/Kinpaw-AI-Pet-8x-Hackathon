import { useRef } from 'react'
import { useSharedValue, type SharedValue } from 'react-native-reanimated'

// The pet's pose (docs/application/features/v3-pet-looks-requirements.md, R1): every value that
// moves a pet on Home, in one place. The behaviour (hooks/usePetBehaviour.ts) and the gestures
// (PetStage) write it; the drawing (PetArt) only reads it, so a later renderer reads the same
// pose. All of them are Reanimated shared values: a pet moves on the UI thread, never by a React
// render.

export type PetPose = {
	// ─ The whole pet (PetStage moves its view) ─
	/** 0 to 1 and back: one breath. */
	breath: SharedValue<number>
	/** How far a breath lifts it, pt (by mood). */
	amp: SharedValue<number>
	/** How far it sinks when low, pt (by mood). */
	slump: SharedValue<number>
	/** How high it is off the ground, pt (a hop, or below 0 for a crouch or a sigh). */
	hop: SharedValue<number>
	/** Squash and stretch: 1 is its own shape. */
	squashX: SharedValue<number>
	squashY: SharedValue<number>
	/** Leaning, degrees (towards a stroking finger, a sway). */
	lean: SharedValue<number>
	/** The purr's shiver, degrees. */
	purr: SharedValue<number>

	// ─ The eyes ─
	/** 1 open to 0 shut: a blink, a yawn. */
	open: SharedValue<number>
	/** Where they look, -1 to 1 on each axis (right, down). */
	lookX: SharedValue<number>
	lookY: SharedValue<number>
	/** How much deeper than its mood's the cheeks blush, 0 to 1: a stroke, a pat, a hug. */
	blush: SharedValue<number>

	// ─ The parts (PetArt turns each about its pivot, in the drawing's units) ─
	/** The head's tilt about the neck, degrees (clockwise on screen). The ears ride on it. */
	headTilt: SharedValue<number>
	/** The head's nod, drawing units (down). */
	headNod: SharedValue<number>
	/** Each ear's turn about its base, degrees (outward: the left ear to the left). */
	earLeft: SharedValue<number>
	earRight: SharedValue<number>
	/** The tail's swing about its root, degrees (clockwise on screen). */
	tail: SharedValue<number>
	/** How open the mouth is, 0 shut to 1 wide: speaking, a meow. */
	jaw: SharedValue<number>
	/** How far each paw is lifted, drawing units (a high five). */
	pawLeft: SharedValue<number>
	pawRight: SharedValue<number>
}

/** The eyes' part of the pose: all a still drawing with living eyes needs. */
export type EyeMotion = Pick<PetPose, 'open' | 'lookX' | 'lookY'>

/** A new pose, at rest. Stable for the component's life. */
export function usePetPose(): PetPose {
	const pose: PetPose = {
		breath: useSharedValue(0),
		amp: useSharedValue(0),
		slump: useSharedValue(0),
		hop: useSharedValue(0),
		squashX: useSharedValue(1),
		squashY: useSharedValue(1),
		lean: useSharedValue(0),
		purr: useSharedValue(0),
		open: useSharedValue(1),
		lookX: useSharedValue(0),
		lookY: useSharedValue(0),
		blush: useSharedValue(0),
		headTilt: useSharedValue(0),
		headNod: useSharedValue(0),
		earLeft: useSharedValue(0),
		earRight: useSharedValue(0),
		tail: useSharedValue(0),
		jaw: useSharedValue(0),
		pawLeft: useSharedValue(0),
		pawRight: useSharedValue(0)
	}
	// The shared values are stable; the object holding them is kept too, so it can be a dependency.
	return useRef(pose).current
}

/** An SVG transform matrix, [a b c d e f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matrix = readonly [number, number, number, number, number, number]

/** Turn `degrees` (clockwise on screen) about (px, py), then move by (dx, dy). */
export function turnAbout(px: number, py: number, degrees: number, dx = 0, dy = 0): Matrix {
	'worklet'
	const r = (degrees * Math.PI) / 180
	const cos = Math.cos(r)
	const sin = Math.sin(r)
	return [cos, sin, -sin, cos, px - cos * px + sin * py + dx, py - sin * px - cos * py + dy]
}

/** `outer` after `inner`: an ear turned on its own base, then carried by the head. */
export function compose(outer: Matrix, inner: Matrix): Matrix {
	'worklet'
	const [a, b, c, d, e, f] = outer
	const [g, h, i, j, k, l] = inner
	return [
		a * g + c * h,
		b * g + d * h,
		a * i + c * j,
		b * i + d * j,
		a * k + c * l + e,
		b * k + d * l + f
	]
}
