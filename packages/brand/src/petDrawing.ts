/**
 * A pet as plain shapes, in parts that can each move on their own
 * (docs/application/features/v2-pet-looks-requirements.md, R2–R3; v3-pet-looks-requirements.md,
 * R2): what the app's PetArt and the website's PetSvg both draw, each in a short loop, so a new
 * part is written once, here. Pure, from `petParts`.
 *
 * A renderer draws every part's `edge` first (the cream sticker edge runs under the whole pet),
 * then each part in `order`: its fill, its coat clipped to its own outline, what goes over the
 * coat. Each part moves about its `pivot`; at rest the parts make exactly the one still pet.
 *
 * The face (eyes, brows, mouth, tongue) is not here: it changes with the mood, and the app
 * animates the eyes, so each renderer draws it in the head part, after the head's own shapes.
 * Everything here is the same in every mood.
 */
import { PET_PATHS, type PetParts } from './pet'
import { circle, ellipse, path, polygon, type Gradient, type Paint, type Shape } from './shapes'

/** How much wider than each part the cream sticker edge is drawn. */
export const EDGE_STROKE = 10
/** How far past the silhouette the coat's markings may reach: inside the sticker edge. */
const CLIP_BLEED = 2

/** How see-through a cat's whiskers are, over its cheeks. */
const WHISKER_OPACITY = 0.4

/**
 * The light on a round part `reach` across from its middle: from the upper left, through the
 * fur's own colour, falling off to its low tone at the far side
 * (v3-pet-looks-requirements.md, R8).
 */
function lit(o: { cx: number; cy: number }, reach: number, k: PetParts['colors']): Gradient {
	return {
		cx: o.cx - reach * 0.25,
		cy: o.cy - reach * 0.42,
		r: reach * 1.6,
		stops: [
			{ offset: 0, color: k.highlight },
			{ offset: 0.45, color: k.fur },
			{ offset: 1, color: k.lowlight }
		]
	}
}

/** The parts that move on their own. The ears ride on the head; a paw lifts for a high five. */
export const PART_KEYS = [
	'tail',
	'body',
	'pawLeft',
	'pawRight',
	'head',
	'earLeft',
	'earRight'
] as const
export type PartKey = (typeof PART_KEYS)[number]

export type Point = { x: number; y: number }

export type DrawnPart = {
	/** Where it turns: the tail's root, the feet, a paw's middle, the neck, an ear's base. */
	pivot: Point
	/** Its share of the cream sticker edge, drawn under every part's fill. */
	edge: readonly Shape[]
	/** Under its coat. */
	fill: readonly Shape[]
	/** The outline its coat is clipped to; empty where no markings go (the tail, the ears). */
	clip: readonly Shape[]
	/**
	 * The coat's markings, clipped to `clip`, so their shapes can be drawn freely. The body and
	 * the head each draw all of them, so a marking that crosses the neck moves with both; where
	 * their outlines meet it is drawn twice, so every marking is opaque (a see-through one would
	 * look darker there).
	 */
	coat: readonly Shape[]
	/** Over its coat: the belly on the body, the muzzle and nose on the head. */
	over: readonly Shape[]
}

export type PetDrawing = {
	parts: Readonly<Record<PartKey, DrawnPart>>
	/** Back to front: a cat's ears sit behind its head, a dog's hang in front of it. */
	order: readonly PartKey[]
}

const ROUND = { strokeLinecap: 'round', strokeLinejoin: 'round' } as const

/**
 * Floppy, button and rose dog ears: a rotated oval each side (the right side's numbers; the
 * left mirrors them). `attach` is the end of the oval that meets the head: the top of a hanging
 * ear, the inner end of one folded sideways.
 */
export const DOG_EAR_OVALS = {
	floppy: { cx: 26, cy: -42, rx: 9, ry: 18, angle: 22, attach: 'top' },
	button: { cx: 19, cy: -60, rx: 10, ry: 7, angle: -30, attach: 'inner' },
	/** Rose: small, folded back and down at the sides of the head. */
	rose: { cx: 28, cy: -49, rx: 11, ry: 5.5, angle: -18, attach: 'inner' }
} as const

/** The stroke that rounds upright dog ears: Bat's are rounder than Perky's. */
const PERKY_ROUNDING = 9
const BAT_ROUNDING = 14

/** The left side, then the right: how every pair of ears is listed. */
const SIDES = [-1, 1] as const

