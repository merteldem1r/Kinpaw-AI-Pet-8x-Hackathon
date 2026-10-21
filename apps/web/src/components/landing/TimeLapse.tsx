'use client'

import { useEffect, useRef, useState } from 'react'
import {
	motion,
	useMotionValueEvent,
	useReducedMotion,
	useScroll,
	useTransform,
	type MotionValue
} from 'motion/react'
import { art, type Scheme } from '@app/brand'
import {
	DEFAULT_LOOK,
	NIGHT_ENDS,
	NIGHT_STARTS,
	decayNeeds,
	lookById,
	moodFor,
	wholeNeeds,
	type Needs
} from '@app/contract'
import { headerLine } from '@/lib/pet-lines'
import { phaseAt, schemeForPhase, type SkyPhase } from '@/lib/sky'
import type { CssVars } from '@/lib/utils'
import { LivePet } from '../pet/LivePet'
import { DayPass } from './DayPass'
import { Cloud, FAINT_STARS, STARS } from './Scene'
import { SkyLife } from './SkyLife'
import { NeedMeter, Stand } from './stage'

const MOCHI = lookById(DEFAULT_LOOK.cat)
/** The week's pet, as the rest of the page names it. */
const NAME = 'Mochi'

/**
 * Where Mochi's needs stood at midnight, after day 3's evening together: fed,
 * played with and petted, and tired. From here they move by the app's own
 * rules (`decayNeeds`): energy comes back overnight, the rest drift down
 * slowly while it sleeps and faster by day.
 */
const MIDNIGHT_NEEDS: Needs = { hunger: 78, happiness: 88, energy: 34, affection: 92 }
/** The day the lapse runs through, as a clock: midnight in UTC, decayed in UTC. */
const MIDNIGHT = Date.UTC(2026, 9, 4)
const HOUR_MS = 60 * 60 * 1000

/**
 * The day's skies, one over the next: each fades in over the hours of `in`
 * (from midnight to midnight). The first is the night the day starts in and is
 * always there. The app's four skies (src/lib/sky.ts), at the app's hours.
 */
const SKIES: readonly { phase: SkyPhase; in: readonly [number, number] }[] = [
	{ phase: 'morning', in: [4.5, 7] },
	{ phase: 'afternoon', in: [10.5, 13] },
	{ phase: 'evening', in: [16, 18.5] },
	{ phase: 'night', in: [20, 22.5] }
]
/**
 * The starting night opens on the ground the scene above ended on; over the
 * first hour a night of its own covers that band, so it does not stay at the
 * top of the screen all night.
 */
const OPENING_COVER: readonly [number, number] = [0.2, 1.2]

/** The sun is up from 6 to 20 and the moon from 20 to 6; each fades over this many hours at its ends. */
const SUNRISE = 6
const SUNSET = 20
const BODY_FADE = 0.8
/**
 * The arc, in % of the screen: from the left edge's low point to its top in
 * the middle, flattened at the top so it stays above the line. A phone's line
 * is the full width, so there the arc runs lower, between the line and the pet.
 */
const ARC = { left: 8, width: 84, low: 58, high: 8 }
const ARC_NARROW = { left: 10, width: 80, low: 60, high: 44 }
const ARC_FLATTEN = 0.6
const NARROW = '(max-width: 639px)'

/** The clock moves in ten-minute steps, so it ticks like a clock rather than a counter. */
const CLOCK_STEP_MINUTES = 10

/**
 * Day 4: a whole day passes while you scroll. The screen holds still (sticky)
 * and the hour runs from midnight to midnight with the scroll:
 *
 * - the sky: the app's skies one over the next, the sun and then the moon
 *   crossing, the stars out at night, clouds blowing past by day, and the
 *   app's life in the sky at its hours (motes, birds, fireflies);
 * - Mochi, large, on its cushion: asleep in the app's night (23:00–07:00),
 *   its needs moving by the app's real rules at its sides, and the app's own
 *   header for them under the day's line; a ball it has rolled about by day,
 *   a sunbeam in the afternoon, the lamp once it is dark;
 * - the clock, running.
 *
 * It ends on the night's ground, where day 5 opens. The scroll drives it all
 * through motion values; React renders only when the clock's ten minutes move
 * the needs, the mood or the scheme. Under Reduce Motion it is the still line
 * it was (DayPass).
 */
