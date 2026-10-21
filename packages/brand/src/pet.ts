/**
 * The shapes of a pet: what PetArt draws for an appearance in a mood
 * (docs/application/features/m4b-pet-builder-requirements.md, R3; from the
 * designer's pet builder). Pure, so PetArt memoizes it and tests can check it.
 * It lives here, beside the colours, so the app's PetArt and the website draw
 * the same pet from one source.
 *
 * Coordinates are in pet space, centred on the body and drawn inside viewBox
 * 0 0 200 200 at translate(96 118) scale(1.25); the feet rest near y 185. The
 * colours are @app/brand's `art.pet`: none is written here.
 */
import type {
	BodyId,
	CatEarId,
	DogEarId,
	EyeId,
	FurId,
	Mood,
	PatternId,
	PetAppearance,
	TailId,
	WhiteId
} from '@app/contract'
import { art, type FurArt } from './art'
import { composite, withAlpha } from './color'
import { circle, ellipse, path, type Shape } from './shapes'

export type Oval = { cx: number; cy: number; rx: number; ry: number }
export type Dot = { cx: number; cy: number; r: number }

export type EyeParts = { kind: 'dot' | 'iris'; fill: string }

export type PetParts = {
	isCat: boolean
	mood: Mood
	shadowRx: number
	/** `x` moves the tail sideways, to meet a narrower body (Tiny). */
	tail: { d: string; width: number; fluffyTip: boolean; x: number }
	body: Oval & { cx: number }
	/** Broad shoulders either side of the top of the body (Buff); empty otherwise. */
	shoulders: readonly Oval[]
	/** Pec and ab lines drawn on the belly in the fur's shade (Buff); null otherwise. */
	muscles: string | null
	paws: readonly [Oval, Oval]
	pawFill: string
	head: Dot
	catEars: {
		outer: readonly [string, string]
		inner: readonly [string, string]
		/** The tuft lines on the tips (Tufted, Lynx), or null. */
		tufts: string | null
	} | null
	dogEars: DogEarId | null
	/**
	 * The coat's markings, in pet space, clipped to the body and head when drawn: the pattern in
	 * its colour, then the white markings over it.
	 */
	markings: readonly Shape[]
	belly: Oval & { fill: string }
	muzzle: Oval & { fill: string }
	eyes: readonly [EyeParts, EyeParts]
	/** The mouth line in this mood: a smile, a cat's "w", a frown. */
	mouth: string
	/**
	 * Where the mouth opens when the pet speaks: an oval under the nose, `top` its upper edge,
	 * growing down to `maxRy` (v3-pet-looks-requirements.md, R6).
	 */
	mouthOpen: { cx: number; top: number; rx: number; maxRy: number }
	/** Where the cheeks blush, left then right, and how deep in this mood (an opacity). */
	cheeks: readonly [Oval, Oval]
	blush: number
	/** A cat's whiskers, or null. */
	whiskers: string | null
	/** The tufts of fur at the cheeks, left then right; none on a dog whose ears hang there. */
	cheekFluff: readonly string[]
	colors: {
		fur: string
		/** The fur where the light falls on the head and body, and where it falls off. */
		highlight: string
		lowlight: string
		shade: string
		stripe: string
		patch: string
		/** The tail, and the outside of cat ears: the fur, or the points' colour. */
		tail: string
		earOuter: string
		/** Inside cat ears, and dog ears: the shade, or the points' colour. */
		earInner: string
		ink: string
		nose: string
		mouth: string
		mouthInside: string
		tongue: string
		edge: string
		pupil: string
		glint: string
		blush: string
	}
}

/** Every fur and eye id has its colours in the brand package; a missing one fails typecheck. */
const FUR: Record<FurId, FurArt> = art.pet.fur
const IRIS: Record<Exclude<EyeId, 'odd'>, string> = art.pet.eyes

