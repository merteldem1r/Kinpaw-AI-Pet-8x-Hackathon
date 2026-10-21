// This file imports Skia, so nothing the app always loads imports it: PetStage `require`s it,
// and only in a build that has Skia (lib/skia.ts). Elsewhere the pet is PetArt's SVG one
// (docs/application/features/v3-pet-looks-requirements.md, R18).

import { useMemo } from 'react'
import { View } from 'react-native'
import {
	BlurMask,
	Canvas,
	Circle,
	Group,
	Oval,
	Path,
	RadialGradient,
	Shader,
	Skia,
	vec,
	type SkRuntimeEffect,
	type Transforms3d
} from '@shopify/react-native-skia'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'
import type { Mood, PetAppearance } from '@app/contract'
import {
	art,
	BLUSH_DEEP,
	EYE,
	EYE_X,
	EYE_Y,
	PART_KEYS,
	PET_PATHS,
	petDrawing,
	petParts,
	type DrawnPart,
	type PartKey,
	type PetDrawing,
	type PetParts,
	type Shape
} from '@app/brand'
import {
	castsOn,
	lightUniforms,
	ownRound,
	partRounds,
	PET_LIGHT,
	PUPPET,
	type Casts,
	type Round
} from '@/lib/petLight'
import {
	EYE_FLAT,
	EYE_SHUT,
	GLINT_GONE,
	HEAD_FOLLOW,
	LOOK_IRIS,
	LOOK_PUPIL,
	LOOK_Y,
	MOUTH_LINE_GONE,
	MOUTH_SHOWS,
	PAW_TURN,
	TONGUE_SHOWS
} from '@/lib/petMotion'
import { compose, turnAbout, type Matrix, type PetPose } from '@/lib/petPose'

/** Compiled once. A shader with a mistake compiles to null: the pet is then drawn unlit. */
const LIGHT = Skia.RuntimeEffect.Make(PET_LIGHT)

/** A value Skia takes as it is, or animated on the UI thread. */
type Live<T> = T | SharedValue<T>

/** A part's move as Skia takes it: a 3 × 3 matrix, row by row. */
type Move = number[]
const STILL: Move = [1, 0, 0, 0, 1, 0, 0, 0, 1]

/** An SVG matrix ([a b c d e f], lib/petPose.ts) as Skia's rows. */
function rows([a, b, c, d, e, f]: Matrix): Move {
	'worklet'
	return [a, c, e, b, d, f, 0, 0, 1]
}

/** A shut mouth is drawn this flat, never at nothing: a scale of 0 can't be undone. */
const MOUTH_FLAT = 0.01

/** The parts that move on their own. The body's move is the whole view's (PetStage). */
type MovingPart = Exclude<PartKey, 'body'>
export type Moves = Record<MovingPart, Live<Move>>

/** How the face is posed: what PetArt animates shape by shape, as transforms and opacities. */
export type FacePose = {
	/** The cheeks' opacity. */
	blush: Live<number>
	/** Both eyes: where they look, and how far they are shut. The pupils look further. */
	irises: Live<Transforms3d>
	pupils: Live<Transforms3d>
	/** The glints move with the pupils, and go as the eye closes. */
	glints: Live<Transforms3d>
	glintsShown: Live<number>
	/** The lid lines, once the eyes are shut. */
	lidsShown: Live<number>
	/** The mouth's line fades as the mouth opens; the open mouth and the tongue grow down. */
	lineShown: Live<number>
	mouth: Live<Transforms3d>
	mouthShown: Live<number>
	tongue: Live<Transforms3d>
	tongueShown: Live<number>
}

