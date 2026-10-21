import {
	memo,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type ComponentType,
	type ReactNode
} from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
	runOnJS,
	useAnimatedProps,
	useSharedValue,
	withTiming,
	type SharedValue
} from 'react-native-reanimated'
import Svg, {
	Circle,
	ClipPath,
	Defs,
	Ellipse,
	G,
	Path,
	Polygon,
	RadialGradient,
	Stop,
	type GProps
} from 'react-native-svg'
import { appearanceKey, type Mood, type PetAppearance } from '@app/contract'
import { useTheme } from '@/contexts/ThemeContext'
import { Timings, useReducedMotion } from '@/lib/motion'
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
import { compose, turnAbout, type EyeMotion, type Matrix, type PetPose } from '@/lib/petPose'
import {
	BLUSH_DEEP,
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
	type PetDrawing as Drawing,
	type PetParts,
	type Shape
} from '@app/brand'

/** The contact shadow's opacity over the palette's shadow tint (spec: 55%). */
const SHADOW_OPACITY = 0.55

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedG = Animated.createAnimatedComponent(G)
/**
 * A group moved by its native `matrix`. Reanimated sets animated props on the native view
 * directly, past react-native-svg's JS, which turns a `transform` into this same `matrix`; so
 * `matrix` is the prop that moves a group on the UI thread. It isn't in GProps' types, hence
 * the wider type.
 */
const AnimatedPartG = Animated.createAnimatedComponent(
	G as unknown as ComponentType<GProps & { matrix?: Matrix }>
)

/**
 * A pet, drawn in code from its appearance, in a mood, at `size` points square
 * (docs/application/UI/kinpaw-screen-spec-v1.md, "Pet art contract"). A mood
 * change crossfades the face over the preset's `base` duration (at once under
 * Reduce Motion); the rest of the pet is the same in every mood, so it is drawn
 * once and never fades. The contact shadow is in the palette's shadow tint, so it
 * follows the scheme.
 *
 * `label` is what VoiceOver reads: "Mochi, happy" once the pet has a name, or
 * `describeAppearance()` before; leave it out where the pet is decorative or
 * part of a labelled group.
 */
export function PetArt({
	appearance,
	mood,
	size,
	label,
	shadow = true,
	pose,
	beaming = false,
	style
}: {
	appearance: PetAppearance
	mood: Mood
	size: number
	label?: string
	shadow?: boolean
	/**
	 * A living pet's pose (lib/petPose.ts): its eyes blink and look, and its head, ears and tail
	 * move. Left out, the pet is a still drawing with nothing animated: every pet but the one on
	 * Home and Meet and Welcome's three (docs/application/features/v3-pet-looks-requirements.md, R11).
	 */
	pose?: PetPose
	/**
	 * A happy moment (after care, a kind word): its eyes squeeze into smiling arcs. A happy pet
	 * otherwise keeps its eyes open, so the best-cared-for pet still looks at you.
	 */
	beaming?: boolean
	style?: StyleProp<ViewStyle>
}) {
	const reduceMotion = useReducedMotion()
	const face: FaceKey = beaming && mood === 'happy' ? 'beaming' : mood
	// The face on top, and the one it is fading in over (null once the fade is done).
	const [shown, setShown] = useState<{ mood: FaceKey; previous: FaceKey | null }>({
		mood: face,
		previous: null
	})
	const fade = useSharedValue(1)
	// The face last put on top: a new one fades in over it.
	const lastFace = useRef(face)

	useEffect(() => {
		const previous = lastFace.current
		if (face === previous) return
		lastFace.current = face
		if (reduceMotion) {
			setShown({ mood: face, previous: null })
			return
		}
		setShown({ mood: face, previous })
		const settle = () => setShown((current) => ({ ...current, previous: null }))
		fade.value = 0
		fade.value = withTiming(1, Timings.base, (finished) => {
			if (finished) runOnJS(settle)()
		})
	}, [face, reduceMotion, fade])

	return (
		<View
			style={[{ width: size, height: size }, style]}
			accessible={!!label}
			accessibilityRole={label ? 'image' : undefined}
			accessibilityLabel={label}
			importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
			accessibilityElementsHidden={!label}
		>
			<PetDrawing
				appearance={appearance}
				mood={shown.mood}
				previousMood={shown.previous}
				fade={fade}
				size={size}
				shadow={shadow}
				pose={pose}
			/>
		</View>
	)
}