export const PET_PATHS = {
	tailLong: 'M26 38 C62 40 66 -4 46 -12',
	tailCurly: 'M28 36 C52 40 56 16 40 14 C30 13 30 26 40 26',
	tailFluffyTip: 'M60 4 C62 -4 56 -12 46 -12',
	tailBob: 'M26 36 C33 37 37 33 35 28',
	tailPlume: 'M26 36 C58 34 62 -6 44 -14 C34 -18 28 -8 34 -4',
	catEarsPointy: ['-24,-48 -19,-77 -3,-60', '24,-48 19,-77 3,-60'] as const,
	catEarsPointyInner: ['-20,-52 -18,-70 -8,-58', '20,-52 18,-70 8,-58'] as const,
	catEarsRound: ['-22,-50 -17,-66 -5,-57', '22,-50 17,-66 5,-57'] as const,
	catEarsRoundInner: ['-18,-53 -16,-62 -9,-57', '18,-53 16,-62 9,-57'] as const,
	tufts: 'M-19 -77 L-21 -83 M-19 -77 L-17 -84 M19 -77 L21 -83 M19 -77 L17 -84',
	/** Folded: small ears tipped forward, the folded-down tip showing in the shade. */
	catEarsFolded: ['-24,-52 -15,-67 -6,-60', '24,-52 15,-67 6,-60'] as const,
	catEarsFoldedInner: ['-15,-67 -11,-61 -19,-60', '15,-67 11,-61 19,-60'] as const,
	/** Lynx: tall, with long tufts. */
	catEarsLynx: ['-25,-48 -20,-81 -3,-60', '25,-48 20,-81 3,-60'] as const,
	catEarsLynxInner: ['-21,-52 -19,-73 -8,-58', '21,-52 19,-73 8,-58'] as const,
	tuftsLynx: 'M-20 -81 L-22 -90 M-20 -81 L-18 -89 M20 -81 L22 -90 M20 -81 L18 -89',
	dogEarsPerky: ['-30,-44 -25,-72 -8,-57', '30,-44 25,-72 8,-57'] as const,
	/** Bat: upright ears, rounder than Perky (drawn with a wider rounding stroke). */
	dogEarsBat: ['-25,-52 -22,-74 -11,-61', '25,-52 22,-74 11,-61'] as const,
	dogTongue: 'M-2.6 -24.6 Q0 -18.6 2.6 -24.6 Z',
	eyesHappy: 'M-13 -40.5 Q-9 -47 -5 -40.5 M5 -40.5 Q9 -47 13 -40.5',
	eyesSleepy: 'M-13 -42.5 Q-9 -38.5 -5 -42.5 M5 -42.5 Q9 -38.5 13 -42.5',
	browsSad: 'M-14.5 -46.2 L-5.5 -50.4 M14.5 -46.2 L5.5 -50.4',
	catNose: '-3,-35 3,-35 0,-31',
	smileCat: 'M-4 -29 Q0 -26 4 -29',
	smileDog: 'M-4.5 -25 Q0 -22 4.5 -25',
	/** A calm cat's mouth: the little "w" under the nose. */
	mouthCat: 'M-3.6 -29.6 Q-1.8 -27.4 0 -29.4 Q1.8 -27.4 3.6 -29.6',
	/** A calm dog's mouth: a small, closed smile. */
	mouthDog: 'M-3.4 -25 Q0 -23.4 3.4 -25',
	frownCat: 'M-3 -27.6 Q0 -29.6 3 -27.6',
	frownDog: 'M-3.6 -23.4 Q0 -25.6 3.6 -23.4',
	/** A cat's whiskers: three a side, fanning out from the muzzle across the cheek. */
	whiskers:
		'M-10 -31.4 L-23.4 -33.8 M-10.6 -29.8 L-24.6 -29.6 M-10 -28.2 L-23 -25.8 ' +
		'M10 -31.4 L23.4 -33.8 M10.6 -29.8 L24.6 -29.6 M10 -28.2 L23 -25.8',
	/** Two soft tufts at each cheek, swept down, on the head's outline (left, right). */
	cheekFluff: [
		'M-25.9 -36.6 Q-27.8 -34.6 -27.9 -32.6 Q-26.3 -31.6 -25.3 -30.3 Q-25.8 -28.1 -25.3 -26.2 Q-22.1 -23.1 -19 -20.9 Z',
		'M25.9 -36.6 Q27.8 -34.6 27.9 -32.6 Q26.3 -31.6 25.3 -30.3 Q25.8 -28.1 25.3 -26.2 Q22.1 -23.1 19 -20.9 Z'
	] as const
} as const

/**
 * Where each species' mouth opens to speak: under the nose, within the muzzle. A cat's is small,
 * a dog's wider and deeper.
 */
const MOUTH_OPEN = {
	cat: { cx: 0, top: -30, rx: 3.2, maxRy: 3.2 },
	dog: { cx: 0, top: -27.5, rx: 4.2, maxRy: 4.2 }
} as const