/** A pet standing still, eyes open, mouth shut: what a test draws. */
export function atRest(p: PetParts): { moves: Moves; face: FacePose } {
	return {
		moves: {
			tail: STILL,
			pawLeft: STILL,
			pawRight: STILL,
			head: STILL,
			earLeft: STILL,
			earRight: STILL
		},
		face: {
			blush: p.blush,
			irises: [],
			pupils: [],
			glints: [],
			glintsShown: 1,
			lidsShown: 0,
			lineShown: 1,
			mouth: [{ scaleY: MOUTH_FLAT }],
			mouthShown: 0,
			tongue: [{ scaleY: MOUTH_FLAT }],
			tongueShown: 0
		}
	}
}

/**
 * The living pet, drawn by Skia in Mert's "Puppet" look (v3-pet-looks-requirements.md, R13–R14):
 * the same parts and the same pose as PetArt, each part lit as a soft solid that shadows the
 * next. `lit` off draws it flat, as the SVG pet is, to compare the two renderers shape for shape.
 *
 * Not yet as PetArt: a mood change swaps the face at once, with no crossfade.
 */
export function PetCanvas({
	appearance,
	mood,
	size,
	pose,
	beaming = false,
	lit = true
}: {
	appearance: PetAppearance
	mood: Mood
	size: number
	pose: PetPose
	/** A happy moment: its eyes squeeze into smiling arcs. */
	beaming?: boolean
	lit?: boolean
}) {
	const p = useMemo(() => petParts(appearance, mood), [appearance, mood])
	const drawing = useMemo(() => petDrawing(petParts(appearance)), [appearance])
	const moves = useMoves(drawing, pose)
	const face = useFacePose(p, pose)
	return (
		<View
			style={{ width: size, height: size }}
			importantForAccessibility="no-hide-descendants"
			accessibilityElementsHidden
		>
			<Canvas style={{ width: size, height: size }}>
				<PetScene
					p={p}
					drawing={drawing}
					size={size}
					light={lit ? LIGHT : null}
					beaming={beaming && mood === 'happy'}
					moves={moves}
					face={face}
				/>
			</Canvas>
		</View>
	)
}

/** Each part's move from the pose, as PetArt's MovingPart makes it. */
function useMoves(drawing: PetDrawing, pose: PetPose): Moves {
	const { headTilt, headNod, earLeft, earRight, tail, lookX, pawLeft, pawRight } = pose
	const pivots = useMemo(() => {
		const at = (key: PartKey) => drawing.parts[key].pivot
		return {
			tail: at('tail'),
			pawLeft: at('pawLeft'),
			pawRight: at('pawRight'),
			head: at('head'),
			earLeft: at('earLeft'),
			earRight: at('earRight')
		}
	}, [drawing])
	const head = (): Matrix => {
		'worklet'
		// The head follows the eyes a little: a look to one side moves and tilts it that way.
		return turnAbout(
			pivots.head.x,
			pivots.head.y,
			headTilt.value + lookX.value * HEAD_FOLLOW.tilt,
			lookX.value * HEAD_FOLLOW.shift,
			headNod.value
		)
	}
	return {
		tail: useDerivedValue(() => rows(turnAbout(pivots.tail.x, pivots.tail.y, tail.value))),
		// A lifted paw rises and turns its pad out a little, as a high five does.
		pawLeft: useDerivedValue(() =>
			rows(
				turnAbout(pivots.pawLeft.x, pivots.pawLeft.y, pawLeft.value * PAW_TURN, 0, -pawLeft.value)
			)
		),
		pawRight: useDerivedValue(() =>
			rows(
				turnAbout(
					pivots.pawRight.x,
					pivots.pawRight.y,
					-pawRight.value * PAW_TURN,
					0,
					-pawRight.value
				)
			)
		),
		head: useDerivedValue(() => rows(head())),
		// The ears ride on the head: their own turn (outward), then the head's.
		earLeft: useDerivedValue(() =>
			rows(compose(head(), turnAbout(pivots.earLeft.x, pivots.earLeft.y, -earLeft.value)))
		),
		earRight: useDerivedValue(() =>
			rows(compose(head(), turnAbout(pivots.earRight.x, pivots.earRight.y, earRight.value)))
		)
	}
}