/** A face: a mood, or a happy moment's beaming one (a happy face with its eyes squeezed shut). */
type FaceKey = Mood | 'beaming'

const moodOf = (face: FaceKey): Mood => (face === 'beaming' ? 'happy' : face)

type DrawingProps = {
	appearance: PetAppearance
	mood: FaceKey
	previousMood: FaceKey | null
	fade: SharedValue<number>
	size: number
	shadow: boolean
	pose?: PetPose
}

/**
 * The pet in one SVG, in its parts (@app/brand's `petDrawing`): every part's sticker edge, then
 * each part back to front, with the face in the head, crossfading from `previousMood` while one
 * is set. Never two whole pets: mounting a second drawing for every mood change doubled the
 * work and, on iOS, briefly showed the previous look's shapes (a ghost of the old tail in the
 * builder). Memoized on what it draws (`samePet`): a builder tap redraws only the pets that
 * changed, not every preview tile.
 */
const PetDrawing = memo(function PetDrawing({
	appearance,
	mood,
	previousMood,
	fade,
	size,
	shadow,
	pose
}: DrawingProps) {
	const { colors: c } = useTheme()
	// The body is the same in every mood (@app/brand's petDrawing), so it waits only on the look.
	const body = useMemo(() => petParts(appearance), [appearance])
	const drawing = useMemo(() => petDrawing(body), [body])
	const face = useMemo(() => petParts(appearance, moodOf(mood)), [appearance, mood])
	const previousFace = useMemo(
		() => (previousMood ? petParts(appearance, moodOf(previousMood)) : null),
		[appearance, previousMood]
	)
	const fadeIn = useAnimatedProps(() => ({ opacity: fade.value }))
	const fadeOut = useAnimatedProps(() => ({ opacity: 1 - fade.value }))
	const clipId = `pet-coat-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
	return (
		<Svg width={size} height={size} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
			{shadow ? (
				<Ellipse
					cx={96}
					cy={185}
					rx={body.shadowRx}
					ry={6}
					fill={c.shadowTint}
					opacity={SHADOW_OPACITY}
				/>
			) : null}
			<G transform="translate(96 118) scale(1.25)">
				{PART_KEYS.map((key) => (
					<PartGroup key={`edge-${key}`} part={key} drawing={drawing} pose={pose}>
						<Shapes shapes={drawing.parts[key].edge} />
					</PartGroup>
				))}
				{drawing.order.map((key) => (
					<PartGroup key={key} part={key} drawing={drawing} pose={pose}>
						<Part part={drawing.parts[key]} clipId={`${clipId}-${key}`} />
						{key === 'head' ? (
							<>
								{previousFace ? (
									<AnimatedG animatedProps={fadeOut}>
										<Face p={previousFace} beaming={previousMood === 'beaming'} />
									</AnimatedG>
								) : null}
								<AnimatedG animatedProps={fadeIn}>
									<Face p={face} motion={pose} beaming={mood === 'beaming'} />
								</AnimatedG>
							</>
						) : null}
					</PartGroup>
				))}
			</G>
		</Svg>
	)
}, samePet)

/**
 * Whether a drawing would come out the same: the appearance by value (a builder tile builds a
 * new object on every tap for the same pet), everything else by identity.
 */
function samePet(a: DrawingProps, b: DrawingProps): boolean {
	return (
		appearanceKey(a.appearance) === appearanceKey(b.appearance) &&
		a.mood === b.mood &&
		a.previousMood === b.previousMood &&
		a.fade === b.fade &&
		a.size === b.size &&
		a.shadow === b.shadow &&
		a.pose === b.pose
	)
}

/**
 * A part's group: still for a still pet and for the body (PetStage moves the whole view), and
 * turned about its pivot on the UI thread for the head, the ears and the tail. The ears ride on
 * the head: their turn is their own, then the head's.
 */
function PartGroup({
	part,
	drawing,
	pose,
	children
}: {
	part: PartKey
	drawing: Drawing
	pose?: PetPose
	children: ReactNode
}) {
	if (!pose || part === 'body') return <G>{children}</G>
	return (
		<MovingPart part={part} drawing={drawing} pose={pose}>
			{children}
		</MovingPart>
	)
}

function MovingPart({
	part,
	drawing,
	pose,
	children
}: {
	part: Exclude<PartKey, 'body'>
	drawing: Drawing
	pose: PetPose
	children: ReactNode
}) {
	const { x, y } = drawing.parts[part].pivot
	const neck = drawing.parts.head.pivot
	const { headTilt, headNod, earLeft, earRight, tail, lookX, pawLeft, pawRight } = pose
	const animatedProps = useAnimatedProps(() => {
		if (part === 'tail') return { matrix: turnAbout(x, y, tail.value) }
		// A lifted paw rises and turns its pad out a little, as a high five does.
		if (part === 'pawLeft')
			return { matrix: turnAbout(x, y, pawLeft.value * PAW_TURN, 0, -pawLeft.value) }
		if (part === 'pawRight') {
			return { matrix: turnAbout(x, y, -pawRight.value * PAW_TURN, 0, -pawRight.value) }
		}
		// The head follows the eyes a little: a look to one side moves and tilts it that way.
		const head = turnAbout(
			neck.x,
			neck.y,
			headTilt.value + lookX.value * HEAD_FOLLOW.tilt,
			lookX.value * HEAD_FOLLOW.shift,
			headNod.value
		)
		if (part === 'head') return { matrix: head }
		// Outward: the left ear turns anticlockwise, the right one clockwise.
		const ear = part === 'earLeft' ? -earLeft.value : earRight.value
		return { matrix: compose(head, turnAbout(x, y, ear)) }
	})
	return <AnimatedPartG animatedProps={animatedProps}>{children}</AnimatedPartG>
}

/** A part's own shapes: its fill, its coat clipped to its outline, then what goes over it. */
function Part({ part, clipId }: { part: DrawnPart; clipId: string }) {
	return (
		<>
			<Shapes shapes={part.fill} lightId={`${clipId}-light`} />
			{part.coat.length > 0 ? (
				<>
					<Defs>
						<ClipPath id={clipId}>
							<Shapes shapes={part.clip} />
						</ClipPath>
					</Defs>
					<G clipPath={`url(#${clipId})`}>
						<Shapes shapes={part.coat} />
					</G>
				</>
			) : null}
			<Shapes shapes={part.over} />
		</>
	)
}

