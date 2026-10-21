import { useCallback, useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated'
import type { SkyPhase } from '@app/brand'
import { lookById, type LookId, type Mood } from '@app/contract'
import { PetBubble } from '@/components/pet/PetBubble'
import { PetStage, type PetCue, type StrokeZone, type Zone } from '@/components/pet/PetStage'
import { RiseAndBreathe } from '@/components/pet/RiseAndBreathe'
import { usePetReactions } from '@/hooks/usePetReactions'
import { track } from '@/lib/analytics'
import { Durations, useReducedMotion } from '@/lib/motion'
import { makeStyles } from '@/lib/themedStyles'

// The three pets waiting on Welcome (docs/application/UI/kinpaw-screen-spec-v1.md, "Welcome";
// v3-pet-looks-plan.md, "Phase A4c"). Each is alive, as the pet on Home is: it breathes, blinks,
// moves its tail and ears and answers a touch with its body. The cat in the middle talks: its
// mouth moves as each line appears, and the two beside it look at it. No sound: nobody asked
// the first screen to speak.

/** The pets, pt: 15 % larger than the spec's 130 and 184 (Mert, 2026-10-04). */
const PET_SCALE = 1.15
const SIDE_PET = Math.round(130 * PET_SCALE)
const CENTRE_PET = Math.round(184 * PET_SCALE)
/** How far the side pets tuck in under the centre one (the art has room around each pet). */
const TUCK = Math.round(48 * PET_SCALE)
/** Between one pet's entrance and the next, ms. */
const PET_STEP = 90
/** Between one side pet's breath and the other's, ms: a third of a breath, so never together. */
const BREATH_APART = 1460
/**
 * The cat's square lies over its neighbours'; its touch area is only where its drawing is
 * (measured: from 25 % to 90 % of its square), so a touch on a neighbour's tail or ear, under
 * the cat's square, reaches the neighbour.
 */
const CENTRE_TOUCH = {
	left: Math.round(CENTRE_PET * 0.25),
	right: Math.round(CENTRE_PET * 0.1)
}

type WelcomeLook = Extract<LookId, 'tuxedo' | 'ginger' | 'biscuit'>

/** The centre cat's first words, by the sky outside. */
const GREETING: Record<SkyPhase, string> = {
	morning: 'Good morning! Did you sleep well?',
	afternoon: "Oh, hi! I was hoping you'd come.",
	evening: "You're back! How was your day?",
	night: 'Still up? Me too.'
}
/** Then what living with one is like: it talks with you, and it remembers what you said. */
const LINES: readonly string[] = [
	"Talk to me. I'm a good listener.",
	'How did the exam go? You said it was today.',
	'I remember what you tell me.',
	'Tell me something about you?',
	'I missed you!'
]
/** The first line comes once the pets have risen in; then a new one this often, ms. */
const FIRST_LINE_MS = 900
const LINE_EVERY_MS = 4000
/** How long the cat's mouth moves for a line, ms (the first 300 are the stage's wait). */
const TALK_MS = 1600
/** Where a side pet looks while the cat speaks: towards the middle and a little up (-1 to 1). */
const AT_THE_CAT = { x: 0.9, y: -0.35 }
/**
 * The bubble rises from the upper right of the centre cat's head: its pointed lower-left corner
 * sits just above the right ear, as shares of the cat's drawing.
 */
const BUBBLE_LEFT = Math.round(CENTRE_PET * 0.52)
const BUBBLE_BOTTOM = Math.round(CENTRE_PET * 0.86)
/** Wide enough for a line in two rows, narrow enough to stay on screen. */
const BUBBLE_MAX_W = 176

export function WelcomePets({ phase }: { phase: SkyPhase }) {
	const s = useStyles()
	const reduceMotion = useReducedMotion()
	// Create opens over Welcome, which stays mounted: the pets move and talk only while it shows.
	const [focused, setFocused] = useState(true)
	useFocusEffect(
		useCallback(() => {
			setFocused(true)
			return () => setFocused(false)
		}, [])
	)
	const { index, line, talking } = useCatSays(phase, focused)
	// A new line turns the side pets' eyes to the cat: the left one looks right, the right one left.
	const lookRight = useMemo(() => atTheCat(index, 1), [index])
	const lookLeft = useMemo(() => atTheCat(index, -1), [index])

	return (
		<View style={s.pets}>
			<View style={[s.shadow, s.groundShadow]} />
			{/* The centre pet rises first, then the sides, 90 ms apart. Each then breathes at its
			    own pace, the two side pets a third of a breath apart. */}
			<RiseAndBreathe delay={PET_STEP} breathe={false}>
				<WelcomePet
					look="tuxedo"
					mood="content"
					size={SIDE_PET}
					active={focused}
					cue={lookRight}
					breathDelay={BREATH_APART}
				/>
			</RiseAndBreathe>
			<RiseAndBreathe breathe={false} pointerEvents="box-none" style={s.centrePet}>
				<View pointerEvents="box-none">
					<WelcomePet
						look="ginger"
						mood="happy"
						size={CENTRE_PET}
						active={focused}
						line={line ?? ''}
						// Its mouth says nothing aloud, so under Reduce Motion it stays shut.
						speaking={talking && !reduceMotion}
						touchInset={CENTRE_TOUCH}
					/>
					{line ? (
						<Animated.View
							key={index}
							entering={FadeIn.duration(Durations.base).reduceMotion(ReduceMotion.System)}
							exiting={FadeOut.duration(Durations.exit).reduceMotion(ReduceMotion.System)}
							pointerEvents="none"
							style={s.bubble}
						>
							<PetBubble line={line} compact />
						</Animated.View>
					) : null}
				</View>
			</RiseAndBreathe>
			<RiseAndBreathe delay={PET_STEP * 2} breathe={false}>
				<WelcomePet
					look="biscuit"
					mood="content"
					size={SIDE_PET}
					active={focused}
					cue={lookLeft}
					breathDelay={BREATH_APART * 2}
				/>
			</RiseAndBreathe>
		</View>
	)
}

/** A look at the cat for line `index`, from its left (`side` 1) or its right (-1). */
function atTheCat(index: number, side: 1 | -1): PetCue | null {
	if (index < 0) return null
	return { lookX: side * AT_THE_CAT.x, lookY: AT_THE_CAT.y, hop: false, key: index }
}

/**
 * One of the three: the living pet, without a shadow of its own (they share the ground's). A
 * touch is answered by its body; a pat on the head, a chin scratch, a stroke and a hug make it
 * beam for a moment, as on Meet.
 */
function WelcomePet({
	look,
	mood,
	size,
	active,
	line = '',
	cue = null,
	speaking = false,
	breathDelay,
	touchInset
}: {
	look: WelcomeLook
	mood: Mood
	size: number
	active: boolean
	line?: string
	cue?: PetCue | null
	speaking?: boolean
	breathDelay?: number
	touchInset?: { left: number; right: number }
}) {
	const { appearance, name } = lookById(look)
	const { moment, showMoment } = usePetReactions(appearance.species)

	function tapPet(zone: Zone) {
		if (zone === 'head' || zone === 'chin') showMoment('happy')
		track('welcome_pet_touched', { pet: look, kind: 'tap', zone })
	}

	function strokePet(zone: StrokeZone) {
		showMoment('happy')
		track('welcome_pet_touched', { pet: look, kind: 'stroke', zone })
	}

	function hugPet() {
		showMoment('happy')
		track('welcome_pet_touched', { pet: look, kind: 'hug' })
	}

	return (
		<PetStage
			appearance={appearance}
			mood={moment ?? mood}
			name={name}
			line={line}
			wants={null}
			cue={cue}
			active={active}
			speaking={speaking}
			onPress={tapPet}
			onStroke={strokePet}
			onHug={hugPet}
			beaming={moment === 'happy'}
			hint="Answers your touch"
			shadow={false}
			breathDelay={breathDelay}
			touchInset={touchInset}
			size={size}
		/>
	)
}

/**
 * What the centre cat says: a hello for the time of day, then a line every few seconds about
 * talking with it and what it remembers; `talking` while its mouth moves for a new line. One
 * timer, stopped while Welcome is covered.
 */
function useCatSays(phase: SkyPhase, focused: boolean) {
	// -1 before the first line; 0 is the greeting, then each of LINES in turn.
	const [index, setIndex] = useState(-1)
	// The line it has finished saying.
	const [said, setSaid] = useState(-1)

	useEffect(() => {
		if (!focused) return
		const first = setTimeout(() => setIndex((i) => (i < 0 ? 0 : i)), FIRST_LINE_MS)
		const every = setInterval(
			() => setIndex((i) => (i < 0 ? 0 : (i + 1) % (LINES.length + 1))),
			LINE_EVERY_MS
		)
		return () => {
			clearTimeout(first)
			clearInterval(every)
		}
	}, [focused])

	useEffect(() => {
		if (index < 0) return
		const done = setTimeout(() => setSaid(index), TALK_MS)
		return () => clearTimeout(done)
	}, [index])

	const line = index < 0 ? null : index === 0 ? GREETING[phase] : LINES[index - 1]!
	return { index, line, talking: index >= 0 && said !== index }
}

const useStyles = makeStyles((c) => ({
	// The art has room around each pet; the side pets tuck in under the centre one.
	pets: { flexDirection: 'row', alignItems: 'flex-end' },
	centrePet: { marginHorizontal: -TUCK, zIndex: 1 },
	// Placed on the cat's square, so it rises in with the cat; it sizes to its line from its
	// lower-left corner (a fixed, centred box clipped long lines).
	bubble: {
		position: 'absolute',
		left: BUBBLE_LEFT,
		bottom: BUBBLE_BOTTOM,
		maxWidth: BUBBLE_MAX_W,
		alignItems: 'flex-start'
	},
	shadow: { position: 'absolute', borderRadius: 999, backgroundColor: c.shadowTint },
	groundShadow: { left: 24, right: 8, bottom: 2, height: 14, opacity: 0.55 }
}))