/** The face from the pose: the eyes' look and blink, the mouth with the voice, the blush. */
function useFacePose(p: PetParts, pose: PetPose): FacePose {
	const { open, lookX, lookY, jaw, blush } = pose
	const rest = p.blush
	const { cx, top } = p.mouthOpen
	return {
		blush: useDerivedValue(() => rest + (BLUSH_DEEP - rest) * blush.value),
		irises: useDerivedValue<Transforms3d>(() => [
			{ translateX: lookX.value * LOOK_IRIS },
			{ translateY: lookY.value * LOOK_IRIS * LOOK_Y + EYE_Y },
			{ scaleY: Math.max(open.value, EYE_FLAT) },
			{ translateY: -EYE_Y }
		]),
		pupils: useDerivedValue<Transforms3d>(() => [
			{ translateX: lookX.value * LOOK_PUPIL },
			{ translateY: lookY.value * LOOK_PUPIL * LOOK_Y + EYE_Y },
			{ scaleY: Math.max(open.value, EYE_FLAT) },
			{ translateY: -EYE_Y }
		]),
		glints: useDerivedValue<Transforms3d>(() => [
			{ translateX: lookX.value * LOOK_PUPIL },
			{ translateY: lookY.value * LOOK_PUPIL * LOOK_Y }
		]),
		glintsShown: useDerivedValue<number>(() => (open.value > GLINT_GONE ? 1 : 0)),
		lidsShown: useDerivedValue<number>(() => (open.value < EYE_SHUT ? 1 : 0)),
		lineShown: useDerivedValue(() => 1 - Math.min(1, jaw.value / MOUTH_LINE_GONE)),
		// The open mouth is drawn wide open, and grows down from its top edge with the jaw.
		mouth: useDerivedValue<Transforms3d>(() => [
			{ translateX: cx },
			{ translateY: top },
			{ scaleX: 0.8 + 0.2 * jaw.value },
			{ scaleY: Math.max(jaw.value, MOUTH_FLAT) },
			{ translateX: -cx },
			{ translateY: -top }
		]),
		mouthShown: useDerivedValue<number>(() => (jaw.value > MOUTH_SHOWS ? 1 : 0)),
		tongue: useDerivedValue<Transforms3d>(() => [
			{ translateY: top },
			{ scaleY: Math.max(jaw.value, MOUTH_FLAT) },
			{ translateY: -top }
		]),
		tongueShown: useDerivedValue<number>(() => (jaw.value > TONGUE_SHOWS ? 1 : 0))
	}
}

/**
 * The pet as Skia draws it, at `size` points square: every part's sticker edge, then each part
 * back to front with the face in the head. No hooks: the moves and the face's pose are handed
 * in (PetCanvas makes them from the pose), so a test can draw it off screen with plain values.
 * Lit when it has the `light`'s shader; flat, as the SVG pet, without.
 */
export function PetScene({
	p,
	drawing,
	size,
	light,
	beaming,
	moves,
	face
}: {
	p: PetParts
	drawing: PetDrawing
	size: number
	light: SkRuntimeEffect | null
	beaming: boolean
	moves: Moves
	face: FacePose
}) {
	const rounds = light ? partRounds(p, drawing) : null
	const lit = (key: PartKey): Lit | null =>
		light && rounds
			? { key, effect: light, round: rounds[key], casts: castsOn(key, p, rounds) }
			: null
	const move = (key: PartKey) => (key === 'body' ? undefined : moves[key])
	return (
		<Group
			transform={[
				{ scale: size / VIEW },
				{ translateX: PET_ORIGIN.x },
				{ translateY: PET_ORIGIN.y },
				{ scale: PET_SCALE }
			]}
		>
			{/* The sticker edge is paper, not fur: never lit. */}
			{PART_KEYS.map((key) => (
				<Group key={key} matrix={move(key)}>
					<Shapes shapes={drawing.parts[key].edge} lit={null} />
				</Group>
			))}
			{drawing.order.map((key) => (
				<Group key={key} matrix={move(key)}>
					<Part part={drawing.parts[key]} lit={lit(key)} />
					{key === 'tail' && light ? <Tube p={p} /> : null}
					{key === 'head' ? <Face p={p} pose={face} beaming={beaming} sculpted={!!light} /> : null}
				</Group>
			))}
		</Group>
	)
}

