/**
 * Where a touch lands on a pet (docs/application/features/v3-pet-looks-requirements.md, R7):
 * its nose, chin, an ear, its head, a paw, its belly, its tail, or its back. Pure, from the pet's
 * shapes at rest, so the app's touch and VoiceOver agree and tests can check every pet.
 */
import { PET_PATHS, type PetParts } from './pet'
import { DOG_EAR_OVALS } from './petDrawing'

export const ZONES = ['head', 'chin', 'nose', 'ear', 'belly', 'paw', 'tail', 'back'] as const
export type Zone = (typeof ZONES)[number]

/** Where pet space sits in the drawing's 200-unit box: translate(96 118) scale(1.25). */
const ORIGIN = { x: 96, y: 118 } as const
const SCALE = 1.25
const VIEW = 200

/** A point on a pet drawn `size` points square, in pet space (the units `petParts` uses). */
export function toPetSpace(x: number, y: number, size: number): { x: number; y: number } {
	const k = VIEW / size
	return { x: (x * k - ORIGIN.x) / SCALE, y: (y * k - ORIGIN.y) / SCALE }
}

/** A finger is wider than a nose: a touch this near a small part counts as on it. */
const REACH = 3

type Oval = { cx: number; cy: number; rx: number; ry: number }

const inOval = (o: Oval, x: number, y: number, grow = 0) =>
	((x - o.cx) / (o.rx + grow)) ** 2 + ((y - o.cy) / (o.ry + grow)) ** 2 <= 1

/** Whether (x, y) is inside a polygon's points ("x,y x,y …"), by the crossing rule. */
function inPolygon(points: string, x: number, y: number): boolean {
	const corners = points.split(' ').map((pair) => pair.split(',').map(Number) as [number, number])
	let inside = false
	for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
		const [xi, yi] = corners[i]!
		const [xj, yj] = corners[j]!
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
	}
	return inside
}

function onEar(p: PetParts, x: number, y: number): boolean {
	if (p.catEars) return p.catEars.outer.some((points) => inPolygon(points, x, y))
	if (p.dogEars === 'perky' || p.dogEars === 'bat') {
		const ears = p.dogEars === 'bat' ? PET_PATHS.dogEarsBat : PET_PATHS.dogEarsPerky
		return ears.some((points) => inPolygon(points, x, y))
	}
	if (!p.dogEars) return false
	const { cx, cy, rx, ry, angle } = DOG_EAR_OVALS[p.dogEars]
	return [-1, 1].some((side) => {
		// Turn the point back by the ear's angle (petDrawing turns each by -side × angle), then test
		// the upright oval.
		const turn = (side * angle * Math.PI) / 180
		const dx = x - side * cx
		const dy = y - cy
		const ux = dx * Math.cos(turn) - dy * Math.sin(turn)
		const uy = dx * Math.sin(turn) + dy * Math.cos(turn)
		return inOval({ cx: 0, cy: 0, rx, ry }, ux, uy, REACH)
	})
}

/**
 * The zone at (x, y) in pet space, front to back: what lies on top wins (the nose over the chin,
 * the chin over the head, a paw over the belly). Off the pet, its back: a tap beside it still
 * reaches it.
 */
export function zoneAt(p: PetParts, x: number, y: number): Zone {
	const nose = { cx: 0, cy: -33 }
	if (Math.hypot(x - nose.cx, y - nose.cy) <= 4 + REACH) return 'nose'
	if (inOval(p.muzzle, x, y)) return 'chin'
	// A dog's ears hang in front of its head; a cat's stand above it.
	if (!p.isCat && onEar(p, x, y)) return 'ear'
	if (Math.hypot(x - p.head.cx, y - p.head.cy) <= p.head.r) return 'head'
	if (p.isCat && onEar(p, x, y)) return 'ear'
	if (p.paws.some((paw) => inOval(paw, x, y, REACH))) return 'paw'
	if (inOval(p.belly, x, y)) return 'belly'
	if (inOval(p.body, x, y) || p.shoulders.some((shoulder) => inOval(shoulder, x, y))) return 'back'
	// The tail curls up on the pet's right, beside the body.
	if (x > p.body.cx + p.body.rx * 0.6 && y > p.head.cy) return 'tail'
	return 'back'
}
