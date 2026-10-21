// The light on the Skia pet (docs/application/features/v3-pet-looks-plan.md, B2): the shader as
// text and the numbers it is given. No Skia here, so a test can compile the shader and check
// what it is handed without a device, and nothing that imports this loads Skia.
//
// The look is "Puppet", Mert's pick of nine finishes on 2026-10-12: a felted puppet on a set.
// Matte, a fine speckle, the deepest form: each part a soft solid that shadows the next.

import {
	art,
	parseColor,
	type PetDrawing,
	type PetParts,
	type PartKey,
	type Shape
} from '@app/brand'

/**
 * The look's numbers, each 0 (none) to 1 (the most the shader gives). To change how the pet
 * looks, change these; `soften` is how far the shapes' edges blur, in pet units.
 */
export const PUPPET = {
	/** How far the light wraps round a part: low is a hard ball, high a soft cushion. */
	wrap: 0.45,
	/** How much darker the side away from the light is. */
	depth: 0.42,
	/** The core shadow: a darker band just past where the light ends, as on a real solid. */
	core: 0.9,
	/** Light bounced up from the ground onto a part's shaded underside. */
	bounce: 0.85,
	/** The sky's light from behind, on a part's far edge. */
	glow: 0.2,
	/** Fuzz catching the light at a part's edges. */
	sheen: 0.15,
	/** Darkening into a part's edges, as matte felt does. */
	occlude: 0.6,
	/** A soft highlight, as on something smooth: none on felt. */
	gloss: 0,
	/** Fine speckle: the nap of felt. No grain with a direction: that reads as wood. */
	speck: 0.6,
	/** Soft mottling: tufts. */
	tuft: 0.15,
	/** Warm where the light falls, cool in the shade. */
	warm: 0.55,
	/** Towards pastel. */
	lift: 0.02,
	soften: 0.25
} as const

/**
 * One shape's paint, given the rounded part it lies on (`c`, `r`), its colour and the look's
 * numbers. A soft key light from the upper left wraps round the part, with a core shadow past
 * where it ends and the ground's light bounced into the shade; fuzz lightens the part's edges
 * and matte darkens them; the sky glows on its far edge; speckle and tufts; and up to three
 * soft round shadows cast on it by the parts beside it.
 */
export const PET_LIGHT = `
uniform vec2 c;
uniform vec2 r;
uniform vec3 base;
uniform vec3 rim;
uniform vec4 cast0;
uniform vec4 cast1;
uniform vec4 cast2;
uniform float wrap;
uniform float depth;
uniform float core;
uniform float bounce;
uniform float glow;
uniform float sheen;
uniform float occlude;
uniform float gloss;
uniform float speck;
uniform float tuft;
uniform float warm;
uniform float lift;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
		f.y);
}

// How deep in a round shadow a point is: 0 outside it, rising softly to its strength inside.
// (Not named cast: that is a reserved word in SkSL.)
float shade(vec4 blot, vec2 p) {
	return blot.w * (1.0 - smoothstep(blot.z * 0.25, blot.z, distance(p, blot.xy)));
}

half4 main(vec2 p) {
	vec2 d = (p - c) / r;
	float rr = min(dot(d, d), 1.0);
	float z = sqrt(1.0 - rr);
	vec3 n = normalize(vec3(d * 0.85, z + 0.4));
	vec3 L = normalize(vec3(-0.42, -0.72, 0.7));
	float lambert = (dot(n, L) + wrap) / (1.0 + wrap);
	float light = smoothstep(0.0, 1.0, lambert);

	vec3 col = mix(base, vec3(1.0), lift);
	col *= mix(1.0 - depth, 1.0 + depth * 0.4, light);
	float band = exp(-pow((lambert - 0.2) / 0.17, 2.0));
	col *= 1.0 - core * 0.13 * band;
	col *= mix(vec3(1.0), mix(vec3(0.92, 0.95, 1.08), vec3(1.06, 1.0, 0.92), light), warm);
	col *= 1.0 - occlude * rr * rr * 0.3;

	float edge = pow(rr, 1.5) * sheen * (0.35 + 0.65 * light);
	col = mix(col, mix(col, vec3(1.0), 0.5) + rim * 0.06, edge);

	float under = pow(rr, 1.6) * (1.0 - light) * smoothstep(-0.3, 0.7, d.y);
	col += base * vec3(1.1, 1.0, 0.88) * bounce * 0.24 * under;
	float behind = pow(rr, 2.2) * smoothstep(-0.2, 0.9, dot(normalize(d + vec2(0.0001)), vec2(0.8, 0.3)));
	col += rim * glow * 0.4 * behind;

	vec2 g = (d - vec2(-0.36, -0.42)) * vec2(1.0, 1.3);
	col += gloss * 0.2 * (1.0 - smoothstep(0.0, 0.5, length(g)));

	float fine = noise(p * 3.1) * 0.6 + noise(p * 6.7 + 13.0) * 0.4 - 0.5;
	float soft = noise(p * 0.24) * 0.6 + noise(p * 0.55 + 7.0) * 0.4 - 0.5;
	col *= 1.0 + fine * speck * 0.14 + soft * tuft * 0.22;

	float dark = 1.0 - (1.0 - shade(cast0, p)) * (1.0 - shade(cast1, p)) * (1.0 - shade(cast2, p));
	col *= 1.0 - dark;
	col *= mix(vec3(1.0), vec3(0.94, 0.97, 1.07), dark * warm);
	return half4(clamp(col, vec3(0.0), vec3(1.0)), 1.0);
}
`