/** Dog ears, left then right, in their colour, or as the sticker edge behind them. */
function dogEars(p: PetParts, fill: string, edge: boolean): Shape[] {
	if (!p.dogEars) return []
	const edgePaint: Paint = edge ? { stroke: fill, strokeWidth: EDGE_STROKE, ...ROUND } : {}
	if (p.dogEars === 'perky' || p.dogEars === 'bat') {
		// Upright ears are rounded by a stroke in their own colour, so their edge is wider still.
		const bat = p.dogEars === 'bat'
		const ears = bat ? PET_PATHS.dogEarsBat : PET_PATHS.dogEarsPerky
		const round = bat ? BAT_ROUNDING : PERKY_ROUNDING
		return ears.map((points) =>
			polygon(points, {
				fill,
				stroke: fill,
				strokeWidth: edge ? round + EDGE_STROKE : round,
				strokeLinejoin: 'round',
				...(edge ? { strokeLinecap: 'round' } : {})
			})
		)
	}
	const { cx, cy, rx, ry, angle } = DOG_EAR_OVALS[p.dogEars]
	return SIDES.map((side) =>
		ellipse(
			{ cx: side * cx, cy, rx, ry },
			{ fill, transform: `rotate(${-side * angle} ${side * cx} ${cy})`, ...edgePaint }
		)
	)
}

/** The numbers in a list of points ("x,y x,y …"), as points. */
function points(list: string): Point[] {
	return list.split(' ').map((pair) => {
		const [x, y] = pair.split(',').map(Number)
		return { x: x!, y: y! }
	})
}

/** The middle of an ear's base: its first and last corners (the tip is the middle one). */
function baseOf(list: string): Point {
	const corners = points(list)
	const first = corners[0]!
	const last = corners.at(-1)!
	return { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 }
}

/** Where each ear meets the head, left then right. */
function earPivots(p: PetParts): readonly [Point, Point] {
	if (p.catEars) return [baseOf(p.catEars.outer[0]), baseOf(p.catEars.outer[1])]
	if (p.dogEars === 'perky' || p.dogEars === 'bat') {
		const ears = p.dogEars === 'bat' ? PET_PATHS.dogEarsBat : PET_PATHS.dogEarsPerky
		return [baseOf(ears[0]), baseOf(ears[1])]
	}
	const { cx, cy, rx, ry, angle, attach } = DOG_EAR_OVALS[p.dogEars!]
	const pivot = (side: number): Point => {
		const turn = (-side * angle * Math.PI) / 180
		// The oval's end towards the head, before it is turned: up for a hanging ear, inwards
		// for a folded one.
		const [x, y] = attach === 'top' ? [0, -ry] : [-side * rx, 0]
		return {
			x: side * cx + x * Math.cos(turn) - y * Math.sin(turn),
			y: cy + x * Math.sin(turn) + y * Math.cos(turn)
		}
	}
	return [pivot(-1), pivot(1)]
}

/** The tufts on cat ears, one path per ear (left, right), or null. */
function tuftsBySide(tufts: string | null): readonly [string, string] | null {
	if (!tufts) return null
	// Each stroke starts with its own "M x y"; a left stroke starts left of the middle.
	const strokes = tufts.split(/(?=M)/).map((stroke) => stroke.trim())
	const left = strokes.filter((stroke) => Number(/^M(-?[\d.]+)/.exec(stroke)?.[1]) < 0)
	const right = strokes.filter((stroke) => !left.includes(stroke))
	return [left.join(' '), right.join(' ')]
}

/** Where the tail path starts: its root on the body. */
function tailRoot(p: PetParts): Point {
	const [, x, y] = /^M(-?[\d.]+) (-?[\d.]+)/.exec(p.tail.d)!
	return { x: Number(x) + p.tail.x, y: Number(y) }
}

/** Moves the tail to meet a narrower body; nothing for the others. */
function tailMove(p: PetParts): Paint {
	return p.tail.x ? { transform: `translate(${p.tail.x} 0)` } : {}
}

/** One ear's parts: its edge and its shapes, behind the head (a cat's) or in front (a dog's). */
function ear(p: PetParts, side: 0 | 1, pivot: Point): DrawnPart {
	const k = p.colors
	const edge = k.edge
	const solid: Paint = { fill: edge, stroke: edge, strokeWidth: EDGE_STROKE, ...ROUND }
	const line = (stroke: string, strokeWidth: number): Paint => ({
		fill: 'none',
		stroke,
		strokeWidth,
		strokeLinecap: 'round'
	})
	const none = { clip: [], coat: [], over: [] }
	if (p.catEars) {
		const tufts = tuftsBySide(p.catEars.tufts)?.[side]
		return {
			pivot,
			edge: [
				polygon(p.catEars.outer[side], solid),
				...(tufts ? [path(tufts, { ...solid, fill: 'none', strokeWidth: 6 })] : [])
			],
			fill: [
				polygon(p.catEars.outer[side], { fill: k.earOuter }),
				polygon(p.catEars.inner[side], { fill: k.earInner }),
				...(tufts ? [path(tufts, line(k.earOuter, 2.4))] : [])
			],
			...none
		}
	}
	return {
		pivot,
		edge: [dogEars(p, edge, true)[side]!],
		fill: [dogEars(p, k.earInner, false)[side]!],
		...none
	}
}

