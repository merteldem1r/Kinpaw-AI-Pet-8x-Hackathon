/**
 * The pet as shapes (docs/application/features/v2-pet-looks-requirements.md, R1–R3;
 * v3-pet-looks-requirements.md, R2): every appearance gives a drawing with real colours, the
 * mood never changes it, only the pattern is clipped, each coat's colours come from its art, not
 * from checks on its id, and the drawing comes in parts that each turn about their own pivot.
 */

import { describe, expect, it } from '@jest/globals'
import {
	ATTRIBUTE_KEYS,
	FUR_IDS,
	LOOKS,
	MOODS,
	optionsFor,
	randomAppearance,
	SPECIES,
	withAttribute,
	type PetAppearance
} from '@app/contract'
import {
	art,
	BLUSH_DEEP,
	drawingShapes,
	EYE,
	EYE_X,
	EYE_Y,
	luminance,
	PART_KEYS,
	petDrawing,
	petParts,
	type PetDrawing,
	type Point,
	type Shape
} from '../index'

const HEX = /^#[0-9a-f]{6}$/i

/** A fixed stand-in for Math.random, so a failure names the same pets every run. */
function seeded(seed = 1): () => number {
	let s = seed
	return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const random = seeded()
const PETS: PetAppearance[] = [
	...LOOKS.map((look) => look.appearance),
	...SPECIES.flatMap((species) =>
		Array.from({ length: 60 }, () => randomAppearance(species, { includePremium: true, random }))
	)
]
const GINGER = LOOKS[0]!.appearance

const all = (a: PetAppearance) => drawingShapes(petDrawing(petParts(a)))

describe('petDrawing', () => {
	it('paints every shape of every pet in a palette colour', () => {
		for (const pet of PETS) {
			for (const shape of all(pet)) {
				for (const colour of [shape.attrs.fill, shape.attrs.stroke]) {
					if (colour !== undefined && colour !== 'none') expect(colour).toMatch(HEX)
				}
				for (const stop of shape.attrs.gradient?.stops ?? []) expect(stop.color).toMatch(HEX)
			}
		}
	})

	it('is the same in every mood: only the face, drawn by each renderer, changes', () => {
		for (const pet of PETS.slice(0, LOOKS.length)) {
			const content = petDrawing(petParts(pet, 'content'))
			for (const mood of MOODS) expect(petDrawing(petParts(pet, mood))).toEqual(content)
		}
	})

	it('clips the pattern and nothing else, to the body and to the head', () => {
		const solid = petDrawing(petParts(withAttribute(GINGER, 'pattern', 'solid')))
		for (const key of PART_KEYS) expect(solid.parts[key].coat).toEqual([])
		for (const pattern of ['stripes', 'patches', 'spots']) {
			const d = petDrawing(petParts(withAttribute(GINGER, 'pattern', pattern)))
			const kinds = (shapes: readonly Shape[]) => shapes.map((shape) => shape.kind)
			expect(d.parts.body.coat.length).toBeGreaterThan(0)
			expect(d.parts.head.coat).toEqual(d.parts.body.coat)
			expect(kinds(d.parts.body.clip)).toEqual(['ellipse'])
			expect(kinds(d.parts.head.clip)).toEqual(['circle'])
			for (const key of ['tail', 'earLeft', 'earRight'] as const) {
				expect(d.parts[key].coat).toEqual([])
			}
		}
	})

	it('draws the sticker edge first and the nose last of the head', () => {
		const d = petDrawing(petParts(GINGER))
		expect(drawingShapes(d)[0]).toMatchObject({ kind: 'path', attrs: { stroke: art.pet.edge } })
		for (const key of PART_KEYS) {
			for (const shape of d.parts[key].edge) expect(shape.attrs.stroke).toBe(art.pet.edge)
		}
		expect(d.parts.head.over.at(-1)).toMatchObject({
			kind: 'polygon',
			attrs: { fill: art.pet.catNose }
		})
	})

	// The body and the head each draw the coat, so a marking crossing the neck is drawn twice
	// where their outlines meet: a see-through one would look darker there.
	it('draws every marking opaque', () => {
		for (const pet of PETS) {
			for (const shape of petParts(pet).markings) expect(shape.attrs.opacity).toBeUndefined()
		}
	})
})

// docs/application/features/v3-pet-looks-requirements.md, R8.
describe('the light polish', () => {
	const inOval = (o: { cx: number; cy: number; rx: number; ry: number }, x: number, y: number) =>
		((x - o.cx) / o.rx) ** 2 + ((y - o.cy) / o.ry) ** 2 <= 1

	it("lights the head and the body from the fur's own colours, each as one", () => {
		for (const pet of PETS) {
			const p = petParts(pet)
			const d = petDrawing(p)
			for (const key of ['head', 'body'] as const) {
				const lights = new Set(d.parts[key].fill.map((shape) => shape.attrs.gradient))
				// The body with its shoulders, the head with its cheek fluff: one light each.
				expect(lights.size).toBe(1)
				const [light] = lights
				expect(light?.stops.map((stop) => stop.color)).toEqual([
					p.colors.highlight,
					p.colors.fur,
					p.colors.lowlight
				])
				// The flat colour stays, for a renderer that draws no gradient.
				for (const shape of d.parts[key].fill) expect(shape.attrs.fill).toBe(p.colors.fur)
			}
			for (const key of ['tail', 'pawLeft', 'pawRight', 'earLeft', 'earRight'] as const) {
				for (const shape of d.parts[key].fill) expect(shape.attrs.gradient).toBeUndefined()
			}
		}
	})

	it('gives every fur a lighter and a darker tone of itself', () => {
		for (const fur of FUR_IDS) {
			const coat = art.pet.fur[fur]
			expect(luminance(coat.highlight)).toBeGreaterThan(luminance(coat.base))
			expect(luminance(coat.lowlight)).toBeLessThan(luminance(coat.base))
		}
	})

	it('draws whiskers on cats only, under the nose', () => {
		for (const pet of PETS) {
			const p = petParts(pet)
			const over = petDrawing(p).parts.head.over
			expect(p.whiskers !== null).toBe(pet.species === 'cat')
			expect(over).toHaveLength(pet.species === 'cat' ? 3 : 2)
			expect(over.at(-1)?.attrs.fill).toBe(p.colors.nose)
		}
	})

	it('tufts the cheeks, except under ears that hang over them', () => {
		for (const pet of PETS) {
			const p = petParts(pet)
			const { head } = petDrawing(p).parts
			const hangs = pet.species === 'dog' && pet.ears !== 'perky' && pet.ears !== 'bat'
			expect(p.cheekFluff).toHaveLength(hangs ? 0 : 2)
			// The head, then a tuft a side, each with its share of the sticker edge.
			expect(head.fill).toHaveLength(1 + p.cheekFluff.length)
			expect(head.edge).toHaveLength(head.fill.length)
		}
	})

	it('blushes on the cheeks: deepest when happy, faintest when sad, deeper still when stroked', () => {
		for (const pet of PETS) {
			const blush = (mood: (typeof MOODS)[number]) => petParts(pet, mood).blush
			expect(blush('happy')).toBeGreaterThan(blush('content'))
			expect(blush('content')).toBeGreaterThan(blush('sad'))
			expect(blush('sad')).toBeGreaterThan(0)
			expect(BLUSH_DEEP).toBeGreaterThan(blush('happy'))
			const p = petParts(pet)
			expect(p.colors.blush).toBe(art.pet.blush)
			expect(p.cheeks[0].cx).toBe(-p.cheeks[1].cx)
			for (const cheek of p.cheeks) {
				// On the head, beside the muzzle, under the eye.
				expect(Math.hypot(cheek.cx - p.head.cx, cheek.cy - p.head.cy) + cheek.rx).toBeLessThan(
					p.head.r
				)
				expect(inOval(p.muzzle, cheek.cx, cheek.cy)).toBe(false)
				expect(cheek.cy - cheek.ry).toBeGreaterThan(EYE_Y)
			}
		}
	})

	it('keeps the bigger eyes apart, on the head, with both glints inside', () => {
		const widest = Math.max(EYE.iris, EYE.dot)
		expect(EYE_X[1] - EYE_X[0]).toBeGreaterThan(widest * 2 + 4)
		expect(EYE.pupil).toBeLessThan(EYE.iris)
		for (const pet of PETS.slice(0, LOOKS.length)) {
			const { head } = petParts(pet)
			for (const x of EYE_X) {
				expect(Math.hypot(x - head.cx, EYE_Y - head.cy) + widest).toBeLessThan(head.r)
			}
		}
		for (const glint of EYE.glints) {
			expect(Math.hypot(glint.dx, glint.dy) + glint.r).toBeLessThan(Math.min(EYE.iris, EYE.dot))
		}
	})
})

describe('the mouth', () => {
	const inside = (o: { cx: number; cy: number; rx: number; ry: number }, x: number, y: number) =>
		((x - o.cx) / o.rx) ** 2 + ((y - o.cy) / o.ry) ** 2 <= 1

	it('gives each mood its own mouth line: a smile, a calm mouth, a frown', () => {
		for (const species of SPECIES) {
			const pet = randomAppearance(species, { random })
			const mouth = (mood: (typeof MOODS)[number]) => petParts(pet, mood).mouth
			expect(new Set([mouth('happy'), mouth('content'), mouth('sad')]).size).toBe(3)
			expect(mouth('sleepy')).toBe(mouth('content'))
		}
	})

	it('draws the mouth line, and the mouth wide open, inside the muzzle', () => {
		for (const pet of PETS) {
			for (const mood of MOODS) {
				const p = petParts(pet, mood)
				for (const [, x, y] of p.mouth.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)) {
					expect(inside(p.muzzle, Number(x), Number(y))).toBe(true)
				}
				const { cx, top, rx, maxRy } = p.mouthOpen
				for (const [x, y] of [
					[cx - rx, top + maxRy],
					[cx + rx, top + maxRy],
					[cx, top + maxRy * 2]
				] as const) {
					expect(inside(p.muzzle, x, y)).toBe(true)
				}
			}
		}
	})
})