/** The mouth line for a mood: happy smiles, sad frowns, and a calm or sleepy pet keeps its own. */
function mouthFor(isCat: boolean, mood: Mood): string {
	if (mood === 'happy') return isCat ? PET_PATHS.smileCat : PET_PATHS.smileDog
	if (mood === 'sad') return isCat ? PET_PATHS.frownCat : PET_PATHS.frownDog
	return isCat ? PET_PATHS.mouthCat : PET_PATHS.mouthDog
}

/** Eye centres; PetArt draws dots, irises, arcs and brows around them. */
export const EYE_X = [-9, 9] as const
export const EYE_Y = -42

/**
 * An open eye's sizes, the same in both renderers: a coloured eye and its pupil, a brown dot eye,
 * and the two glints from the eye's centre (a large one up and to the right, a small one opposite).
 */
export const EYE = {
	iris: 4.6,
	pupil: 2.6,
	dot: 4,
	glints: [
		{ dx: 1.4, dy: -1.6, r: 1.15 },
		{ dx: -1.3, dy: 1.5, r: 0.55 }
	]
} as const

/** How deep the cheeks blush in each mood (an opacity), and when the pet is stroked or hugged. */
const BLUSH: Record<Mood, number> = { happy: 0.6, content: 0.36, sleepy: 0.3, sad: 0.14 }
export const BLUSH_DEEP = 0.85

/** The cheeks: under the eyes' outer corners, clear of the muzzle. */
const CHEEKS = {
	cat: { cx: 17, cy: -33.4, rx: 4.6, ry: 2.9 },
	dog: { cx: 16.6, cy: -33.2, rx: 4.4, ry: 2.8 }
} as const

/**
 * Where the head sits in the drawing, as shares of its size (viewBox 200, pet space at
 * translate(96 118) scale(1.25), head centre at (0, -38)), for a head crop such as PetPortrait.
 */
export const HEAD_CENTRE = { x: 96 / 200, y: (118 - 38 * 1.25) / 200 } as const

const BODY_SHAPE: Record<BodyId, { rx: number; ry: number; cy: number }> = {
	// Tiny: a kitten's or a puppy's body under the same head, feet on the same ground.
	tiny: { rx: 24, ry: 31, cy: 20 },
	slim: { rx: 27, ry: 37, cy: 14 },
	round: { rx: 32, ry: 37, cy: 14 },
	chonky: { rx: 38, ry: 36, cy: 16 },
	buff: { rx: 33, ry: 38, cy: 14 }
}

/** The contact shadow's half-width under each body. */
const SHADOW_RX: Record<BodyId, number> = { tiny: 40, slim: 46, round: 46, chonky: 50, buff: 50 }

/** Buff: shoulders that stand out past the top of the body, for a V shape, and the muscle lines. */
const BUFF_SHOULDERS: readonly Oval[] = [
	{ cx: -25, cy: -2, rx: 12, ry: 12 },
	{ cx: 25, cy: -2, rx: 12, ry: 12 }
]
const BUFF_MUSCLES =
	'M-12 8 Q-6 14 -1 10 M1 10 Q6 14 12 8 ' + 'M0 17 L0 38 M-6 24 L6 24 M-6 31 L6 31'

const TAIL_SHAPE: Record<TailId, { d: string; width: number; fluffyTip: boolean }> = {
	long: { d: PET_PATHS.tailLong, width: 10, fluffyTip: false },
	fluffy: { d: PET_PATHS.tailLong, width: 17, fluffyTip: true },
	curly: { d: PET_PATHS.tailCurly, width: 9, fluffyTip: false },
	bob: { d: PET_PATHS.tailBob, width: 12, fluffyTip: false },
	plume: { d: PET_PATHS.tailPlume, width: 15, fluffyTip: false }
}
/** How far left a tail moves to meet the Tiny body. */
const TINY_TAIL_X = -6

const CAT_EARS: Record<CatEarId, NonNullable<PetParts['catEars']>> = {
	pointy: { outer: PET_PATHS.catEarsPointy, inner: PET_PATHS.catEarsPointyInner, tufts: null },
	round: { outer: PET_PATHS.catEarsRound, inner: PET_PATHS.catEarsRoundInner, tufts: null },
	tufted: {
		outer: PET_PATHS.catEarsPointy,
		inner: PET_PATHS.catEarsPointyInner,
		tufts: PET_PATHS.tufts
	},
	folded: { outer: PET_PATHS.catEarsFolded, inner: PET_PATHS.catEarsFoldedInner, tufts: null },
	lynx: {
		outer: PET_PATHS.catEarsLynx,
		inner: PET_PATHS.catEarsLynxInner,
		tufts: PET_PATHS.tuftsLynx
	}
}

