import { useCallback, useMemo, useRef } from 'react'
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated'
import { petParts, toPetSpace, zoneAt, type Zone } from '@app/brand'
import type { Mood, PetAction, PetAppearance } from '@app/contract'
import { useTheme } from '@/contexts/ThemeContext'
import { HOP, usePetBehaviour, type PetCue } from '@/hooks/usePetBehaviour'
import { haptic } from '@/lib/haptics'
import { Springs } from '@/lib/motion'
import { usePetPose } from '@/lib/petPose'
import { hasSkia } from '@/lib/skia'
import { PetArt } from './PetArt'
import type * as Canvas from './PetCanvas'

export type { PetCue } from '@/hooks/usePetBehaviour'
export type { Zone } from '@app/brand'

/** Where a stroke counts as begun: its event names four (docs/application/features/v3-pet-looks-requirements.md). */
export type StrokeZone = 'head' | 'chin' | 'belly' | 'back'
const STROKE_ZONE: Record<Zone, StrokeZone> = {
	head: 'head',
	nose: 'head',
	ear: 'head',
	chin: 'chin',
	belly: 'belly',
	paw: 'belly',
	tail: 'back',
	back: 'back'
}

/**
 * How the pet is drawn (docs/application/features/v3-pet-looks-requirements.md, R21): today's
 * SVG pet, or Skia's, flat (the same shapes, to compare the two) or lit in the Puppet look. A
 * build without Skia draws the SVG pet whatever is asked (R18).
 */
export const PET_RENDERERS = ['svg', 'skia', 'puppet'] as const
export type PetRenderer = (typeof PET_RENDERERS)[number]

/** The pet on Home, pt. */
export const PET_STAGE_SIZE = 260

/** The contact shadow, in the drawing's 200-unit box (PetArt draws the same one when asked). */
const SHADOW = { cx: 96, cy: 185, ry: 6, opacity: 0.55 }
/** How far a finger travels across the pet before it counts as a stroke, pt. */
const STROKE_PT = 140
/** On a small pet, this share of its size instead: a stroke never has to be wider than the pet. */
const STROKE_SHARE = 0.54
/** How long a finger rests on the pet before it is a hug, ms. */
const HUG_MS = 600
/** How long a VoiceOver hug lasts, ms. */
const HUG_ACTION_MS = 1200
/** How far the pet leans towards a stroking finger, degrees. */
const LEAN_MAX = 5

function clampUnit(value: number) {
	'worklet'
	return Math.max(-1, Math.min(1, value))
}

/**
 * The pet on Home, alive in the room (docs/application/UI/kinpaw-screen-spec-v1.md,
 * "Home" → PetStage), and the same pet on Meet, as it arrives, and for each of
 * Welcome's three. What it does by itself is `usePetBehaviour`'s; this is the
 * stage: the drawing, its shadow, and the touch.
 *
 * Where it is touched, it answers its own way (v3-pet-looks-requirements.md, R7):
 * a tap squishes it and says where it landed (`onPress`): a pat on the head, a
 * chin scratch, a boop, an ear, the belly, a paw for a high five, the tail. A
 * finger dragged across it is a stroke: its eyes follow the finger, it leans in,
 * and after a long enough stroke it answers for where the stroke began
 * (`onStroke`, once per stroke). A finger held still is a hug (`onHug`). `line` changing makes it glance
 * at its bubble; `cue` makes it look somewhere (the sky, you).
 *
 * It moves only while `active` (its screen is the one shown) and the app is in the
 * foreground (docs/application/features/v3-pet-looks-requirements.md, R11).
 * Under Reduce Motion it stands still, and a tap or stroke still answers in the
 * bubble.
 */