/**
 * The face, the one part a mood changes: the cheeks' blush, the eyes, the mood's mouth line (and
 * a happy dog's tongue), and for a living pet the mouth that opens as it speaks.
 */
function Face({ p, motion, beaming }: { p: PetParts; motion?: PetPose; beaming: boolean }) {
	const k = p.colors
	const line = (
		<>
			{p.mood === 'happy' && !p.isCat ? <Path d={PET_PATHS.dogTongue} fill={k.tongue} /> : null}
			<Path d={p.mouth} stroke={k.mouth} strokeWidth={1.8} fill="none" strokeLinecap="round" />
		</>
	)
	return (
		<>
			{motion ? (
				<LivingBlush p={p} blush={motion.blush} />
			) : (
				p.cheeks.map((cheek) => (
					<Ellipse key={cheek.cx} {...cheek} fill={k.blush} opacity={p.blush} />
				))
			)}
			<Eyes p={p} motion={motion} beaming={beaming} />
			{motion ? <SpeakingMouth p={p} jaw={motion.jaw} line={line} /> : line}
		</>
	)
}

/** The cheeks of a living pet: the mood's blush, deepening with `blush` (a stroke, a hug). */
function LivingBlush({ p, blush }: { p: PetParts; blush: SharedValue<number> }) {
	const rest = p.blush
	const deepen = useAnimatedProps(() => ({ opacity: rest + (BLUSH_DEEP - rest) * blush.value }))
	return (
		<AnimatedG opacity={rest} animatedProps={deepen}>
			{p.cheeks.map((cheek) => (
				<Ellipse key={cheek.cx} {...cheek} fill={p.colors.blush} />
			))}
		</AnimatedG>
	)
}