/** A colour as a shader takes it: red, green and blue from 0 to 1. */
export function rgb(colour: string): [number, number, number] {
	const { r, g, b } = parseColor(colour)
	return [r / 255, g / 255, b / 255]
}

/** The sky's light on a part's far edge: the evening's warm band. B2 takes it from the hour. */
export const RIM = rgb(art.sky.evening.stops[2])

/** A rounded part as the shader takes it: its middle and its radii, in pet space. */
export type Round = { c: [number, number]; r: [number, number] }

/** A round shadow cast on a part: its middle, its reach and how dark, as the shader takes it. */
export type Cast = [number, number, number, number]
const NO_CAST: Cast = [0, 0, 1, 0]
/** The shadows cast on one part: the shader takes three. */
export type Casts = readonly [Cast, Cast, Cast]

/** The box a shape lies in, with its stroke, before any transform of its own. */
function boxOf(shape: Shape): [number, number, number, number] {
	const a = shape.attrs
	const pad = a.stroke && a.stroke !== 'none' ? (a.strokeWidth ?? 1) / 2 : 0
	const box = (xs: number[], ys: number[]): [number, number, number, number] => [
		Math.min(...xs) - pad,
		Math.min(...ys) - pad,
		Math.max(...xs) + pad,
		Math.max(...ys) + pad
	]
	switch (shape.kind) {
		case 'ellipse': {
			const { cx, cy, rx, ry } = shape.attrs
			return box([cx - rx, cx + rx], [cy - ry, cy + ry])
		}
		case 'circle': {
			const { cx, cy, r } = shape.attrs
			return box([cx - r, cx + r], [cy - r, cy + r])
		}
		case 'path':
		case 'polygon': {
			const text = shape.kind === 'path' ? shape.attrs.d : shape.attrs.points
			const pairs = [...text.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)]
			return box(
				pairs.map((pair) => Number(pair[1])),
				pairs.map((pair) => Number(pair[2]))
			)
		}
	}
}

/** How much wider than its shapes' box a part's round is: an oval inside a box misses its corners. */
const ROUND_REACH = 1.25

/**
 * Every part as a round: the head and the body their own, the rest (the tail, the ears, the
 * paws) the oval about their shapes, so nothing on the pet is left flat.
 */
