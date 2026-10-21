import { useCallback, useEffect, useRef } from 'react'
import {
	cancelAnimation,
	useAnimatedReaction,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated'
import type { Zone } from '@app/brand'
import type { Mood, PetAction, PetAppearance } from '@app/contract'
import { haptic } from '@/lib/haptics'
import { useAppActive } from '@/hooks/useAppActive'
import { useLatest } from '@/hooks/useLatest'
import { Easings, Springs, Timings, useReducedMotion } from '@/lib/motion'
import {
	EAR_TWITCH_EVERY,
	earMotion,
	LISTEN_TILT,
	NOD,
	tailMotion,
	type EarMotion,
	type TailMotion
} from '@/lib/petMotion'
import { soundMouth } from '@/lib/petMouth'
import type { PetPose } from '@/lib/petPose'
import { voiceSampled } from '@/lib/petVoice'

// What the pet on Home does by itself (docs/application/UI/kinpaw-screen-spec-v1.md, "Home" →
// PetStage; v3-pet-looks-requirements.md, R1, R3–R5): it breathes at its mood's pace, blinks,
// glances around, and now and then does something: a hop when happy, a stretch, a yawn when
// sleepy, a sigh when sad, a look at the button it wants. Its tail moves the way its species'
// does in its mood, its ears twitch, perk up and droop, it tilts its head to listen while the mic
// is held and nods while it speaks. The numbers are lib/petMotion.ts's. It writes the pose;
// PetStage's gestures write it too, and hold the idle moves off while a finger is on the pet.
//
// It all stops while the pet isn't seen (another tab, a screen over Home, the app in the
// background) and starts again when it is (R11): no frame is drawn for a pet nobody sees. Under
// Reduce Motion it holds still: the tail and ears keep their mood's posture, without moving.

/** Where the pet looks for a moment: -1 to 1 on each axis (right, down). */
export type PetCue = { lookX: number; lookY: number; hop: boolean; key: number }

/** Blinks come every this many ms, at random; some are doubles. */
const BLINK_EVERY: [number, number] = [2400, 6000]
const DOUBLE_BLINK = 0.18
/** Small glances around the room. */
const GLANCE_EVERY: [number, number] = [3500, 8000]
/** A bigger idle move (a hop, a stretch, a yawn). */
const IDLE_EVERY: [number, number] = [11000, 22000]
/** How hard a hop goes up, pt. */
export const HOP = 14
/** Where the care buttons are from the pet's eyes. */
const BUTTON_LOOK: Record<PetAction, number> = { feed: -0.8, play: 0, pet: 0.8 }

/** Breathing by mood: how far (pt), how slow (half a breath, ms), how slumped (pt down). */
export const BREATH: Record<Mood, { amp: number; halfMs: number; slump: number }> = {
	happy: { amp: 5, halfMs: 1700, slump: 0 },
	content: { amp: 4, halfMs: 2200, slump: 0 },
	sad: { amp: 2.5, halfMs: 2900, slump: 4 },
	sleepy: { amp: 2, halfMs: 3100, slump: 3 }
}

type IdleMove = 'hop' | 'doubleHop' | 'sway' | 'stretch' | 'lookAround' | 'yawn' | 'sigh' | 'wanted'

const IDLE_MOVES: Record<Mood, readonly IdleMove[]> = {
	happy: ['doubleHop', 'sway', 'hop', 'lookAround'],
	content: ['stretch', 'lookAround', 'sway', 'hop'],
	sad: ['sigh', 'lookAround'],
	sleepy: ['yawn', 'yawn', 'stretch']
}

/** How long the cheeks stay deep after a touch before they fade to the mood's, ms. */
const BLUSH_HOLD = 1400
/** How far the ears go back when it is patted or hugged, degrees (outward). */
const EARS_BACK = 10
/** How high a paw lifts for a high five, drawing units. */
const PAW_LIFT = 12
/** How far the tail flicks away when it is touched, degrees. */
const TAIL_FLICK = 14

/** How long a reply plays before a mouth with no sound to follow starts to chatter, ms. */
const CHATTER_AFTER_MS = 300
/** Syllables in one round of chatter (it repeats). */
const CHATTER_SYLLABLES = 9

const between = (low: number, high: number) => low + Math.random() * (high - low)

/**
 * A round of talking without the sound to follow: syllables of uneven size and length, a short
 * pause between words, as a voice moves a mouth.
 */
function chatter() {
	const syllables = Array.from({ length: CHATTER_SYLLABLES }, (_, i) => [
		withTiming(between(0.35, 0.9), { duration: between(70, 120) }),
		withTiming(between(0, 0.15), { duration: between(60, 110) }),
		...(i % 3 === 2 ? [withTiming(0, { duration: between(120, 220) })] : [])
	])
	return withSequence(...syllables.flat())
}
const pick = <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]!