export function petParts(a: PetAppearance, mood: Mood = 'content'): PetParts {
	const P = art.pet
	const isCat = a.species === 'cat'
	const fur = FUR[a.fur]
	const { rx, ry, cy } = BODY_SHAPE[a.body]

	const tail = { ...TAIL_SHAPE[a.tail], x: a.body === 'tiny' ? TINY_TAIL_X : 0 }

	const pawY = cy + ry - 3
	const paws = [
		{ cx: -13, cy: pawY, rx: 9, ry: 5.5 },
		{ cx: 13, cy: pawY, rx: 9, ry: 5.5 }
	] as const

	const catEars = isCat ? CAT_EARS[a.ears as CatEarId] : null

	const body = { cx: 0, rx, ry, cy }
	const head = { cx: 0, cy: -38, r: 26 }
	const shoulders = a.body === 'buff' ? BUFF_SHOULDERS : []
	const accent = a.accent === 'auto' ? null : FUR[a.accent]
	// The markings' colour: the accent's, or the pattern's own (white or ginger patches, a darker
	// shade of the fur for the rest).
	const mark = accent ? accent.base : a.pattern === 'patches' ? fur.patch : fur.stripe
	const points = a.pattern === 'points'
	const whiteFront = WHITE_FRONT.has(a.white)
	// The paws & chest markings' colour: white, or a fur's.
	const trimArt = a.trim === 'white' ? null : FUR[a.trim]
	const trim = trimArt ? trimArt.base : P.white
	// A dark muzzle (dark paws & chest, or dark points) would hide a dog's nose and the mouth.
	const muzzleDark = whiteFront
		? (trimArt?.dark ?? false)
		: points && (accent ? accent.dark : fur.dark)

	const markings = [
		...patternShapes(a.pattern, mark, fur.base, body, isCat),
		...whiteShapes(a.white, trim, body, shoulders, isCat)
	]

	const bellyFill = whiteFront ? trim : fur.belly
	const belly = {
		cx: 0,
		cy: cy + 10,
		rx: Math.round(rx * (whiteFront ? 0.6 : 0.47)),
		ry: whiteFront ? 27 : 22,
		fill: bellyFill
	}
	// Points darken the muzzle into the mask; a white front whitens it.
	const muzzleFill = whiteFront ? trim : points ? mark : fur.belly
	const muzzle = isCat
		? { cx: 0, cy: -30, rx: whiteFront ? 12 : 10, ry: whiteFront ? 9 : 7, fill: muzzleFill }
		: { cx: 0, cy: -27, rx: whiteFront ? 15 : 13, ry: whiteFront ? 12 : 10, fill: muzzleFill }
	const pawFill = a.white !== 'none' ? trim : points ? mark : fur.base

	const cheek = isCat ? CHEEKS.cat : CHEEKS.dog
	// A dog's hanging or folded ears lie over its cheeks: fluff there would poke out from under them.
	const fluffy = isCat || a.ears === 'perky' || a.ears === 'bat'

	const iris = (fill: string): EyeParts => ({ kind: 'iris', fill })
	let eyes: readonly [EyeParts, EyeParts]
	if (a.eyes === 'odd') eyes = [iris(IRIS.blue), iris(IRIS.amber)]
	else if (a.eyes === 'brown')
		// Brown eyes are plain dots, except on a dark coat where a dot would vanish.
		eyes = fur.dark
			? [iris(P.brownIrisOnDark), iris(P.brownIrisOnDark)]
			: [
					{ kind: 'dot', fill: P.ink },
					{ kind: 'dot', fill: P.ink }
				]
	else eyes = [iris(IRIS[a.eyes]), iris(IRIS[a.eyes])]

	return {
		isCat,
		mood,
		shadowRx: SHADOW_RX[a.body],
		tail,
		body,
		shoulders,
		muscles: a.body === 'buff' ? BUFF_MUSCLES : null,
		paws,
		pawFill,
		head,
		catEars,
		dogEars: isCat ? null : (a.ears as DogEarId),
		markings,
		belly,
		muzzle,
		eyes,
		mouth: mouthFor(isCat, mood),
		mouthOpen: isCat ? MOUTH_OPEN.cat : MOUTH_OPEN.dog,
		cheeks: [
			{ ...cheek, cx: -cheek.cx },
			{ ...cheek, cx: cheek.cx }
		],
		blush: BLUSH[mood],
		whiskers: isCat ? PET_PATHS.whiskers : null,
		cheekFluff: fluffy ? PET_PATHS.cheekFluff : [],
		colors: {
			fur: fur.base,
			highlight: fur.highlight,
			lowlight: fur.lowlight,
			shade: fur.shade,
			stripe: fur.stripe,
			patch: fur.patch,
			tail: points ? mark : fur.base,
			earOuter: points ? mark : fur.base,
			earInner: points ? mark : fur.shade,
			ink: fur.dark ? P.inkOnDark : P.ink,
			nose: isCat || muzzleDark ? P.catNose : P.dogNose,
			mouth: muzzleDark ? P.inkOnDark : P.mouth,
			mouthInside: P.mouthInside,
			tongue: P.tongue,
			edge: P.edge,
			pupil: P.pupil,
			glint: P.glint,
			blush: P.blush
		}
	}
}

