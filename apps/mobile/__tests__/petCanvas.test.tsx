/**
 * The Skia pet (components/pet/PetCanvas.tsx; docs/application/features/v3-pet-looks-plan.md,
 * B1): drawn off screen by CanvasKit, every look in every mood, lit and flat, puts the pet where
 * the SVG pet is and handles every shape the drawing makes.
 *
 * @jest-environment @shopify/react-native-skia/jestEnv.js
 */
import type { SkRuntimeEffect } from '@shopify/react-native-skia'
import { LOOKS, MOODS, type Mood, type PetAppearance } from '@app/contract'
import { drawingShapes, petDrawing, petParts } from '@app/brand'
import { atRest, PetScene } from '@/components/pet/PetCanvas'
import { PET_LIGHT } from '@/lib/petLight'

jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'))
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'))
// Under Jest's "native" platform Skia's renderer would pick the container that talks to the
// native view; off screen there is none, so it is given the plain one, as on the web.
jest.mock('@shopify/react-native-skia/lib/commonjs/sksg/Container', () => ({
	createContainer: (skia: unknown, nativeId: number) => {
		const { StaticContainer } = jest.requireActual(
			'@shopify/react-native-skia/lib/commonjs/sksg/StaticContainer'
		)
		return new StaticContainer(skia, nativeId)
	}
}))

// Skia's own off-screen renderer: the same scene the app's canvas draws, on CanvasKit.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const headless = require('@shopify/react-native-skia/lib/commonjs/headless') as {
	makeOffscreenSurface: (width: number, height: number) => unknown
	drawOffscreen: (
		surface: unknown,
		element: React.ReactNode
	) => Promise<{ readPixels: () => Uint8Array | Float32Array | null }>
	getSkiaExports: () => {
		Skia: { RuntimeEffect: { Make: (sksl: string) => SkRuntimeEffect | null } }
	}
}

// The scene is rendered by Skia's own reconciler, not by a test renderer: no `act` to wrap it in.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false

const SIZE = 100
let light: SkRuntimeEffect | null = null

// CanvasKit is loaded by Skia's environment, outside the test's own realm, and tells a list of
// colours by `instanceof Array` and `instanceof Float32Array`: a gradient's colours, listed by
// code in this realm, are then "not a color array". They are handed over as its own kinds.
type Kit = {
	Color: (r: number, g: number, b: number, a: number) => Float32Array
	Matrix: { identity: () => number[] }
	Shader: { MakeRadialGradient: (...args: unknown[]) => unknown }
}
beforeAll(() => {
	const kit = (globalThis as unknown as { CanvasKit: Kit }).CanvasKit
	const Floats = kit.Color(0, 0, 0, 1).constructor as Float32ArrayConstructor
	const List = kit.Matrix.identity().constructor as ArrayConstructor
	const make = kit.Shader.MakeRadialGradient.bind(kit.Shader)
	kit.Shader.MakeRadialGradient = (centre, radius, colours, ...rest) =>
		make(
			centre,
			radius,
			List.from((colours as Float32Array[]).map((colour) => Floats.from(colour))),
			...rest
		)
	light = headless.getSkiaExports().Skia.RuntimeEffect.Make(PET_LIGHT)
})

/** The scene drawn `SIZE` pixels square: how see-through the pixel at a point of the 200-box is. */
async function alphaAt(appearance: PetAppearance, mood: Mood, lit: boolean) {
	const p = petParts(appearance, mood)
	const surface = headless.makeOffscreenSurface(SIZE, SIZE)
	const image = await headless.drawOffscreen(
		surface,
		<PetScene
			p={p}
			drawing={petDrawing(petParts(appearance))}
			size={SIZE}
			light={lit ? light : null}
			beaming={false}
			{...atRest(p)}
		/>
	)
	const pixels = image.readPixels()!
	return (x: number, y: number) =>
		pixels[(Math.round((y / 200) * SIZE) * SIZE + Math.round((x / 200) * SIZE)) * 4 + 3]!
}

describe('<PetScene>', () => {
	it('compiles its light', () => {
		expect(light).not.toBeNull()
	})

	it('draws every look in every mood, lit and flat, where the pet stands', async () => {
		for (const look of LOOKS) {
			for (const mood of MOODS) {
				for (const lit of [true, false]) {
					const alpha = await alphaAt(look.appearance, mood, lit)
					// The head's and the body's middles are solid; the top corners are clear.
					expect(alpha(96, 70)).toBeGreaterThan(250)
					expect(alpha(96, 140)).toBeGreaterThan(250)
					expect(alpha(4, 4)).toBe(0)
					expect(alpha(196, 4)).toBe(0)
				}
			}
		}
	})

	// The renderer switches on a shape's kind: a kind the looks never use would go untested.
	it('is given every kind of shape, and shapes with a transform of their own, by the looks', () => {
		const shapes = LOOKS.flatMap((look) => drawingShapes(petDrawing(petParts(look.appearance))))
		expect(new Set(shapes.map((shape) => shape.kind))).toEqual(
			new Set(['ellipse', 'circle', 'path', 'polygon'])
		)
		expect(shapes.some((shape) => shape.attrs.transform?.startsWith('rotate'))).toBe(true)
		expect(shapes.some((shape) => shape.attrs.gradient)).toBe(true)
	})
})
