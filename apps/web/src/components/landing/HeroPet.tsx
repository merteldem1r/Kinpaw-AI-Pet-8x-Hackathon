'use client'

import { useEffect, useRef, useState } from 'react'
import {
	ACTIONS,
	DEFAULT_LOOK,
	applyAction,
	lookById,
	moodFor,
	wantedAction,
	wholeNeeds,
	type Need,
	type Needs,
	type PetAction
} from '@app/contract'
import { gaEvent } from '@/lib/analytics/client'
import { WEEK_EVENTS } from '@/lib/analytics/events'
import { CANT_HELP, MISSED_YOU_LINE, needsLine, reactionLine } from '@/lib/pet-lines'
import { LivePet } from '../pet/LivePet'
import { Bubble, Burst, CareButton, NeedMeter, Stand } from './stage'

const MOCHI = lookById(DEFAULT_LOOK.cat)

/** Day 1 opens on a pet that missed you: affection low, the rest middling. */
const STARTING_NEEDS: Needs = { hunger: 38, happiness: 58, energy: 72, affection: 24 }

/** What the wanted button's badge says, as the app's care tiles. */
const WANTED_BADGE: Record<PetAction, string> = {
	feed: 'Hungry',
	play: 'Bored',
	pet: 'Missed you'
}

/** Left alone this long after its last line, the pet goes back to saying what it needs, ms. */
const IDLE_AFTER = 9000
/** If nothing has been tapped by then, the button it wants wiggles once, ms. */
const NUDGE_AT = 6500
/** When each meter starts to fill, ms after the page opens: after Mochi has landed. */
const FILL_AT: Record<Need, number> = { hunger: 700, energy: 780, happiness: 860, affection: 940 }

/**
 * Day 1: Mochi, and the three things you can do for it. The needs move by the
 * app's own rules (`applyAction` in @app/contract), so feeding it here is what
 * feeding it in the app does: each tap gives less the fuller the need is, a
 * full pet won't eat, and a sleepy one won't play. Nothing is saved.
 *
 * It is alive: it lands on its ground when the page opens and its needs fill
 * in; it watches the pointer and blinks (LivePet); a tap on Mochi itself pets
 * it, as the Pet button does (the button stays the way for a keyboard and a
 * screen reader); left alone, it goes back to its need's line, as the app's
 * Home does; and if nothing has been tapped, the button it wants wiggles once.
 */
export function HeroPet() {
	const [needs, setNeeds] = useState(STARTING_NEEDS)
	const [line, setLine] = useState(MISSED_YOU_LINE)
	const [burst, setBurst] = useState<{ action: PetAction; n: number } | null>(null)
	const [isNudging, setIsNudging] = useState(false)
	const taps = useRef({ feed: 0, play: 0, pet: 0, total: 0 })

	const onCare = (action: PetAction) => {
		gaEvent(WEEK_EVENTS.heroPetCared, { action })
		setIsNudging(false)
		const result = applyAction(needs, action)
		if (!result.changed && action !== 'pet') {
			setLine(CANT_HELP[action])
			return
		}
		setNeeds(result.needs)
		setLine(reactionLine(action, taps.current[action]++))
		setBurst({ action, n: taps.current.total++ })
	}

	// Left alone, it says what it needs again.
	const idleLine = needsLine(needs, 'cat')
	useEffect(() => {
		if (line === idleLine) return
		const timer = window.setTimeout(() => setLine(idleLine), IDLE_AFTER)
		return () => window.clearTimeout(timer)
	}, [line, idleLine])

	useEffect(() => {
		const timer = window.setTimeout(() => {
			if (taps.current.total === 0) setIsNudging(true)
		}, NUDGE_AT)
		return () => window.clearTimeout(timer)
	}, [])

	const shown = wholeNeeds(needs)
	const mood = moodFor(needs)
	const wanted = wantedAction(needs)

	return (
		<div className="mx-auto w-full max-w-[760px]">
			<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 sm:gap-x-6">
				<div className="flex flex-col items-end gap-2.5">
					<NeedMeter need="hunger" value={shown.hunger} fillAt={FILL_AT.hunger} />
					<NeedMeter need="energy" value={shown.energy} fillAt={FILL_AT.energy} />
				</div>

				<Stand hasLamp className="relative">
					<div aria-live="polite" className="absolute bottom-[88%] left-[64%] z-10 w-max">
						{/* Keyed by the line, so each new one arrives rather than swapping in place. */}
						<Bubble key={line} className="bubble-in max-w-[37vw] sm:max-w-[240px]">
							{line}
						</Bubble>
					</div>
					{/* A tap on Mochi is the Pet button's; that button is the way for a
					    keyboard and a screen reader, so this one is for the pointer only. */}
					<div
						onClick={() => onCare('pet')}
						className="pet-arrive cursor-pointer select-none [-webkit-tap-highlight-color:transparent]"
					>
						<div className={burst ? (burst.n % 2 ? 'pet-lift-again' : 'pet-lift') : undefined}>
							<LivePet
								appearance={MOCHI.appearance}
								mood={mood}
								label={`Mochi, a ginger cat, looking ${mood}`}
								sizeClassName="hero-pet"
							/>
						</div>
					</div>
					{burst && <Burst key={`burst-${burst.n}`} action={burst.action} species="cat" />}
				</Stand>

				<div className="flex flex-col items-start gap-2.5">
					<NeedMeter need="happiness" value={shown.happiness} fillAt={FILL_AT.happiness} />
					<NeedMeter need="affection" value={shown.affection} fillAt={FILL_AT.affection} />
				</div>
			</div>

			<div className="mx-auto mt-4 flex w-full max-w-[420px] gap-2.5 sm:mt-6 sm:gap-3">
				{ACTIONS.map((action) => (
					<CareButton
						key={action}
						action={action}
						badge={wanted === action ? WANTED_BADGE[action] : undefined}
						isNudging={isNudging && wanted === action}
						onCare={onCare}
					/>
				))}
			</div>
		</div>
	)
}