/**
 * A mouth that opens with `jaw` (the voice, a meow): an oval under the nose that grows down, with
 * the tongue at its bottom once it is open wide enough; the mood's line fades as it opens.
 */
function SpeakingMouth({
	p,
	jaw,
	line
}: {
	p: PetParts
	jaw: SharedValue<number>
	line: ReactNode
}) {
	const { cx, top, rx, maxRy } = p.mouthOpen
	const lineProps = useAnimatedProps(() => ({
		opacity: 1 - Math.min(1, jaw.value / MOUTH_LINE_GONE)
	}))
	const mouthProps = useAnimatedProps(() => {
		const ry = Math.max(maxRy * jaw.value, 0.01)
		return {
			cy: top + ry,
			rx: rx * (0.8 + 0.2 * jaw.value),
			ry,
			opacity: jaw.value > MOUTH_SHOWS ? 1 : 0
		}
	})
	const tongueProps = useAnimatedProps(() => {
		const ry = maxRy * jaw.value
		return {
			cy: top + ry * 1.6,
			rx: rx * 0.55,
			ry: Math.max(ry * 0.4, 0.01),
			opacity: jaw.value > TONGUE_SHOWS ? 1 : 0
		}
	})
	return (
		<>
			<AnimatedEllipse
				cx={cx}
				cy={top}
				rx={rx}
				ry={0.01}
				fill={p.colors.mouthInside}
				opacity={0}
				animatedProps={mouthProps}
			/>
			<AnimatedEllipse
				cx={cx}
				cy={top}
				rx={rx}
				ry={0.01}
				fill={p.colors.tongue}
				opacity={0}
				animatedProps={tongueProps}
			/>
			<AnimatedG animatedProps={lineProps}>{line}</AnimatedG>
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
				<Defs>
					{lights.map((light, i) => (
						<RadialGradient
							key={i}
							id={`${lightId}-${i}`}
							gradientUnits="userSpaceOnUse"
							cx={light.cx}
							cy={light.cy}
							r={light.r}
							fx={light.cx}
							fy={light.cy}
						>
							{light.stops.map((stop) => (
								<Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
							))}
						</RadialGradient>
					))}
				</Defs>
			) : null}
			{shapes.map((shape, i) => {
				switch (shape.kind) {
					case 'ellipse': {
						const { gradient, ...attrs } = shape.attrs
						return <Ellipse key={i} {...attrs} {...fillOf(gradient)} />
					}
					case 'circle': {
						const { gradient, ...attrs } = shape.attrs
						return <Circle key={i} {...attrs} {...fillOf(gradient)} />
					}
					case 'path': {
						const { gradient, ...attrs } = shape.attrs
						return <Path key={i} {...attrs} {...fillOf(gradient)} />
					}
					case 'polygon': {
						const { gradient, ...attrs } = shape.attrs
						return <Polygon key={i} {...attrs} {...fillOf(gradient)} />
					}
				}
			})}
		</>
	)
}