export function TimeLapse({
	day,
	line,
	prev,
	scrollScreens
}: {
	day: number
	line: string
	/** The scheme of the scene above, whose ground the day opens on. */
	prev: Scheme
	/** How many screens of scrolling the day takes, besides the one it is seen on. */
	scrollScreens: number
}) {
	const isStill = useReducedMotion()
	const root = useRef<HTMLElement>(null)
	const clock = useRef<HTMLSpanElement>(null)
	const { scrollYProgress } = useScroll({ target: root, offset: ['start start', 'end end'] })
	const hour = useTransform(scrollYProgress, [0, 1], [0, 24])
	const [step, setStep] = useState(0)

	useMotionValueEvent(hour, 'change', (h) => {
		setStep(clockStep(h))
		if (clock.current) clock.current.textContent = clockTime(h)
	})

	const at = (step * CLOCK_STEP_MINUTES) / 60
	const whole = Math.min(Math.floor(at), 23)
	const isAsleep = whole >= NIGHT_STARTS || whole < NIGHT_ENDS
	const needs = decayNeeds(
		MIDNIGHT_NEEDS,
		new Date(MIDNIGHT),
		new Date(MIDNIGHT + at * HOUR_MS),
		'UTC'
	)
	const shown = wholeNeeds(needs)
	const mood = isAsleep ? 'sleepy' : moodFor(needs)
	const caption = isAsleep ? `${NAME} is asleep` : headerLine(needs, NAME)

	const stars = useTransform(hour, [0, 4.5, 6.5, 19, 21.5, 24], [1, 1, 0, 0, 1, 1])
	const clouds = useTransform(hour, [5, 8, 17, 19.5], [0, 1, 1, 0])
	const cloudsX = useTransform(hour, [5, 19.5], ['18vw', '-24vw'])
	const motes = useTransform(hour, [5, 6.5, 10, 11.5], [0, 1, 1, 0])
	const birds = useTransform(hour, [9, 10, 16, 17], [0, 1, 1, 0])
	const fireflies = useTransform(hour, [17.5, 19, 22, 23.5], [0, 1, 1, 0])
	const sunbeam = useTransform(hour, [11.5, 13.5, 16, 17.5], [0, 1, 1, 0])
	// The ball: out by day, rolled a little further each hour, turning as it goes.
	const ballX = useTransform(hour, [8, 18], ['0rem', '-3.5rem'])
	const ballTurn = useTransform(hour, [8, 18], [0, -340])
	const ball = useTransform(hour, [7.5, 8.5, 19, 20], [0, 1, 1, 0])

	if (isStill) return <DayPass day={day} prev={prev} line={line} />

	return (
		<section
			ref={root}
			data-day={day}
			className="time-lapse relative"
			style={{ '--lapse-screens': scrollScreens + 1 } as CssVars}
		>
			<div className="time-lapse-screen sticky top-0 isolate overflow-hidden bg-bg">
				<div aria-hidden="true" className="absolute inset-0 -z-20">
					<span data-sky="night" data-prev={prev} className="sky-fill" />
					<SkyLayer hour={hour} phase="night" fadeIn={OPENING_COVER} />
					{SKIES.map((sky) => (
						<SkyLayer key={sky.in[0]} hour={hour} phase={sky.phase} fadeIn={sky.in} />
					))}
					<motion.span className="absolute inset-0" style={{ opacity: stars }}>
						{[...STARS, ...FAINT_STARS].map((star, i) => (
							<span
								key={i}
								className={
									i < STARS.length
										? 'sky-star sky-twinkle absolute rounded-full'
										: 'sky-star sky-star-faint sky-twinkle absolute rounded-full'
								}
								style={
									{
										left: `${star.x}%`,
										top: `${star.y}%`,
										width: star.r * 2,
										height: star.r * 2,
										'--i': i
									} as CssVars
								}
							/>
						))}
					</motion.span>
					<motion.span
						className="absolute inset-0 max-sm:hidden"
						style={{ opacity: clouds, x: cloudsX }}
					>
						<Cloud x={62} y={14} w={160} />
						<Cloud x={14} y={34} w={120} />
					</motion.span>
					<motion.span className="absolute inset-0" style={{ opacity: motes }}>
						<SkyLife kind="mote" className="lapse-life" />
					</motion.span>
					<motion.span className="absolute inset-0" style={{ opacity: birds }}>
						<SkyLife kind="bird" className="lapse-life" />
					</motion.span>
					<motion.span className="absolute inset-0" style={{ opacity: fireflies }}>
						<SkyLife kind="firefly" className="lapse-life" />
					</motion.span>
					<SkyBody hour={hour} kind="sun" />
					<SkyBody hour={hour} kind="moon" />
					<span style={{ '--beam': art.sky.afternoon.body } as CssVars}>
						<motion.span className="lapse-sunbeam" style={{ opacity: sunbeam }} />
					</span>
				</div>
				<span aria-hidden="true" className="grain -z-10" />

				<div
					data-scheme={schemeForPhase(phaseAt(whole))}
					className="flex h-full flex-col items-center px-5 pb-[10svh] pt-[22svh] text-center text-ink transition-colors duration-slow"
				>
					<p aria-hidden="true" className="t-number text-sm font-medium tracking-wide opacity-75">
						Day {day} · <span ref={clock}>{clockTime(0)}</span>
					</p>
					<p className="t-h2 mx-auto mt-3 max-w-[24ch] text-balance">{line}</p>
					{/* The app's own header for how Mochi is, as its Home shows it. */}
					<p
						key={caption}
						aria-hidden="true"
						className="bubble-in mt-3 font-display text-lg italic text-ink-secondary"
					>
						{caption}
					</p>

					<div className="mt-auto grid w-full max-w-[760px] grid-cols-[1fr_auto_1fr] items-center gap-x-2 sm:gap-x-6">
						<div className="flex flex-col items-end gap-2.5">
							<NeedMeter need="hunger" value={shown.hunger} />
							<NeedMeter need="energy" value={shown.energy} />
						</div>
						<Stand hasLamp className="relative">
							<span
								aria-hidden="true"
								className="lapse-cushion"
								style={{ '--cushion': art.care.pet } as CssVars}
							/>
							<motion.span
								aria-hidden="true"
								className="lapse-ball"
								style={{ x: ballX, rotate: ballTurn, opacity: ball }}
							>
								<svg viewBox="0 0 20 20" className="h-full w-full">
									<circle cx="10" cy="10" r="9" fill={art.care.play} />
									<path
										d="M1.5 8.5 Q10 13 18.5 8.5"
										fill="none"
										stroke={art.mark.ground}
										strokeOpacity={0.35}
										strokeWidth={1.6}
									/>
								</svg>
							</motion.span>
							<LivePet
								appearance={MOCHI.appearance}
								mood={mood}
								label={`${NAME}, ${isAsleep ? 'asleep' : `looking ${mood}`}`}
								sizeClassName="lapse-pet"
							/>
						</Stand>
						<div className="flex flex-col items-start gap-2.5">
							<NeedMeter need="happiness" value={shown.happiness} />
							<NeedMeter need="affection" value={shown.affection} />
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

/** One of the day's skies over the ones before it, fading in over its hours. */
function SkyLayer({
	hour,
	phase,
	fadeIn
}: {
	hour: MotionValue<number>
	phase: SkyPhase
	fadeIn: readonly [number, number]
}) {
	const opacity = useTransform(hour, [...fadeIn], [0, 1])
	return (
		<motion.span
			data-sky={phase}
			data-scheme={schemeForPhase(phase)}
			className="sky-fill"
			style={{ opacity }}
		/>
	)
}

/**
 * The sun by day, the moon by night, each along the same arc from left to
 * right: low at the edges, high in the middle. The sun takes the colour of the
 * hour's own sun; the moon is the night's crescent.
 */
function SkyBody({ hour, kind }: { hour: MotionValue<number>; kind: 'sun' | 'moon' }) {
	// How far along its arc the body is, 0 to 1: the sun from 6 to 20, the moon from 20 to 6.
	const along = useTransform(hour, (h) =>
		kind === 'sun'
			? (h - SUNRISE) / (SUNSET - SUNRISE)
			: ((h + 24 - SUNSET) % 24) / (24 - SUNSET + SUNRISE)
	)
	// Read at each frame, so a rotated phone or a resized window takes the other arc.
	const arc = useRef(ARC)
	useEffect(() => {
		const query = window.matchMedia(NARROW)
		const update = () => {
			arc.current = query.matches ? ARC_NARROW : ARC
		}
		update()
		query.addEventListener('change', update)
		return () => query.removeEventListener('change', update)
	}, [])
	const x = useTransform(along, (t) => `${arc.current.left + t * arc.current.width}vw`)
	const y = useTransform(along, (t) => {
		const { low, high } = arc.current
		const lift = Math.sin(Math.PI * Math.min(Math.max(t, 0), 1)) ** ARC_FLATTEN
		return `${low - lift * (low - high)}svh`
	})
	const opacity = useTransform(hour, (h) => {
		const isUp = kind === 'sun' ? h > SUNRISE && h < SUNSET : h < SUNRISE || h > SUNSET
		if (!isUp) return 0
		const fromEdge =
			kind === 'sun'
				? Math.min(h - SUNRISE, SUNSET - h)
				: Math.min(Math.abs(h - SUNSET), Math.abs(SUNRISE - h))
		return Math.min(1, fromEdge / BODY_FADE)
	})
	const sunColour = useTransform(
		hour,
		[SUNRISE, 12, SUNSET - 1],
		[art.sky.morning.body, art.sky.afternoon.body, art.sky.evening.body]
	)
	return (
		<motion.span className="absolute left-0 top-0" style={{ x, y, opacity }}>
			<motion.span
				className={kind === 'sun' ? 'lapse-body' : 'lapse-body lapse-moon'}
				style={{ backgroundColor: kind === 'sun' ? sunColour : art.sky.night.body }}
			/>
		</motion.span>
	)
}

/** Which ten minutes of the day the hour is in. */
function clockStep(hour: number): number {
	return Math.min(Math.floor((hour * 60) / CLOCK_STEP_MINUTES), (24 * 60) / CLOCK_STEP_MINUTES)
}

/** The hour as a phone's lock screen shows it: 12-hour, with am or pm. */
function clockTime(hour: number): string {
	const minutes = clockStep(hour) * CLOCK_STEP_MINUTES
	const h = Math.floor(minutes / 60) % 24
	const m = minutes % 60
	return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}