describe('the parts', () => {
	const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
	const drawings = (): [PetAppearance, PetDrawing][] =>
		PETS.map((pet) => [pet, petDrawing(petParts(pet))])

	it("puts a cat's ears behind its head, and a dog's in front", () => {
		for (const [pet, d] of drawings()) {
			const head = d.order.indexOf('head')
			const ears = [d.order.indexOf('earLeft'), d.order.indexOf('earRight')]
			expect([...d.order].sort()).toEqual([...PART_KEYS].sort())
			for (const ear of ears) {
				if (pet.species === 'cat') expect(ear).toBeLessThan(head)
				else expect(ear).toBeGreaterThan(head)
			}
		}
	})

	it('turns each part where it joins the pet', () => {
		for (const [pet, d] of drawings()) {
			const p = petParts(pet)
			const headCentre = { x: p.head.cx, y: p.head.cy }
			// The neck is the bottom of the head, the feet the bottom of the paws.
			expect(d.parts.head.pivot).toEqual({ x: 0, y: p.head.cy + p.head.r })
			expect(d.parts.body.pivot.y).toBeCloseTo(p.paws[0].cy + p.paws[0].ry)
			// An ear turns on the edge of the head, and the tail at the body's edge: the tail's
			// root sits on the rump, behind the body's outline (inside 1, outside past it).
			for (const ear of ['earLeft', 'earRight'] as const) {
				expect(dist(d.parts[ear].pivot, headCentre)).toBeLessThanOrEqual(p.head.r + 3)
			}
			const tail = d.parts.tail.pivot
			const { cx, cy, rx, ry } = p.body
			const fromBody = ((tail.x - cx) / rx) ** 2 + ((tail.y - cy) / ry) ** 2
			expect(fromBody).toBeGreaterThan(0.5)
			expect(fromBody).toBeLessThan(1.6)
		}
	})

	it('draws each ear on its own side, as its own part', () => {
		const left = (shape: Shape) =>
			[...JSON.stringify(shape.attrs).matchAll(/"(?:cx|d|points)":"?(-?[\d.]+)/g)].map((m) =>
				Number(m[1])
			)
		for (const [pet, d] of drawings()) {
			const { earLeft, earRight } = d.parts
			expect(earLeft.pivot.x).toBeLessThan(0)
			expect(earRight.pivot.x).toBeGreaterThan(0)
			expect(earLeft.pivot.y).toBeCloseTo(earRight.pivot.y)
			expect(earLeft.pivot.x).toBeCloseTo(-earRight.pivot.x)
			for (const shape of [...earLeft.edge, ...earLeft.fill]) {
				for (const x of left(shape)) expect(x).toBeLessThan(0)
			}
			for (const shape of [...earRight.edge, ...earRight.fill]) {
				for (const x of left(shape)) expect(x).toBeGreaterThan(0)
			}
			// Tufted and Lynx ears have their tufts on each ear, not one path for both.
			if (pet.species === 'cat' && (pet.ears === 'tufted' || pet.ears === 'lynx')) {
				expect(earLeft.fill).toHaveLength(3)
				expect(earRight.fill).toHaveLength(3)
			}
		}
	})
})

/** The view's edges in pet space: viewBox 0 0 200 200, pet space at translate(96 118) scale(1.25). */
const toView = (x: number, y: number) => [96 + x * 1.25, 118 + y * 1.25] as const

/**
 * The furthest a shape reaches, as points with the stroke's reach around them: generous for
 * paths (every number pair in `d`, control points included) and rotated ovals (their larger
 * radius in every direction), so a pass means the shape is inside.
 */
function reach(shape: Shape): { points: [number, number][]; pad: number } {
	const a = shape.attrs
	const pad = (a.stroke && a.stroke !== 'none' ? (a.strokeWidth ?? 1) : 0) / 2
	const dx = Number(/translate\((-?[\d.]+)/.exec(a.transform ?? '')?.[1] ?? 0)
	const pairs = (text: string) =>
		[...text.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map(
			(m) => [Number(m[1]) + dx, Number(m[2])] as [number, number]
		)
	switch (shape.kind) {
		case 'ellipse': {
			const r = a.transform?.startsWith('rotate') ? Math.max(shape.attrs.rx, shape.attrs.ry) : 0
			const rx = r || shape.attrs.rx
			const ry = r || shape.attrs.ry
			const { cx, cy } = shape.attrs
			return {
				points: [
					[cx - rx, cy - ry],
					[cx + rx, cy + ry]
				],
				pad
			}
		}
		case 'circle': {
			const { cx, cy, r } = shape.attrs
			return {
				points: [
					[cx - r, cy - r],
					[cx + r, cy + r]
				],
				pad
			}
		}
		case 'path':
			return { points: pairs(shape.attrs.d), pad }
		case 'polygon':
			return { points: pairs(shape.attrs.points), pad }
	}
}

describe('every option', () => {
	const pets = SPECIES.flatMap((species) => {
		const base = randomAppearance(species, { random: () => 0 })
		return ATTRIBUTE_KEYS.flatMap((key) =>
			optionsFor(key, species).map((option) => withAttribute(base, key, option.id))
		)
	})

	it('draws on both species, in every mood, with every shape inside the view', () => {
		for (const pet of pets) {
			for (const mood of MOODS) {
				const d = petDrawing(petParts(pet, mood))
				for (const shape of drawingShapes(d)) {
					const { points, pad } = reach(shape)
					for (const [x, y] of points) {
						for (const [vx, vy] of [toView(x - pad, y - pad), toView(x + pad, y + pad)]) {
							expect(vx).toBeGreaterThanOrEqual(0)
							expect(vx).toBeLessThanOrEqual(200)
							expect(vy).toBeGreaterThanOrEqual(0)
							expect(vy).toBeLessThanOrEqual(200)
						}
					}
				}
			}
		}
	})

	it('changes the drawing: no option looks the same as another of its attribute', () => {
		for (const species of SPECIES) {
			// Striped and in socks, so both colours have something to colour.
			const base = withAttribute(
				withAttribute(randomAppearance(species, { random: () => 0 }), 'pattern', 'stripes'),
				'white',
				'socks'
			)
			for (const key of ATTRIBUTE_KEYS) {
				const drawings = optionsFor(key, species).map((option) =>
					JSON.stringify([
						petDrawing(petParts(withAttribute(base, key, option.id))),
						petParts(withAttribute(base, key, option.id)).eyes
					])
				)
				expect(new Set(drawings).size).toBe(drawings.length)
			}
		}
	})
})

describe('the layered coat', () => {
	const fills = (a: PetAppearance) =>
		petParts(a).markings.map((shape) =>
			shape.attrs.fill && shape.attrs.fill !== 'none' ? shape.attrs.fill : shape.attrs.stroke
		)

	it("draws the markings in the marking colour, or in the pattern's own when it is Matching", () => {
		const grey = withAttribute(GINGER, 'fur', 'grey')
		expect(new Set(fills(grey))).toEqual(new Set([art.pet.fur.grey.stripe]))
		expect(new Set(fills(withAttribute(grey, 'accent', 'ginger')))).toEqual(
			new Set([art.pet.fur.ginger.base])
		)
		const patches = withAttribute(grey, 'pattern', 'patches')
		expect(new Set(fills(patches))).toEqual(new Set([art.pet.fur.grey.patch]))
	})

	it('puts white markings over the pattern', () => {
		const tabby = withAttribute(withAttribute(GINGER, 'pattern', 'tabby'), 'white', 'van')
		const markings = petParts(tabby).markings
		expect(markings.at(-1)?.attrs.fill).toBe(art.pet.white)
		expect(markings[0]?.attrs.stroke).toBe(art.pet.fur.ginger.stripe)
	})

	it('whitens the paws for every white marking, and the belly and muzzle from Socks and bib up', () => {
		for (const white of ['mittens', 'socks', 'bicolour', 'van'] as const) {
			const p = petParts(withAttribute(GINGER, 'white', white))
			expect(p.pawFill).toBe(art.pet.white)
			expect(p.belly.fill).toBe(white === 'mittens' ? art.pet.fur.ginger.belly : art.pet.white)
		}
		expect(petParts(GINGER).pawFill).toBe(art.pet.fur.ginger.base)
	})

	it('colours the paws & chest in their colour: paws, belly, muzzle and the Van coat', () => {
		const golden = art.pet.fur.golden.base
		const dobe = {
			...GINGER,
			fur: 'charcoal',
			pattern: 'solid',
			white: 'socks',
			trim: 'golden'
		} as const
		const p = petParts(dobe)
		expect([p.pawFill, p.belly.fill, p.muzzle.fill]).toEqual([golden, golden, golden])
		const van = petParts({ ...dobe, white: 'van' })
		expect(van.markings.every((shape) => shape.attrs.fill === golden)).toBe(true)
		// White stays white: every pet saved before the colour existed looks the same.
		expect(petParts({ ...dobe, trim: 'white' }).pawFill).toBe(art.pet.white)
	})

	it('keeps a dark muzzle readable: light mouth line, pink dog nose', () => {
		const dog = randomAppearance('dog', { random: () => 0 })
		const dark = petParts({ ...dog, fur: 'golden', white: 'socks', trim: 'charcoal' }, 'happy')
		expect(dark.colors.mouth).toBe(art.pet.inkOnDark)
		expect(dark.colors.nose).toBe(art.pet.catNose)
		const light = petParts({ ...dog, fur: 'charcoal', white: 'socks', trim: 'golden' }, 'happy')
		expect(light.colors.mouth).toBe(art.pet.mouth)
		expect(light.colors.nose).toBe(art.pet.dogNose)
	})

	it('colours the points: ears, tail, paws and the face mask', () => {
		const siamese = petParts({
			...GINGER,
			fur: 'cream',
			pattern: 'points',
			accent: 'chocolate'
		})
		const point = art.pet.fur.chocolate.base
		expect([
			siamese.colors.tail,
			siamese.colors.earOuter,
			siamese.colors.earInner,
			siamese.pawFill,
			siamese.muzzle.fill
		]).toEqual([point, point, point, point, point])
		expect(siamese.colors.fur).toBe(art.pet.fur.cream.base)
	})
})

describe('coat art', () => {
	it('gives every fur its belly and patch colours', () => {
		for (const fur of FUR_IDS) {
			const coat = art.pet.fur[fur]
			for (const colour of [coat.base, coat.shade, coat.stripe, coat.belly, coat.patch]) {
				expect(colour).toMatch(HEX)
			}
		}
	})

	it("takes the belly and patches from the fur's art (cream: a calico's ginger patches)", () => {
		const cream = petParts(
			withAttribute(withAttribute(GINGER, 'fur', 'cream'), 'pattern', 'patches')
		)
		expect(cream.belly.fill).toBe(art.pet.fur.cream.belly)
		expect(cream.colors.patch).toBe(art.pet.fur.cream.patch)
		expect(cream.colors.patch).not.toBe(art.pet.white)
	})
})