/** Pet space in the drawing's box: viewBox 0 0 200 200, translate(96 118) scale(1.25). */
const VIEW = 200
const PET_ORIGIN = { x: 96, y: 118 } as const
const PET_SCALE = 1.25

/** What lights a part's shapes: the shader, the part as a round, and the shadows cast on it. */
type Lit = { key: PartKey; effect: SkRuntimeEffect; round: Round; casts: Casts }

function Part({ part, lit }: { part: DrawnPart; lit: Lit | null }) {
	return (
		<>
			<Shapes shapes={part.fill} lit={lit} />
			{part.coat.length > 0 ? (
				<Group clip={part.clip.map(outline).join(' ')}>
					<Shapes shapes={part.coat} lit={lit} />
				</Group>
			) : null}
			<Shapes shapes={part.over} lit={lit} standsOut />
		</>
	)
}

/** A clip shape as an SVG path: the body's oval, the head's circle. */
function outline(shape: Shape): string {
	if (shape.kind !== 'ellipse' && shape.kind !== 'circle') return ''
	const { cx, cy } = shape.attrs
	const [rx, ry] =
		shape.kind === 'circle' ? [shape.attrs.r, shape.attrs.r] : [shape.attrs.rx, shape.attrs.ry]
	return `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${rx * 2} 0 a${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`
}

/** A shape's own transform ("translate(x y)", "rotate(deg cx cy)") as Skia takes it. */
function ownTransform(transform: string | undefined) {
	const numbers = (transform?.match(/-?[\d.]+/g) ?? []).map(Number)
	if (transform?.startsWith('translate')) {
		return { transform: [{ translateX: numbers[0] ?? 0 }, { translateY: numbers[1] ?? 0 }] }
	}
	if (transform?.startsWith('rotate')) {
		return {
			transform: [{ rotate: ((numbers[0] ?? 0) * Math.PI) / 180 }],
			origin: { x: numbers[1] ?? 0, y: numbers[2] ?? 0 }
		}
	}
	return {}
}

/**
 * Shapes, in order: each one's fill, then its stroke. Lit, a shape takes the light of the part
 * it lies on, and where it `standsOut` (the muzzle, the belly) of a round of its own; flat, its
 * colour, or the gradient the SVG pet gives it.
 */
function Shapes({
	shapes,
	lit,
	standsOut = false
}: {
	shapes: readonly Shape[]
	lit: Lit | null
	standsOut?: boolean
}) {
	return shapes.map((shape, i) => {
		const { fill, stroke, strokeWidth, strokeLinecap, opacity, transform, gradient } = shape.attrs
		const round = lit ? ((standsOut ? ownRound(lit.key, shape) : null) ?? lit.round) : null
		const paints: { key: string; colour: string; props: object }[] = []
		if (fill && fill !== 'none') paints.push({ key: 'fill', colour: fill, props: {} })
		if (stroke && stroke !== 'none') {
			paints.push({
				key: 'stroke',
				colour: stroke,
				props: {
					style: 'stroke',
					strokeWidth: strokeWidth ?? 1,
					strokeJoin: 'round',
					strokeCap: strokeLinecap ?? 'butt'
				}
			})
		}
		return paints.map(({ key, colour, props }) => {
			const paint = { ...props, ...ownTransform(transform), color: colour, opacity: opacity ?? 1 }
			const inside =
				lit && round ? (
					<>
						<Shader source={lit.effect} uniforms={lightUniforms(round, colour, lit.casts)} />
						<BlurMask blur={PUPPET.soften} style="normal" />
					</>
				) : gradient && key === 'fill' ? (
					<RadialGradient
						c={vec(gradient.cx, gradient.cy)}
						r={gradient.r}
						colors={gradient.stops.map((stop) => stop.color)}
						positions={gradient.stops.map((stop) => stop.offset)}
					/>
				) : null
			const id = `${i}-${key}`
			switch (shape.kind) {
				case 'ellipse': {
					const { cx, cy, rx, ry } = shape.attrs
					return (
						<Oval key={id} x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} {...paint}>
							{inside}
						</Oval>
					)
				}
				case 'circle':
					return (
						<Circle key={id} cx={shape.attrs.cx} cy={shape.attrs.cy} r={shape.attrs.r} {...paint}>
							{inside}
						</Circle>
					)
				case 'path':
					return (
						<Path key={id} path={shape.attrs.d} {...paint}>
							{inside}
						</Path>
					)
				case 'polygon':
					return (
						<Path key={id} path={`M${shape.attrs.points.split(' ').join(' L')} Z`} {...paint}>
							{inside}
						</Path>
					)
			}
		})
	})
}