export function PetStage({
	appearance,
	mood,
	name,
	line,
	wants,
	cue,
	active,
	listening = false,
	speaking = false,
	onPress,
	onStroke,
	onHug,
	onStrokingChange,
	onYawn,
	beaming = false,
	hint = 'Says hello',
	shadow: withShadow = true,
	breathDelay,
	touchInset,
	renderer = 'svg',
	size = PET_STAGE_SIZE
}: {
	appearance: PetAppearance
	mood: Mood
	name: string
	/** What the bubble says; a new line draws a glance at it. */
	line: string
	/** The care action it wants most, if any: an idle glance goes to that button. */
	wants: PetAction | null
	cue: PetCue | null
	/** Its screen is the one shown: the pet moves only then. */
	active: boolean
	/** The mic is held: it tilts its head to listen. */
	listening?: boolean
	/** It is saying its reply out loud: its head nods. */
	speaking?: boolean
	/** A tap, and where it landed. */
	onPress: (zone: Zone) => void
	/** A stroke long enough to count, and where it began. */
	onStroke: (zone: StrokeZone) => void
	/** A hug: a finger held on the pet. */
	onHug: () => void
	/** A finger is on the pet and moving (the screen should not scroll under it). */
	onStrokingChange?: (stroking: boolean) => void
	/** It yawned: the screen can float a few z's. */
	onYawn?: () => void
	/** A happy moment: its eyes squeeze into smiling arcs (PetArt's `beaming`). */
	beaming?: boolean
	/** What VoiceOver says a tap does: on Home, the bubble says hello. */
	hint?: string
	/** Its own contact shadow; off where pets stand together on one (Welcome). */
	shadow?: boolean
	/** Its breathing starts this late, ms: pets that stand together never breathe as one. */
	breathDelay?: number
	/**
	 * How far in from its square's left and right edges its touch area starts, pt. Where pets
	 * overlap (Welcome), a touch outside it falls through to the neighbour underneath; without
	 * it, the whole square is the pet's.
	 */
	touchInset?: { left: number; right: number }
	/** DEV ONLY until Mert picks (R21): Skia's pet in place of the SVG one. */
	renderer?: PetRenderer
	/** The pet's square, pt; Home fits it to the screen. */
	size?: number
}) {
	const { colors: c } = useTheme()
	const pose = usePetPose()
	const {
		react,
		stroked: strokedOn,
		hug,
		busyFor,
		freeAfter
	} = usePetBehaviour(pose, {
		appearance,
		mood,
		wants,
		line,
		cue,
		active,
		listening,
		speaking,
		breathDelay,
		onYawn
	})
	const { breath, amp, slump, hop, squashX, squashY, lean, purr, lookX, lookY } = pose

	const strokeAfter = Math.min(STROKE_PT, size * STROKE_SHARE)
	const strokeDistance = useSharedValue(0)
	const stroked = useSharedValue(false)
	const hugging = useSharedValue(false)

	// ─── Touch ────────────────────────────────────────────────────────────────

	// The shapes at rest, for where a touch lands (the same in every mood).
	const parts = useMemo(() => petParts(appearance), [appearance])
	/** The zone under a point on the stage, and where it is in pet space. */
	const zoneUnder = useCallback(
		(x: number, y: number) => {
			const at = toPetSpace(x, y, size)
			return { zone: zoneAt(parts, at.x, at.y), x: at.x }
		},
		[parts, size]
	)
	// Where the stroke under way began.
	const strokeFrom = useRef<StrokeZone>('head')

	const tapOn = useCallback(
		(zone: Zone, x: number) => {
			haptic.select()
			react(zone, x)
			onPress(zone)
		},
		[react, onPress]
	)

	const handleTap = useCallback(
		(x: number, y: number) => {
			const under = zoneUnder(x, y)
			tapOn(under.zone, under.x)
		},
		[zoneUnder, tapOn]
	)

	const handleStroke = useCallback(() => {
		strokedOn(strokeFrom.current)
		onStroke(strokeFrom.current)
	}, [strokedOn, onStroke])

	const setStroking = useCallback(
		(stroking: boolean, x = 0, y = 0) => {
			if (stroking) {
				strokeFrom.current = STROKE_ZONE[zoneUnder(x, y).zone]
				busyFor(60_000)
			} else freeAfter(600)
			onStrokingChange?.(stroking)
		},
		[zoneUnder, busyFor, freeAfter, onStrokingChange]
	)

	const startHug = useCallback(() => {
		hug(true)
		onHug()
	}, [hug, onHug])
	const endHug = useCallback(() => hug(false), [hug])

	const tap = Gesture.Tap()
		.maxDistance(10)
		.onStart((e) => {
			squashY.value = withSequence(withTiming(0.9, { duration: 90 }), withSpring(1, Springs.settle))
			squashX.value = withSequence(
				withTiming(1.06, { duration: 90 }),
				withSpring(1, Springs.settle)
			)
			runOnJS(handleTap)(e.x, e.y)
		})

	// A finger held still on the pet is a hug; let go and it ends.
	const hold = Gesture.LongPress()
		.minDuration(HUG_MS)
		.onStart(() => {
			hugging.value = true
			runOnJS(startHug)()
		})
		.onFinalize(() => {
			if (!hugging.value) return
			hugging.value = false
			runOnJS(endHug)()
		})

	const pan = Gesture.Pan()
		.minDistance(10)
		.onStart((e) => {
			strokeDistance.value = 0
			stroked.value = false
			runOnJS(setStroking)(true, e.x, e.y)
		})
		.onChange((e) => {
			lookX.value = clampUnit((e.x - size / 2) / (size * 0.4))
			lookY.value = clampUnit((e.y - size * 0.32) / (size * 0.3))
			lean.value = Math.max(-LEAN_MAX, Math.min(LEAN_MAX, e.translationX / 25))
			strokeDistance.value += Math.hypot(e.changeX, e.changeY)
			if (!stroked.value && strokeDistance.value > strokeAfter) {
				stroked.value = true
				runOnJS(handleStroke)()
			}
		})
		.onFinalize(() => {
			lookX.value = withTiming(0, { duration: 400 })
			lookY.value = withTiming(0, { duration: 400 })
			lean.value = withSpring(0, Springs.settle)
			runOnJS(setStroking)(false)
		})

	// A tap waits only for the hold to fail, which it does the moment the finger lifts.
	const gesture = Gesture.Race(pan, Gesture.Exclusive(hold, tap))

	function onAccessibilityAction(event: AccessibilityActionEvent) {
		switch (event.nativeEvent.actionName) {
			case 'activate':
				tapOn('back', 0)
				return
			case 'patHead':
				tapOn('head', 0)
				return
			case 'stroke':
				strokeFrom.current = 'head'
				handleStroke()
				return
			case 'scratchChin':
				strokeFrom.current = 'chin'
				handleStroke()
				return
			case 'rubBelly':
				strokeFrom.current = 'belly'
				handleStroke()
				return
			case 'hug':
				startHug()
				setTimeout(endHug, HUG_ACTION_MS)
				return
		}
	}

	// ─── Drawing ──────────────────────────────────────────────────────────────

	const body = useAnimatedStyle(() => ({
		transform: [
			{ translateY: slump.value - breath.value * amp.value - hop.value },
			{ rotate: `${lean.value + purr.value}deg` },
			{ scaleX: squashX.value * (1 - breath.value * 0.008) },
			{ scaleY: squashY.value * (1 + breath.value * 0.014) }
		]
	}))

	const k = size / 200
	const shadowRx = petParts(appearance, mood).shadowRx
	const shadow = useAnimatedStyle(() => {
		const up = Math.max(0, hop.value)
		return {
			opacity: SHADOW.opacity * (1 - up / (HOP * 2.2)),
			transform: [{ scaleX: 1 - up / (HOP * 4) + breath.value * 0.02 }]
		}
	})

	const art =
		renderer !== 'svg' && hasSkia() ? (
			<SkiaPet
				appearance={appearance}
				mood={mood}
				size={size}
				pose={pose}
				beaming={beaming}
				lit={renderer === 'puppet'}
			/>
		) : (
			<PetArt
				appearance={appearance}
				mood={mood}
				size={size}
				shadow={false}
				pose={pose}
				beaming={beaming}
			/>
		)
	// With a touch area of its own, only that takes touches: the rest of the square lets them
	// through to whatever is underneath.
	const through = touchInset ? 'box-none' : 'auto'

	return (
		<View style={[s.stage, { width: size, height: size }]} pointerEvents={through}>
			{withShadow ? (
				<Animated.View
					pointerEvents="none"
					style={[
						s.shadow,
						{
							left: (SHADOW.cx - shadowRx) * k,
							top: (SHADOW.cy - SHADOW.ry) * k,
							width: shadowRx * 2 * k,
							height: SHADOW.ry * 2 * k,
							borderRadius: SHADOW.ry * k,
							backgroundColor: c.shadowTint
						},
						shadow
					]}
				/>
			) : null}
			<GestureDetector gesture={gesture}>
				<Animated.View
					pointerEvents={through}
					style={[StyleSheet.absoluteFill, s.body, body]}
					accessible
					accessibilityRole="button"
					accessibilityLabel={`${name}, ${mood}`}
					accessibilityHint={hint}
					accessibilityActions={[
						{ name: 'activate' },
						{ name: 'patHead', label: 'Pat head' },
						{ name: 'stroke', label: 'Stroke' },
						{ name: 'scratchChin', label: 'Scratch chin' },
						{ name: 'rubBelly', label: 'Rub belly' },
						{ name: 'hug', label: 'Hug' }
					]}
					onAccessibilityAction={onAccessibilityAction}
				>
					{touchInset ? (
						<>
							{/* Neither is collapsable: each must stay a view of its own, one to let the
							    touch past the drawing, one (empty) to take it. */}
							<View collapsable={false} pointerEvents="none">
								{art}
							</View>
							<View
								collapsable={false}
								style={[s.touch, { left: touchInset.left, right: touchInset.right }]}
							/>
						</>
					) : (
						art
					)}
				</Animated.View>
			</GestureDetector>
		</View>
	)
}

/** Skia's pet, loaded only where the build has Skia: importing Skia elsewhere throws. */
function SkiaPet(props: Parameters<typeof Canvas.PetCanvas>[0]) {
	// A require, not an import: an import is hoisted and would load Skia in every build.
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const { PetCanvas } = require('./PetCanvas') as typeof Canvas
	return <PetCanvas {...props} />
}

const s = StyleSheet.create({
	stage: { alignSelf: 'center' },
	shadow: { position: 'absolute' },
	touch: { position: 'absolute', top: 0, bottom: 0 },
	body: { transformOrigin: 'bottom' }
})