/** Where brindle streaks start across the body, as shares of its width: uneven on purpose. */
const BRINDLE_STEPS = [0.04, 0.11, 0.2, 0.26, 0.35, 0.45, 0.52, 0.6, 0.67, 0.77, 0.84, 0.93]

/** White markings that cover the belly and muzzle, and make them larger. */
const WHITE_FRONT: ReadonlySet<WhiteId> = new Set(['socks', 'bicolour', 'van'])

type Body = { cx: number; cy: number; rx: number; ry: number }

/**
 * Where each pattern's markings go, in its colour. Clipped to the body and head when drawn, so
 * a shape may run past the edge; the belly and muzzle are drawn over them.
 */
function patternShapes(
	pattern: PatternId,
	mark: string,
	ground: string,
	b: Body,
	isCat: boolean
): Shape[] {
	const { rx, cy, ry } = b
	const fill = { fill: mark }
	const line = (width: number, stroke = mark) => ({
		fill: 'none',
		stroke,
		strokeWidth: width,
		strokeLinecap: 'round' as const
	})
	switch (pattern) {
		case 'solid':
			return []
		case 'stripes':
			return [
				path(
					`M-6 -63 L-4 -55 M0 -64 L0 -55 M6 -63 L4 -55 ` +
						`M${-rx + 1} ${cy - 10} L${-rx + 9} ${cy - 8} M${-rx} ${cy + 1} L${-rx + 8} ${cy + 2} ` +
						`M${rx - 1} ${cy - 10} L${rx - 9} ${cy - 8} M${rx} ${cy + 1} L${rx - 8} ${cy + 2}`,
					line(2.6)
				)
			]
		case 'tabby': {
			// The classic tabby: an M on the forehead, cheek lines, a swirl on each flank.
			const swirl = (side: number) => {
				const x = side * rx
				const inX = side * (rx - 15)
				const midX = side * (rx - 8)
				return (
					`M${x} ${cy - 15} C${inX} ${cy - 15} ${inX} ${cy + 11} ${x} ${cy + 11} ` +
					`M${x} ${cy - 6} C${midX} ${cy - 6} ${midX} ${cy + 3} ${x} ${cy + 3}`
				)
			}
			return [
				path(
					'M-9 -57 L-6 -51 L-3 -57 L0 -51 L3 -57 L6 -51 L9 -57 M-3 -64 L-2 -59 M3 -64 L2 -59',
					line(2.4)
				),
				path('M-26 -36 L-18 -34 M-26 -31 L-19 -30 M26 -36 L18 -34 M26 -31 L19 -30', line(2.2)),
				path(`${swirl(-1)} ${swirl(1)}`, line(3))
			]
		}
		case 'spots':
			return [
				circle({ cx: -16, cy: cy - 6, r: 5 }, fill),
				circle({ cx: 15, cy: cy + 10, r: 6 }, fill),
				circle({ cx: -6, cy: cy + 26, r: 4 }, fill),
				circle({ cx: 16, cy: -52, r: 4.5 }, fill),
				circle({ cx: -19, cy: -28, r: 3 }, fill)
			]
		case 'patches':
			return [
				ellipse({ cx: -14, cy: cy - 8, rx: 11, ry: 13 }, fill),
				ellipse({ cx: 15, cy: cy + 16, rx: 9, ry: 11 }, fill),
				ellipse({ cx: -11, cy: -53, rx: 10, ry: 7 }, fill)
			]
		case 'tortie':
			// Mottled: blotches of the second colour across the body and head, and a few flecks.
			return [
				ellipse({ cx: -rx * 0.55, cy: cy - 12, rx: 13, ry: 15 }, fill),
				ellipse({ cx: rx * 0.6, cy: cy + 6, rx: 12, ry: 16 }, fill),
				ellipse({ cx: -rx * 0.35, cy: cy + 26, rx: 11, ry: 8 }, fill),
				ellipse({ cx: -12, cy: -54, rx: 12, ry: 8 }, fill),
				ellipse({ cx: 17, cy: -40, rx: 8, ry: 11 }, fill),
				circle({ cx: rx * 0.15, cy: cy - 22, r: 3.5 }, fill),
				circle({ cx: 4, cy: -60, r: 3 }, fill),
				circle({ cx: -20, cy: -32, r: 2.5 }, fill)
			]
		case 'points':
			// A darker mask round the muzzle, below the eyes; the ears, tail and paws are
			// recoloured in their own parts.
			return [
				isCat
					? ellipse({ cx: 0, cy: -28, rx: 15, ry: 10 }, fill)
					: ellipse({ cx: 0, cy: -26, rx: 17, ry: 12 }, fill)
			]
		case 'saddle':
			// The saddle wraps the back, so from the front it shows down both flanks.
			return [-1, 1].map((side) =>
				ellipse({ cx: side * rx, cy: cy - 4, rx: rx * 0.5, ry: ry * 0.8 }, fill)
			)
		case 'brindle': {
			// Fine, uneven streaks over the body and the top of the head: short wavy strokes at
			// varying gaps, so they read as a coat, not as ruled lines.
			const streaks: string[] = []
			BRINDLE_STEPS.forEach((step, i) => {
				const x = -rx + step * rx * 2
				const top = cy - ry * (i % 2 ? 0.75 : 0.95)
				const bottom = top + ry * (i % 3 ? 0.9 : 1.2)
				streaks.push(`M${x} ${top} Q${x + 5} ${(top + bottom) / 2} ${x + 2} ${bottom}`)
			})
			for (const x of [-20, -13, -5, 4, 11, 19])
				streaks.push(`M${x} -66 Q${x + 3} -59 ${x + 1} -52`)
			// Faint, but opaque: the colour 60% of the way over the fur, as an opacity would show it.
			// The body and the head each draw the coat, so a see-through marking would show darker
			// where they meet (petDrawing).
			return [path(streaks.join(' '), line(1.5, composite(withAlpha(mark, 0.6), ground)))]
		}
	}
}