/** The tail's soft light and shade, as shares of its width: where each lies, how wide, how strong. */
const TUBE = {
	shade: { shift: 0.2, width: 0.26, opacity: 0.16 },
	light: { shift: -0.14, width: 0.3, opacity: 0.2 },
	blur: 0.14
}

/**
 * The tail as a tube: a soft light along the side towards the lamp and a soft shade along the
 * other, over its one stroke.
 */
function Tube({ p }: { p: PetParts }) {
	const w = p.tail.width
	const stripe = ({ shift, width, opacity }: typeof TUBE.shade, colour: string) => (
		<Group transform={[{ translateX: p.tail.x + shift * w }, { translateY: shift * w }]}>
			<Path
				path={p.tail.d}
				style="stroke"
				strokeWidth={width * w}
				strokeCap="round"
				color={colour}
				opacity={opacity}
			>
				<BlurMask blur={w * TUBE.blur} style="normal" />
			</Path>
		</Group>
	)
	return (
		<>
			{stripe(TUBE.shade, art.pet.shadow)}
			{stripe(TUBE.light, art.pet.glint)}
		</>
	)
}

/** A soft glint on the nose, up and to the left: a wet nose catches the light. */
const NOSE_GLINT = { x: -1.1, cat: -34.2, dog: -34.4, r: 0.9, opacity: 0.55, blur: 0.35 }
/** How far past an eye its socket's shade reaches, how far it drops, and how dark, in pet units. */
const SOCKET = { reach: 1.1, drop: 0.5, blur: 1.4, opacity: 0.13 }
/** How far the cheeks' edges blur when the pet is lit: a blush has no outline. */
const BLUSH_BLUR = 0.8

/**
 * The face, as PetArt draws it: the blush, the eyes that blink and look, the mood's mouth line
 * and the mouth that opens with the voice. `sculpted` (the lit pet) sets each eye in a faint
 * socket and puts a glint on the nose.
 */