export function usePetBehaviour(
	pose: PetPose,
	{
		appearance,
		mood,
		wants,
		line,
		cue,
		active,
		listening,
		speaking,
		breathDelay = 0,
		onYawn
	}: {
		/** What it moves the way it is built: its species, tail and ears. */
		appearance: Pick<PetAppearance, 'species' | 'tail' | 'ears'>
		mood: Mood
		/** The care action it wants most, if any: an idle glance goes to that button. */
		wants: PetAction | null
		/** What the bubble says; a new line draws a glance at it. */
		line: string
		/** Look somewhere for a moment (the sky, you). */
		cue: PetCue | null
		/** The screen is the one shown. With the app in the foreground, the pet moves. */
		active: boolean
		/** The mic is held: it tilts its head and pricks up its ears to listen. */
		listening: boolean
		/** It is saying its reply out loud: its head nods. */
		speaking: boolean
		/** Its breathing starts this late, ms: pets that stand together never breathe as one. */
		breathDelay?: number
		/** It yawned: the screen can float a few z's. */
		onYawn?: () => void
	}
) {
	const reduceMotion = useReducedMotion()
	// It is seen while its screen is shown and the app is in the foreground; it moves only then.
	const seenNow = useAppActive() && active
	const moving = seenNow && !reduceMotion
	const { breath, amp, slump, hop, squashX, squashY, lean, open, lookX, lookY } = pose
	const { tail, earLeft, earRight, headTilt, headNod, jaw, purr, pawLeft, pawRight, blush } = pose
	const { species, tail: tailKind, ears } = appearance

	// While a move, a stroke or a held look is under way, the idle timers wait.
	const busyUntil = useRef(0)
	const isBusy = () => Date.now() < busyUntil.current
	/** Holds the idle moves off for `ms` more. */
	const busyFor = useCallback((ms: number) => {
		busyUntil.current = Math.max(busyUntil.current, Date.now() + ms)
	}, [])
	/** Lets the idle moves start again after `ms` (whatever held them before). */
	const freeAfter = useCallback((ms: number) => {
		busyUntil.current = Date.now() + ms
	}, [])

	// The latest props for the timers, which are set up once per stretch of being seen.
	const latest = useLatest({ mood, wants, onYawn, ears, listening, appearance })

	/** The ears now: their mood's, and where they sit at rest (pricked up while listening). */
	const earsNow = useCallback((): EarMotion & { at: number } => {
		const now = latest.current
		const motion = earMotion({ ears: now.ears }, now.mood)
		return { ...motion, at: now.listening ? motion.perk : motion.rest }
	}, [latest])

	// ─── Breathing, by mood ───────────────────────────────────────────────────

	useEffect(() => {
		const b = BREATH[mood]
		amp.value = withTiming(b.amp, { duration: 800 })
		slump.value = withTiming(b.slump, { duration: 800 })
		if (reduceMotion) {
			breath.value = 0
			return
		}
		if (!moving) {
			// Unseen: stop where it is; it settles from there when it is seen again.
			cancelAnimation(breath)
			return
		}
		const ease = { duration: b.halfMs, easing: Easings.inOut }
		// A repeat restarts each cycle from the value it began at, so begin at rest: a new mood
		// arriving mid-breath first settles to 0, or every breath would snap back up to there.
		const settle = { duration: breath.value * b.halfMs, easing: Easings.inOut }
		const breathing = withRepeat(withSequence(withTiming(1, ease), withTiming(0, ease)), -1, false)
		breath.value = withSequence(
			withTiming(0, settle),
			breathDelay > 0 ? withDelay(breathDelay, breathing) : breathing
		)
	}, [mood, moving, reduceMotion, breathDelay, amp, slump, breath])

	// ─── The tail, by species and mood ────────────────────────────────────────

	/** The tail's calm motion in this mood, from wherever it is: a slow sway, or still. */
	const calmTail = useCallback((t: TailMotion) => {
		const { rest, calm } = t
		const toRest = { duration: 500, easing: Easings.inOut }
		if (calm.swing === 0) return withTiming(rest, toRest)
		const ease = { duration: calm.halfMs, easing: Easings.inOut }
		return withSequence(
			withTiming(rest - calm.swing, toRest),
			withRepeat(
				withSequence(withTiming(rest + calm.swing, ease), withTiming(rest - calm.swing, ease)),
				-1,
				false
			)
		)
	}, [])

	/** A burst: a few quick swings (a wag, a quiver), then calm again. Nothing in a mood without. */
	const wag = useCallback(() => {
		const t = tailMotion(latest.current.appearance, latest.current.mood)
		if (!t.burst || reduceMotion) return
		const { swing, halfMs, count } = t.burst
		const quick = { duration: halfMs, easing: Easings.inOut }
		const swings = Math.round(between(...count))
		tail.value = withSequence(
			withTiming(t.rest - swing, quick),
			...Array.from({ length: swings }, () => [
				withTiming(t.rest + swing, quick),
				withTiming(t.rest - swing, quick)
			]).flat(),
			calmTail(t)
		)
	}, [latest, reduceMotion, tail, calmTail])

	useEffect(() => {
		const t = tailMotion({ species, tail: tailKind }, mood)
		if (reduceMotion) {
			// Still, but in its mood's posture: held up, or hanging.
			tail.value = t.rest
			return
		}
		if (!moving) {
			cancelAnimation(tail)
			return
		}
		tail.value = calmTail(t)
		const burst = t.burst
		if (!burst) return
		let timer: ReturnType<typeof setTimeout>
		const next = () => {
			timer = setTimeout(
				() => {
					wag()
					next()
				},
				between(...burst.every)
			)
		}
		next()
		return () => clearTimeout(timer)
	}, [species, tailKind, mood, moving, reduceMotion, tail, calmTail, wag])

	// ─── Ears and head: posture by mood, listening ───────────────────────────

	useEffect(() => {
		const { at } = earsNow()
		// Timings.slow carries Reduce Motion: there, the ears simply sit where the mood puts them.
		earLeft.value = withTiming(at, Timings.slow)
		earRight.value = withTiming(at, Timings.slow)
	}, [mood, listening, ears, earsNow, earLeft, earRight])

	useEffect(() => {
		headTilt.value = withSpring(listening && !reduceMotion ? LISTEN_TILT : 0, Springs.gentle)
	}, [listening, reduceMotion, headTilt])

	useEffect(() => {
		if (!speaking || !moving) {
			headNod.value = withTiming(0, { duration: NOD.halfMs })
			return
		}
		const half = { duration: NOD.halfMs, easing: Easings.inOut }
		headNod.value = withRepeat(
			withSequence(withTiming(NOD.depth, half), withTiming(0, half)),
			-1,
			false
		)
	}, [speaking, moving, headNod])

	// ─── The mouth: the voice, a meow, or a chatter ──────────────────────────
	// It moves while the pet is seen, even under Reduce Motion (decision 3): it says who talks.

	// While it chatters (a voice that sends no sound to follow), the chatter has the mouth.
	const chattering = useSharedValue(false)
	useAnimatedReaction(
		() => soundMouth.value,
		(open) => {
			if (!chattering.value) jaw.value = withTiming(open, { duration: 60 })
		}
	)

	useEffect(() => {
		if (!speaking || !seenNow) return
		// The voice's sound should be moving the mouth by now; if not, it chatters until it stops.
		const timer = setTimeout(() => {
			if (voiceSampled()) return
			chattering.value = true
			jaw.value = withRepeat(chatter(), -1, false)
		}, CHATTER_AFTER_MS)
		return () => {
			clearTimeout(timer)
			if (!chattering.value) return
			chattering.value = false
			jaw.value = withTiming(0, { duration: 120 })
		}
	}, [speaking, seenNow, chattering, jaw])

	/** The ears prick up for a moment (a tap, a hello), then settle. */
	const perk = useCallback(() => {
		if (reduceMotion) return
		const { perk: up, at } = earsNow()
		const prick = withSequence(
			withTiming(up, { duration: 120, easing: Easings.out }),
			withDelay(700, withTiming(at, { duration: 400, easing: Easings.inOut }))
		)
		earLeft.value = prick
		earRight.value = prick
	}, [reduceMotion, earsNow, earLeft, earRight])

	// ─── Eyes ─────────────────────────────────────────────────────────────────

	const blink = useCallback(
		(double: boolean) => {
			const shut = withTiming(0, { duration: 70 })
			const reopen = withTiming(1, { duration: 120 })
			open.value = double
				? withSequence(
						shut,
						reopen,
						withTiming(0, { duration: 70 }),
						withTiming(1, { duration: 120 })
					)
				: withSequence(shut, reopen)
		},
		[open]
	)

	const lookTo = useCallback(
		(x: number, y: number, holdMs: number) => {
			const move = { duration: 280, easing: Easings.out }
			const back = { duration: 420, easing: Easings.inOut }
			lookX.value = withSequence(withTiming(x, move), withDelay(holdMs, withTiming(0, back)))
			lookY.value = withSequence(withTiming(y, move), withDelay(holdMs, withTiming(0, back)))
		},
		[lookX, lookY]
	)

	// ─── Moves ────────────────────────────────────────────────────────────────

	const doHop = useCallback(
		(times: number) => {
			const once = [
				withTiming(-2, { duration: 110, easing: Easings.out }),
				withTiming(HOP, { duration: 190, easing: Easings.out }),
				withTiming(0, { duration: 210, easing: Easings.in })
			]
			hop.value = times === 2 ? withSequence(...once, ...once) : withSequence(...once)
			const landing = withSequence(
				withTiming(0.93, { duration: 90 }),
				withSpring(1, Springs.settle)
			)
			const crouch = withTiming(0.95, { duration: 110 })
			const air = withTiming(1.03, { duration: 190 })
			const fall = withTiming(1, { duration: 210 })
			const one = [crouch, air, fall, landing]
			squashY.value = times === 2 ? withSequence(...one, ...one) : withSequence(...one)
			// The ears are thrown out as it rises, flop in as it lands, and settle.
			const { hopSwing, at } = earsNow()
			const flap = [
				withTiming(at, { duration: 110 }),
				withTiming(at + hopSwing, { duration: 190, easing: Easings.out }),
				withTiming(at - hopSwing * 0.4, { duration: 210, easing: Easings.in })
			]
			const flaps = withSequence(
				...(times === 2 ? [...flap, ...flap] : flap),
				withSpring(at, Springs.settle)
			)
			earLeft.value = flaps
			earRight.value = flaps
		},
		[hop, squashY, earsNow, earLeft, earRight]
	)

	const runIdle = useCallback(
		(move: IdleMove) => {
			switch (move) {
				case 'hop':
				case 'doubleHop':
					doHop(move === 'hop' ? 1 : 2)
					busyFor(move === 'hop' ? 900 : 1600)
					return
				case 'sway':
					lean.value = withSequence(
						withTiming(4, { duration: 500, easing: Easings.inOut }),
						withTiming(-4, { duration: 900, easing: Easings.inOut }),
						withTiming(3, { duration: 800, easing: Easings.inOut }),
						withTiming(0, { duration: 600, easing: Easings.inOut })
					)
					busyFor(2900)
					return
				case 'stretch':
					squashY.value = withSequence(
						withTiming(1.07, { duration: 550, easing: Easings.inOut }),
						withDelay(450, withSpring(1, Springs.settle))
					)
					squashX.value = withSequence(
						withTiming(0.95, { duration: 550, easing: Easings.inOut }),
						withDelay(450, withSpring(1, Springs.settle))
					)
					open.value = withSequence(
						withTiming(0.12, { duration: 450 }),
						withDelay(550, withTiming(1, { duration: 300 }))
					)
					busyFor(1700)
					return
				case 'lookAround':
					lookX.value = withSequence(
						withTiming(-0.9, { duration: 350, easing: Easings.inOut }),
						withDelay(700, withTiming(0.9, { duration: 600, easing: Easings.inOut })),
						withDelay(700, withTiming(0, { duration: 400, easing: Easings.inOut }))
					)
					lookY.value = withSequence(
						withTiming(-0.3, { duration: 350 }),
						withDelay(1700, withTiming(0, { duration: 400 }))
					)
					busyFor(2800)
					return
				case 'yawn':
					open.value = withSequence(
						withTiming(0.08, { duration: 450 }),
						withDelay(1000, withTiming(1, { duration: 550 }))
					)
					squashY.value = withSequence(
						withTiming(1.05, { duration: 500, easing: Easings.inOut }),
						withDelay(700, withTiming(1, { duration: 600, easing: Easings.inOut }))
					)
					latest.current.onYawn?.()
					busyFor(2200)
					return
				case 'sigh':
					lookY.value = withSequence(
						withTiming(0.8, { duration: 600, easing: Easings.inOut }),
						withDelay(900, withTiming(0, { duration: 700 }))
					)
					hop.value = withSequence(
						withTiming(-3, { duration: 600, easing: Easings.inOut }),
						withDelay(900, withTiming(0, { duration: 700, easing: Easings.inOut }))
					)
					busyFor(2400)
					return
				case 'wanted': {
					const want = latest.current.wants
					if (want) lookTo(BUTTON_LOOK[want], 1, 1500)
					busyFor(2200)
					return
				}
			}
		},
		[doHop, lookTo, busyFor, latest, lean, squashX, squashY, open, lookX, lookY, hop]
	)

	// ─── The idle timers ──────────────────────────────────────────────────────

	useEffect(() => {
		if (!moving) return
		const timers: ReturnType<typeof setTimeout>[] = []
		const every = (range: [number, number], run: () => void) => {
			const next = () => {
				timers.push(
					setTimeout(
						() => {
							run()
							next()
						},
						between(...range)
					)
				)
			}
			next()
		}
		every(BLINK_EVERY, () => {
			if (!isBusy()) blink(Math.random() < DOUBLE_BLINK)
		})
		every(GLANCE_EVERY, () => {
			if (isBusy()) return
			const hold = between(700, 1800)
			lookTo(between(-0.8, 0.8), between(-0.6, 0.4), hold)
			busyFor(hold + 700)
		})
		every(EAR_TWITCH_EVERY, () => {
			if (isBusy()) return
			// One ear flicks out and back; now and then twice.
			const { twitch, at } = earsNow()
			const flick = [
				withTiming(at + twitch, { duration: 70, easing: Easings.out }),
				withTiming(at, { duration: 140, easing: Easings.inOut })
			]
			const ear = Math.random() < 0.5 ? earLeft : earRight
			ear.value = Math.random() < 0.25 ? withSequence(...flick, ...flick) : withSequence(...flick)
		})
		every(IDLE_EVERY, () => {
			if (isBusy()) return
			const { mood: now, wants: want } = latest.current
			runIdle(want && Math.random() < 0.4 ? 'wanted' : pick(IDLE_MOVES[now]))
		})
		return () => timers.forEach(clearTimeout)
	}, [moving, blink, lookTo, runIdle, busyFor, latest, earsNow, earLeft, earRight])

	// A new line in the bubble, or a cue from the screen, is followed; whether the pet is seen
	// is read, not followed: coming back to Home is not a new line.
	const seen = useLatest(moving)

	// A new line in the bubble: a glance up at it.
	const firstLine = useRef(true)
	useEffect(() => {
		if (firstLine.current) {
			firstLine.current = false
			return
		}
		if (!seen.current) return
		lookTo(0.85, -0.75, 1300)
		busyFor(2000)
	}, [line, seen, lookTo, busyFor])

	// A cue from the screen: look there, and hop if asked. A new key is a new cue; the rest of
	// it is read, not followed.
	const latestCue = useLatest(cue)
	const cueKey = cue?.key
	useEffect(() => {
		const current = latestCue.current
		if (!current || !seen.current) return
		lookTo(current.lookX, current.lookY, 1600)
		if (current.hop) doHop(1)
		busyFor(2400)
	}, [cueKey, latestCue, seen, lookTo, doHop, busyFor])

	// ─── Touch: where it is touched, it answers its own way (R7) ──────────────

	/** The purr: a fast little shiver, felt as a run of ticks. */
	const purrNow = useCallback(() => {
		purr.value = withSequence(
			...Array.from({ length: 8 }, (_, i) =>
				withTiming(i % 2 === 0 ? 1.4 : -1.4, { duration: 60 })
			),
			withTiming(0, { duration: 60 })
		)
		for (let i = 0; i < 5; i++) setTimeout(() => haptic.select(), i * 90)
	}, [purr])

	/** The cheeks deepen for a moment (a pat, a scratch, a stroke), then fade to the mood's. */
	const blushNow = useCallback(() => {
		blush.value = withSequence(
			withTiming(1, { duration: 300 }),
			withDelay(BLUSH_HOLD, withTiming(0, { duration: 1200 }))
		)
	}, [blush])

	/** A happy wriggle: side to side, a squish, and the tail. */
	const wriggle = useCallback(() => {
		const step = { duration: 90, easing: Easings.inOut }
		lean.value = withSequence(
			withTiming(3.5, step),
			withTiming(-3.5, step),
			withTiming(3, step),
			withTiming(-2, step),
			withSpring(0, Springs.settle)
		)
		squashX.value = withSequence(withTiming(1.05, { duration: 180 }), withSpring(1, Springs.settle))
		wag()
	}, [lean, squashX, wag])

	/** The ears held back for a moment (a pat on the head, a hug), then settled. */
	const earsBack = useCallback(
		(ms: number) => {
			const { at } = earsNow()
			const back = withSequence(
				withTiming(at + EARS_BACK, { duration: 200, easing: Easings.out }),
				withDelay(ms, withTiming(at, { duration: 400, easing: Easings.inOut }))
			)
			earLeft.value = back
			earRight.value = back
		},
		[earsNow, earLeft, earRight]
	)

	/**
	 * A tap on `zone`; `x` is where, in pet space (left of the middle is the pet's left ear or
	 * paw). Its face, line and hearts are the screen's; this is how its body answers.
	 */
	const react = useCallback(
		(zone: Zone, x: number) => {
			// Its face answers under Reduce Motion too (R9): a pat or a chin scratch makes it blush.
			if (zone === 'head' || zone === 'chin') blushNow()
			if (reduceMotion) return
			busyFor(1400)
			const left = x < 0
			switch (zone) {
				case 'head':
					// It leans into the hand, ears back, eyes shut happily (the screen's beaming face).
					earsBack(800)
					lean.value = withSequence(
						withTiming(left ? -3 : 3, { duration: 220, easing: Easings.out }),
						withDelay(600, withSpring(0, Springs.settle))
					)
					wag()
					return
				case 'chin':
					// Its head tips up, its eyes half close, and it purrs.
					headNod.value = withSequence(
						withTiming(-2.2, { duration: 260, easing: Easings.out }),
						withDelay(700, withSpring(0, Springs.settle))
					)
					open.value = withSequence(
						withTiming(0.35, { duration: 200 }),
						withDelay(800, withTiming(1, { duration: 300 }))
					)
					purrNow()
					return
				case 'nose': {
					// A blink, then a little sneeze: the head jerks down, the body squishes.
					blink(false)
					const sneeze = { duration: 90, easing: Easings.out }
					headNod.value = withDelay(
						320,
						withSequence(withTiming(2.6, sneeze), withSpring(0, Springs.settle))
					)
					squashY.value = withDelay(
						320,
						withSequence(withTiming(0.94, sneeze), withSpring(1, Springs.settle))
					)
					perk()
					return
				}
				case 'ear': {
					// That ear flicks, twice.
					const { twitch, at } = earsNow()
					const flick = [
						withTiming(at + twitch, { duration: 70, easing: Easings.out }),
						withTiming(at, { duration: 120, easing: Easings.inOut })
					]
					;(left ? earLeft : earRight).value = withSequence(...flick, ...flick)
					return
				}
				case 'belly':
					wriggle()
					return
				case 'paw': {
					// A high five: the paw nearest the finger lifts, holds, and comes down.
					const paw = left ? pawLeft : pawRight
					paw.value = withSequence(
						withTiming(PAW_LIFT, { duration: 160, easing: Easings.out }),
						withDelay(450, withSpring(0, Springs.settle))
					)
					perk()
					return
				}
				case 'tail': {
					// The tail flicks away, and it looks back at it.
					const t = tailMotion(latest.current.appearance, latest.current.mood)
					tail.value = withSequence(
						withTiming(t.rest - TAIL_FLICK, { duration: 90, easing: Easings.out }),
						withTiming(t.rest + TAIL_FLICK * 0.4, { duration: 160, easing: Easings.inOut }),
						calmTail(t)
					)
					lookTo(0.9, 0.6, 800)
					return
				}
				case 'back':
					perk()
					wag()
					return
			}
		},
		[
			reduceMotion,
			blushNow,
			busyFor,
			earsBack,
			lean,
			wag,
			headNod,
			open,
			purrNow,
			blink,
			squashY,
			perk,
			earsNow,
			earLeft,
			earRight,
			wriggle,
			pawLeft,
			pawRight,
			latest,
			tail,
			calmTail,
			lookTo
		]
	)

	/** A stroke long enough to count, begun on `zone`: a purr, a wriggle, an arch. */
	const stroked = useCallback(
		(zone: Zone) => {
			blushNow()
			if (zone === 'belly') {
				if (!reduceMotion) wriggle()
				return
			}
			purrNow()
			if (reduceMotion) return
			if (zone === 'chin') {
				open.value = withSequence(
					withTiming(0.35, { duration: 200 }),
					withDelay(900, withTiming(1, { duration: 300 }))
				)
			}
			if (zone === 'back') {
				// It arches into the stroke.
				squashY.value = withSequence(
					withTiming(1.05, { duration: 250, easing: Easings.out }),
					withSpring(1, Springs.settle)
				)
			}
		},
		[reduceMotion, blushNow, wriggle, purrNow, open, squashY]
	)

	/** A hug begins (`holding`) or ends: it squeezes into it, eyes shut, ears back. */
	const hug = useCallback(
		(holding: boolean) => {
			if (holding) {
				busyFor(60_000)
				haptic.snap()
				squashX.value = withSpring(1.07, Springs.settle)
				squashY.value = withSpring(0.94, Springs.settle)
				open.value = withTiming(0.08, { duration: 200 })
				blush.value = withTiming(1, { duration: 300 })
				const { at } = earsNow()
				earLeft.value = withTiming(at + EARS_BACK, { duration: 250 })
				earRight.value = withTiming(at + EARS_BACK, { duration: 250 })
				return
			}
			freeAfter(600)
			squashX.value = withSpring(1, Springs.settle)
			squashY.value = withSpring(1, Springs.settle)
			open.value = withTiming(1, { duration: 250 })
			blush.value = withDelay(BLUSH_HOLD, withTiming(0, { duration: 1200 }))
			const { at } = earsNow()
			earLeft.value = withTiming(at, { duration: 400 })
			earRight.value = withTiming(at, { duration: 400 })
			wag()
		},
		[busyFor, freeAfter, squashX, squashY, open, blush, earsNow, earLeft, earRight, wag]
	)

	return { blink, perk, wag, react, stroked, hug, busyFor, freeAfter }
}