/**
 * The paws & chest markings (white, or `colour`), over the pattern; Mittens and Socks and bib are
 * only the paws, belly and muzzle.
 */
function whiteShapes(
	white: WhiteId,
	colour: string,
	b: Body,
	shoulders: readonly Oval[],
	isCat: boolean
): Shape[] {
	const fill = { fill: colour }
	// The lower face: below the eyes, so dark-coat eyes (drawn in a light ink) stay on the fur.
	const face = isCat ? { cx: 0, cy: -27, rx: 16, ry: 10 } : { cx: 0, cy: -25, rx: 19, ry: 12 }
	switch (white) {
		case 'none':
		case 'mittens':
		case 'socks':
			return []
		case 'bicolour':
			return [
				ellipse({ cx: 0, cy: b.cy + b.ry * 0.5, rx: b.rx + 4, ry: b.ry * 0.7 }, fill),
				ellipse(face, fill)
			]
		case 'van':
			// Mostly white: the head's top, the ears and the tail keep the coat.
			return [
				// Larger than the body: the clip decides the edge.
				ellipse({ ...b, rx: b.rx + 4, ry: b.ry + 4 }, fill),
				...shoulders.map((shoulder) =>
					ellipse({ ...shoulder, rx: shoulder.rx + 4, ry: shoulder.ry + 4 }, fill)
				),
				ellipse({ ...face, rx: face.rx + 7, ry: face.ry + 2 }, fill)
			]
	}
}