function Face({
	p,
	pose,
	beaming,
	sculpted
}: {
	p: PetParts
	pose: FacePose
	beaming: boolean
	sculpted: boolean
}) {
	const k = p.colors
	const { cx, top, rx, maxRy } = p.mouthOpen
	const shut = beaming || p.mood === 'sleepy'
	return (
		<>
			{sculpted && !shut
				? EYE_X.map((x) => (
						<Circle
							key={x}
							cx={x}
							cy={EYE_Y + SOCKET.drop}
							r={EYE.iris + SOCKET.reach}
							color={art.pet.shadow}
							opacity={SOCKET.opacity}
						>
							<BlurMask blur={SOCKET.blur} style="normal" />
						</Circle>
					))
				: null}
			<Group opacity={pose.blush}>
				{p.cheeks.map((cheek) => (
					<Oval
						key={cheek.cx}
						x={cheek.cx - cheek.rx}
						y={cheek.cy - cheek.ry}
						width={cheek.rx * 2}
						height={cheek.ry * 2}
						color={k.blush}
					>
						{sculpted ? <BlurMask blur={BLUSH_BLUR} style="normal" /> : null}
					</Oval>
				))}
			</Group>
			{shut ? (
				<Path
					path={beaming ? PET_PATHS.eyesHappy : PET_PATHS.eyesSleepy}
					color={k.ink}
					style="stroke"
					strokeWidth={2.2}
					strokeCap="round"
				/>
			) : (
				<Eyes p={p} pose={pose} />
			)}
			{sculpted ? (
				<Circle
					cx={NOSE_GLINT.x}
					cy={p.isCat ? NOSE_GLINT.cat : NOSE_GLINT.dog}
					r={NOSE_GLINT.r}
					color={k.glint}
					opacity={NOSE_GLINT.opacity}
				>
					<BlurMask blur={NOSE_GLINT.blur} style="normal" />
				</Circle>
			) : null}
			<Group opacity={pose.mouthShown}>
				<Group transform={pose.mouth}>
					<Oval x={cx - rx} y={top} width={rx * 2} height={maxRy * 2} color={k.mouthInside} />
				</Group>
			</Group>
			<Group opacity={pose.tongueShown}>
				<Group transform={pose.tongue}>
					<Oval
						x={cx - rx * 0.55}
						y={top + maxRy * 1.2}
						width={rx * 1.1}
						height={maxRy * 0.8}
						color={k.tongue}
					/>
				</Group>
			</Group>
			<Group opacity={pose.lineShown}>
				{p.mood === 'happy' && !p.isCat ? (
					<Path path={PET_PATHS.dogTongue} color={k.tongue} />
				) : null}
				<Path path={p.mouth} color={k.mouth} style="stroke" strokeWidth={1.8} strokeCap="round" />
			</Group>
		</>
	)
}

/** The open eyes: each a dot or an iris with its pupil, the two glints, the lid line, the brows. */
function Eyes({ p, pose }: { p: PetParts; pose: FacePose }) {
	const { ink, pupil, glint } = p.colors
	const radius = (eye: PetParts['eyes'][number]) => (eye.kind === 'dot' ? EYE.dot : EYE.iris)
	return (
		<>
			<Group transform={pose.irises}>
				{p.eyes.map((eye, i) => (
					<Circle key={i} cx={EYE_X[i]!} cy={EYE_Y} r={radius(eye)} color={eye.fill} />
				))}
			</Group>
			<Group transform={pose.pupils}>
				{p.eyes.map((eye, i) =>
					eye.kind === 'iris' ? (
						<Circle key={i} cx={EYE_X[i]!} cy={EYE_Y} r={EYE.pupil} color={pupil} />
					) : null
				)}
			</Group>
			<Group opacity={pose.glintsShown}>
				<Group transform={pose.glints}>
					{EYE_X.flatMap((x) =>
						EYE.glints.map((g) => (
							<Circle key={`${x}-${g.r}`} cx={x + g.dx} cy={EYE_Y + g.dy} r={g.r} color={glint} />
						))
					)}
				</Group>
			</Group>
			<Group opacity={pose.lidsShown}>
				{p.eyes.map((eye, i) => {
					const x = EYE_X[i]!
					const r = radius(eye)
					return (
						<Path
							key={i}
							path={`M${x - r - 0.4} ${EYE_Y} Q${x} ${EYE_Y + 1.6} ${x + r + 0.4} ${EYE_Y}`}
							color={ink}
							style="stroke"
							strokeWidth={1.8}
							strokeCap="round"
						/>
					)
				})}
			</Group>
			{p.mood === 'sad' ? (
				<Path
					path={PET_PATHS.browsSad}
					color={ink}
					style="stroke"
					strokeWidth={2}
					strokeCap="round"
				/>
			) : null}
		</>
	)
}
