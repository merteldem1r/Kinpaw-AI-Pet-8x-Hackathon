import { useId, type CSSProperties, type ReactNode } from 'react'
import {
	EYE,
	EYE_X,
	EYE_Y,
	PART_KEYS,
	PET_PATHS,
	petDrawing,
	petParts,
	type DrawnPart,
	type Gradient,
	type PartKey,
	type PetParts,
	type Shape
} from '@app/brand'
import type { Mood, PetAppearance } from '@app/contract'

/** The contact shadow's opacity over the palette's shadow tint (as the app's PetArt). */
const SHADOW_OPACITY = 0.55

/**
 * A pet, drawn from the same parts as the app's PetArt
 * (apps/mobile/components/pet/PetArt.tsx, shapes from @app/brand's `petParts`),
 * so the site's pets are the app's pets. A still drawing; LivePet
 * (./LivePet.tsx) is what makes it blink, look and change mood softly.
 *
 * `label` makes it an image for screen readers; leave it out where the pet is
 * decorative or sits inside a labelled phone.
 */
export function PetSvg({
	appearance,
	mood = 'content',
	label,
	shadow = true,
	className,
	style
}: {
	appearance: PetAppearance
	mood?: Mood
	label?: string
	shadow?: boolean
	className?: string
	style?: CSSProperties
}) {
	const p = petParts(appearance, mood)
	const drawing = petDrawing(p)
	// Several pets share a page, so each has its own clips.
	const clipId = `pet-coat-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
	const k = p.colors
	return (
		<svg
			viewBox="0 0 200 200"
			data-mood={mood}
			className={className}
			style={style}
			{...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
		>
			{shadow ? (
				<ellipse
					cx={96}
					cy={185}
					rx={p.shadowRx}
					ry={6}
					style={{ fill: 'rgb(var(--c-shadow-tint))' }}
					opacity={SHADOW_OPACITY}
				/>
			) : null}
			<g transform="translate(96 118) scale(1.25)">
				{PART_KEYS.map((key) => (
					<PartGroup key={key} part={key}>
						<Shapes shapes={drawing.parts[key].edge} />
					</PartGroup>
				))}
				{drawing.order.map((key) => (
					<PartGroup key={key} part={key}>
						<Part part={drawing.parts[key]} clipId={`${clipId}-${key}`} />
						{key === 'head' ? (
							<>
								{p.cheeks.map((cheek) => (
									<ellipse key={cheek.cx} {...cheek} fill={k.blush} opacity={p.blush} />
								))}
								<Eyes p={p} />
								{p.mood === 'happy' && !p.isCat ? (
									<path d={PET_PATHS.dogTongue} fill={k.tongue} />
								) : null}
								<path
									d={p.mouth}
									stroke={k.mouth}
									strokeWidth={1.8}
									fill="none"
									strokeLinecap="round"
								/>
							</>
						) : null}
					</PartGroup>
				))}
			</g>
		</svg>
	)
}

/**
 * One part's group. The tail's is a `pet-tail` group CSS can wag (its cream edge and its fur are
 * two groups, drawn where the drawing puts them, and they wag together).
 */
function PartGroup({ part, children }: { part: PartKey; children: ReactNode }) {
	return part === 'tail' ? <g className="pet-tail">{children}</g> : <>{children}</>
}

/** A part's own shapes: its fill, its coat clipped to its outline, then what goes over it. */
function Part({ part, clipId }: { part: DrawnPart; clipId: string }) {
	return (
		<>
			<Shapes shapes={part.fill} lightId={`${clipId}-light`} />
			{part.coat.length > 0 ? (
				<>
					<defs>
						<clipPath id={clipId}>
							<Shapes shapes={part.clip} />
						</clipPath>
					</defs>
					<g clipPath={`url(#${clipId})`}>
						<Shapes shapes={part.coat} />
					</g>
				</>
			) : null}
			<Shapes shapes={part.over} />
		</>
	)
}

/**
 * Shapes, in order. A shape with a `gradient` is filled with it, under an id from `lightId`;
 * shapes that share one (the body and its shoulders) share its definition.
 */
function Shapes({ shapes, lightId }: { shapes: readonly Shape[]; lightId?: string }) {
	const lights = [...new Set(shapes.map((shape) => shape.attrs.gradient))].filter(
		(light): light is Gradient => !!light && !!lightId
	)
	// A lit shape's fill: its gradient's reference, in place of its flat colour.
	const fillOf = (light?: Gradient) =>
		light && lightId ? { fill: `url(#${lightId}-${lights.indexOf(light)})` } : {}
	return (
		<>
			{lights.length > 0 ? (
				<defs>
					{lights.map((light, i) => (
						<radialGradient
							key={i}
							id={`${lightId}-${i}`}
							gradientUnits="userSpaceOnUse"
							cx={light.cx}
							cy={light.cy}
							r={light.r}
						>
							{light.stops.map((stop) => (
								<stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
							))}
						</radialGradient>
					))}
				</defs>
			) : null}
			{shapes.map((shape, i) => {
				switch (shape.kind) {
					case 'ellipse': {
						const { gradient, ...attrs } = shape.attrs
						return <ellipse key={i} {...attrs} {...fillOf(gradient)} />
					}
					case 'circle': {
						const { gradient, ...attrs } = shape.attrs
						return <circle key={i} {...attrs} {...fillOf(gradient)} />
					}
					case 'path': {
						const { gradient, ...attrs } = shape.attrs
						return <path key={i} {...attrs} {...fillOf(gradient)} />
					}
					case 'polygon': {
						const { gradient, ...attrs } = shape.attrs
						return <polygon key={i} {...attrs} {...fillOf(gradient)} />
					}
				}
			})}
		</>
	)
}

/**
 * The eyes, in two groups CSS can move without redrawing the pet: `pet-gaze`
 * shifts them by `--look-x` / `--look-y` (in the drawing's units; 0 unless a
 * LivePet sets them) and `pet-blink` closes open eyes now and then (only under
 * `.live-pet`). Closed eyes (happy, sleepy) look but never blink; the sad brows
 * stay where they are.
 */
function Eyes({ p }: { p: PetParts }) {
	const { ink, pupil, glint } = p.colors
	if (p.mood === 'happy' || p.mood === 'sleepy') {
		return (
			<g className="pet-gaze">
				<path
					d={p.mood === 'happy' ? PET_PATHS.eyesHappy : PET_PATHS.eyesSleepy}
					stroke={ink}
					strokeWidth={2.2}
					fill="none"
					strokeLinecap="round"
				/>
			</g>
		)
	}
	return (
		<>
			<g className="pet-gaze">
				<g className="pet-blink">
					{p.eyes.map((eye, i) => {
						const x = EYE_X[i]!
						return (
							<g key={x}>
								<circle
									cx={x}
									cy={EYE_Y}
									r={eye.kind === 'dot' ? EYE.dot : EYE.iris}
									fill={eye.fill}
								/>
								{eye.kind === 'iris' ? (
									<circle cx={x} cy={EYE_Y} r={EYE.pupil} fill={pupil} />
								) : null}
								{EYE.glints.map((g) => (
									<circle key={g.r} cx={x + g.dx} cy={EYE_Y + g.dy} r={g.r} fill={glint} />
								))}
							</g>
						)
					})}
				</g>
			</g>
			{p.mood === 'sad' ? (
				<path
					d={PET_PATHS.browsSad}
					stroke={ink}
					strokeWidth={2}
					fill="none"
					strokeLinecap="round"
				/>
			) : null}
		</>
	)
}