export function partRounds(p: PetParts, drawing: PetDrawing): Record<PartKey, Round> {
	const about = (key: PartKey): Round => {
		const boxes = drawing.parts[key].fill.map(boxOf)
		const [x0, y0, x1, y1] = [
			Math.min(...boxes.map((box) => box[0])),
			Math.min(...boxes.map((box) => box[1])),
			Math.max(...boxes.map((box) => box[2])),
			Math.max(...boxes.map((box) => box[3]))
		]
		return {
			c: [(x0 + x1) / 2, (y0 + y1) / 2],
			r: [((x1 - x0) / 2) * ROUND_REACH, ((y1 - y0) / 2) * ROUND_REACH]
		}
	}
	return {
		tail: about('tail'),
		body: { c: [p.body.cx, p.body.cy], r: [p.body.rx, p.body.ry] },
		pawLeft: about('pawLeft'),
		pawRight: about('pawRight'),
		head: { c: [p.head.cx, p.head.cy], r: [p.head.r, p.head.r] },
		earLeft: about('earLeft'),
		earRight: about('earRight')
	}
}

/** How dark each shadow is, at its deepest. */
const SHADOW = {
	headOnBody: 0.38,
	paw: 0.24,
	bodyOnTail: 0.4,
	headOnEars: 0.3,
	muzzle: 0.2,
	ear: 0.24
}

/** The largest of a round's two radii: how far its shadow reaches. */
const reach = (round: Round) => Math.max(round.r[0], round.r[1])

/**
 * The shadows the parts beside it cast on a part, in the part's own space, at rest: the head and
 * the paws on the body, the body on the tail where it comes out from behind, a cat's head on its
 * ears, a dog's ears and the muzzle on the head.
 */
export function castsOn(key: PartKey, p: PetParts, rounds: Record<PartKey, Round>): Casts {
	switch (key) {
		case 'body': {
			// Each paw sits against the body: a small shadow round it.
			const paw = (o: { cx: number; cy: number; rx: number }): Cast => [
				o.cx,
				o.cy - 2,
				o.rx * 1.6,
				SHADOW.paw
			]
			return [
				[p.head.cx + 2, p.head.cy + 9, p.head.r * 1.15, SHADOW.headOnBody],
				paw(p.paws[0]),
				paw(p.paws[1])
			]
		}
		case 'tail':
			// Its shapes may be moved (a small body): the shadow is moved back with them.
			return [
				[p.body.cx + 4 - p.tail.x, p.body.cy + 8, p.body.rx * 1.35, SHADOW.bodyOnTail],
				NO_CAST,
				NO_CAST
			]
		case 'earLeft':
		case 'earRight': {
			// A cat's ears stand behind its head; a dog's hang in front of it, and take none.
			const head: Cast = [p.head.cx, p.head.cy, p.head.r * 1.3, SHADOW.headOnEars]
			return [p.isCat ? head : NO_CAST, NO_CAST, NO_CAST]
		}
		case 'head': {
			const muzzle: Cast = [p.muzzle.cx, p.muzzle.cy + 3, p.muzzle.rx * 1.45, SHADOW.muzzle]
			if (p.isCat) return [muzzle, NO_CAST, NO_CAST]
			const ear = (round: Round): Cast => [
				round.c[0] * 0.9,
				round.c[1] + 2,
				reach(round) * 0.85,
				SHADOW.ear
			]
			return [muzzle, ear(rounds.earLeft), ear(rounds.earRight)]
		}
		default:
			return [NO_CAST, NO_CAST, NO_CAST]
	}
}

/**
 * A shape that stands out from its part as a round of its own: the muzzle on the head, the
 * belly on the body. Wider than the shape, so it swells rather than sitting on it as a ball.
 */
export function ownRound(key: PartKey, shape: Shape): Round | null {
	if (shape.kind !== 'ellipse' || (key !== 'head' && key !== 'body')) return null
	const swell = key === 'head' ? 1.3 : 1.7
	const { cx, cy, rx, ry } = shape.attrs
	return { c: [cx, cy], r: [rx * swell, ry * swell] }
}

/** What the shader is given for one shape of `colour` on a part. */
export function lightUniforms(round: Round, colour: string, casts: Casts) {
	const { soften: _soften, ...look } = PUPPET
	return {
		...round,
		base: rgb(colour),
		rim: RIM,
		cast0: casts[0],
		cast1: casts[1],
		cast2: casts[2],
		...look
	}
}