function Eyes({ p, motion, beaming }: { p: PetParts; motion?: EyeMotion; beaming: boolean }) {
	const { ink, pupil, glint } = p.colors
	if (beaming || p.mood === 'sleepy') {
		return (
			<Path
				d={beaming ? PET_PATHS.eyesHappy : PET_PATHS.eyesSleepy}
				stroke={ink}
				strokeWidth={2.2}
				fill="none"
				strokeLinecap="round"
			/>
		)
	}
	return (
		<>
			{p.eyes.map((eye, i) => {
				const x = EYE_X[i]!
				if (motion) return <MovingEye key={x} x={x} eye={eye} p={p} motion={motion} />
				return (
					<G key={x}>
						<Circle cx={x} cy={EYE_Y} r={eye.kind === 'dot' ? EYE.dot : EYE.iris} fill={eye.fill} />
						{eye.kind === 'iris' ? <Circle cx={x} cy={EYE_Y} r={EYE.pupil} fill={pupil} /> : null}
						{EYE.glints.map((g) => (
							<Circle key={g.r} cx={x + g.dx} cy={EYE_Y + g.dy} r={g.r} fill={glint} />
						))}
					</G>
				)
			})}
			{p.mood === 'sad' ? (
				<Path
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

/** One open eye that blinks (squashes to a lid line) and looks where `motion` says. */
function MovingEye({
	x,
	eye,
	p,
	motion
}: {
	x: number
	eye: PetParts['eyes'][number]
	p: PetParts
	motion: EyeMotion
}) {
	const { ink, pupil, glint } = p.colors
	const { open, lookX, lookY } = motion
	const r = eye.kind === 'dot' ? EYE.dot : EYE.iris
	const iris = useAnimatedProps(() => ({
		cx: x + lookX.value * LOOK_IRIS,
		cy: EYE_Y + lookY.value * LOOK_IRIS * LOOK_Y,
		ry: r * Math.max(open.value, EYE_FLAT)
	}))
	const pupilProps = useAnimatedProps(() => ({
		cx: x + lookX.value * LOOK_PUPIL,
		cy: EYE_Y + lookY.value * LOOK_PUPIL * LOOK_Y,
		ry: EYE.pupil * Math.max(open.value, EYE_FLAT)
	}))
	const lid = useAnimatedProps(() => ({ opacity: open.value < EYE_SHUT ? 1 : 0 }))
	return (
		<G>
			<AnimatedEllipse cx={x} cy={EYE_Y} rx={r} ry={r} fill={eye.fill} animatedProps={iris} />
			{eye.kind === 'iris' ? (
				<AnimatedEllipse
					cx={x}
					cy={EYE_Y}
					rx={EYE.pupil}
					ry={EYE.pupil}
					fill={pupil}
					animatedProps={pupilProps}
				/>
			) : null}
			{EYE.glints.map((g) => (
				<MovingGlint key={g.r} x={x + g.dx} y={EYE_Y + g.dy} r={g.r} fill={glint} motion={motion} />
			))}
			<AnimatedPath
				d={`M${x - r - 0.4} ${EYE_Y} Q${x} ${EYE_Y + 1.6} ${x + r + 0.4} ${EYE_Y}`}
				stroke={ink}
				strokeWidth={1.8}
				strokeLinecap="round"
				fill="none"
				opacity={0}
				animatedProps={lid}
			/>
		</G>
	)
}

/** A glint that moves with the pupil and goes while the eye is closing. */
function MovingGlint({
	x,
	y,
	r,
	fill,
	motion
}: {
	x: number
	y: number
	r: number
	fill: string
	motion: EyeMotion
}) {
	const { open, lookX, lookY } = motion
	const animatedProps = useAnimatedProps(() => ({
		cx: x + lookX.value * LOOK_PUPIL,
		cy: y + lookY.value * LOOK_PUPIL * LOOK_Y,
		opacity: open.value > GLINT_GONE ? 1 : 0
	}))
	return <AnimatedCircle cx={x} cy={y} r={r} fill={fill} animatedProps={animatedProps} />
}
