/**
 * Plain shapes, as both renderers draw them (the app's PetArt, the site's PetSvg): an element
 * and the attributes it is given as they are. `pet.ts` builds the coat's markings from them and
 * `petDrawing.ts` the rest of the pet.
 */

/**
 * A soft light across a shape: a radial gradient in the part's own space (pet space, so shapes
 * of one part that share a gradient are lit as one, and it moves with the part).
 */
export type Gradient = {
	cx: number
	cy: number
	r: number
	stops: readonly { offset: number; color: string }[]
}

export type Paint = {
	fill?: string
	/** Drawn in place of `fill`, which stays as the flat colour for a renderer that draws none. */
	gradient?: Gradient
	stroke?: string
	strokeWidth?: number
	strokeLinecap?: 'round'
	strokeLinejoin?: 'round'
	opacity?: number
	transform?: string
}

/** One shape: its element and the attributes both renderers pass to it as they are. */
export type Shape =
	| { kind: 'ellipse'; attrs: { cx: number; cy: number; rx: number; ry: number } & Paint }
	| { kind: 'circle'; attrs: { cx: number; cy: number; r: number } & Paint }
	| { kind: 'path'; attrs: { d: string } & Paint }
	| { kind: 'polygon'; attrs: { points: string } & Paint }

export const ellipse = (
	o: { cx: number; cy: number; rx: number; ry: number },
	paint: Paint
): Shape => ({
	kind: 'ellipse',
	attrs: { cx: o.cx, cy: o.cy, rx: o.rx, ry: o.ry, ...paint }
})
export const circle = (o: { cx: number; cy: number; r: number }, paint: Paint): Shape => ({
	kind: 'circle',
	attrs: { cx: o.cx, cy: o.cy, r: o.r, ...paint }
})
export const path = (d: string, paint: Paint): Shape => ({ kind: 'path', attrs: { d, ...paint } })
export const polygon = (points: string, paint: Paint): Shape => ({
	kind: 'polygon',
	attrs: { points, ...paint }
})