export function petDrawing(p: PetParts): PetDrawing {
	const k = p.colors
	const edge = k.edge
	const solid: Paint = { fill: edge, stroke: edge, strokeWidth: EDGE_STROKE, ...ROUND }
	const fur: Paint = { fill: k.fur }
	const line = (stroke: string, strokeWidth: number, extra: Paint = {}): Paint => ({
		fill: 'none',
		stroke,
		strokeWidth,
		strokeLinecap: 'round',
		...extra
	})
	// A little past the silhouette, under the sticker edge: a marking clipped exactly to the
	// outline would let a hairline of coat show through at its anti-aliased edge.
	const grow = (o: { cx: number; cy: number; rx: number; ry: number }) => ({
		...o,
		rx: o.rx + CLIP_BLEED,
		ry: o.ry + CLIP_BLEED
	})
	// The markings are drawn on both the body and the head, each clipped to its own outline:
	// a marking that crosses the neck shows on both, and moves with each.
	const coat = p.markings
	// One light for the body with its shoulders, one for the head with its cheek fluff.
	const bodyFur: Paint = { ...fur, gradient: lit(p.body, p.body.ry, k) }
	const headFur: Paint = { ...fur, gradient: lit(p.head, p.head.r, k) }

	const tail: DrawnPart = {
		pivot: tailRoot(p),
		edge: [
			path(p.tail.d, {
				...solid,
				fill: 'none',
				strokeWidth: p.tail.width + EDGE_STROKE,
				...tailMove(p)
			})
		],
		fill: [
			path(p.tail.d, line(k.tail, p.tail.width, tailMove(p))),
			...(p.tail.fluffyTip
				? [path(PET_PATHS.tailFluffyTip, line(k.shade, 5, { opacity: 0.5, ...tailMove(p) }))]
				: [])
		],
		clip: [],
		coat: [],
		over: []
	}

	const body: DrawnPart = {
		pivot: { x: 0, y: p.paws[0].cy + p.paws[0].ry },
		edge: [ellipse(p.body, solid), ...p.shoulders.map((shoulder) => ellipse(shoulder, solid))],
		fill: [ellipse(p.body, bodyFur), ...p.shoulders.map((shoulder) => ellipse(shoulder, bodyFur))],
		clip: [
			ellipse(grow(p.body), {}),
			...p.shoulders.map((shoulder) => ellipse(grow(shoulder), {}))
		],
		coat,
		over: [
			ellipse(p.belly, { fill: p.belly.fill }),
			...(p.muscles ? [path(p.muscles, line(k.shade, 1.6, { opacity: 0.6 }))] : [])
		]
	}

	// Each paw on its own, in front of the body, so it can lift.
	const paw = (o: (typeof p.paws)[number]): DrawnPart => ({
		pivot: { x: o.cx, y: o.cy },
		edge: [ellipse(o, solid)],
		fill: [ellipse(o, { fill: p.pawFill })],
		clip: [],
		coat: [],
		over: []
	})

	const head: DrawnPart = {
		pivot: { x: p.head.cx, y: p.head.cy + p.head.r },
		edge: [circle(p.head, solid), ...p.cheekFluff.map((tuft) => path(tuft, solid))],
		fill: [circle(p.head, headFur), ...p.cheekFluff.map((tuft) => path(tuft, headFur))],
		clip: [circle({ ...p.head, r: p.head.r + CLIP_BLEED }, {})],
		coat,
		over: [
			ellipse(p.muzzle, { fill: p.muzzle.fill }),
			...(p.whiskers ? [path(p.whiskers, line(k.ink, 0.6, { opacity: WHISKER_OPACITY }))] : []),
			p.isCat
				? polygon(PET_PATHS.catNose, { fill: k.nose })
				: ellipse({ cx: 0, cy: -33, rx: 5.5, ry: 4 }, { fill: k.nose })
		]
	}

	const [leftPivot, rightPivot] = earPivots(p)
	return {
		parts: {
			tail,
			body,
			pawLeft: paw(p.paws[0]),
			pawRight: paw(p.paws[1]),
			head,
			earLeft: ear(p, 0, leftPivot),
			earRight: ear(p, 1, rightPivot)
		},
		order: p.isCat
			? ['tail', 'body', 'pawLeft', 'pawRight', 'earLeft', 'earRight', 'head']
			: ['tail', 'body', 'pawLeft', 'pawRight', 'head', 'earLeft', 'earRight']
	}
}

/** Every painted shape of a drawing, in the order a renderer draws them (for checks and tests). */
export function drawingShapes(d: PetDrawing): Shape[] {
	return [
		...PART_KEYS.flatMap((key) => d.parts[key].edge),
		...d.order.flatMap((key) => {
			const part = d.parts[key]
			return [...part.fill, ...part.coat, ...part.over]
		})
	]
}
