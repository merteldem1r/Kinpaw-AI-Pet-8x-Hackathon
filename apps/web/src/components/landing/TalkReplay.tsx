'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BookHeart, Volume2 } from 'lucide-react'
import { DEFAULT_LOOK, lookById } from '@app/contract'
import { cn } from '@/lib/utils'
import { gaEvent } from '@/lib/analytics/client'
import { WEEK_EVENTS } from '@/lib/analytics/events'
import { playClip, stopClip } from '@/lib/clips'
import { WEEK_TALK } from '@/lib/pet-lines'
import { LivePet } from '../pet/LivePet'
import { Bubble, SoundBars, Stand } from './stage'
import { prefersReducedMotion, useInViewOnce } from './useInViewOnce'

const MOCHI = lookById(DEFAULT_LOOK.cat)

/** The exchange, step by step. It renders finished, so it reads without JavaScript. */
const SAID = 1
const THINKING = 2
const REPLIED = 3
const KEPT = 4

/** Timings, ms: a pause, your words typing in, the pet thinking, the reply, the fact kept. */
const START_AT = 300
const PER_LETTER = 34
const THINK_AFTER = 450
const REPLY_AFTER = 1500
const KEEP_AFTER = 3300

/**
 * Day 3: you say something worth keeping, and the pet keeps it. A scripted
 * replay of the app's talk (in the app the model writes each reply): your
 * words, the pet thinking, its answer, "Mochi will remember that", and the fact
 * joining what it remembers. It plays once, silently, when it scrolls into
 * view; the button plays it again with Mochi's voice.
 */
export function TalkReplay() {
	const root = useRef<HTMLDivElement>(null)
	const timers = useRef<number[]>([])
	const [step, setStep] = useState(KEPT)
	const [letters, setLetters] = useState<number>(WEEK_TALK.said.length)
	const [isSpeaking, setIsSpeaking] = useState(false)
	const isInView = useInViewOnce(root)

	const cancel = useCallback(() => {
		timers.current.forEach((id) => window.clearTimeout(id))
		timers.current = []
	}, [])

	const run = useCallback(
		(withSound: boolean) => {
			cancel()
			stopClip()
			const speak = () => {
				if (!withSound) return
				setIsSpeaking(true)
				playClip(WEEK_TALK.replyClip, () => setIsSpeaking(false))
			}
			if (prefersReducedMotion()) {
				setStep(KEPT)
				setLetters(WEEK_TALK.said.length)
				speak()
				return
			}
			const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
			setStep(0)
			setLetters(0)
			at(START_AT, () => setStep(SAID))
			for (let i = 1; i <= WEEK_TALK.said.length; i++) {
				at(START_AT + i * PER_LETTER, () => setLetters(i))
			}
			const typed = START_AT + WEEK_TALK.said.length * PER_LETTER
			at(typed + THINK_AFTER, () => setStep(THINKING))
			at(typed + REPLY_AFTER, () => {
				setStep(REPLIED)
				speak()
			})
			at(typed + KEEP_AFTER, () => setStep(KEPT))
		},
		[cancel]
	)

	useEffect(() => {
		if (isInView) run(false)
	}, [isInView, run])

	useEffect(
		() => () => {
			cancel()
			stopClip()
		},
		[cancel]
	)

	const onHear = () => {
		gaEvent(WEEK_EVENTS.memoryReplayPlayed, { part: 'day3' })
		run(true)
	}

	return (
		<div ref={root} className="grid items-end gap-12 lg:grid-cols-[1fr_20rem] lg:gap-16">
			<div className="relative mx-auto w-fit pt-36 sm:pt-28">
				<div className="absolute bottom-[72%] left-[34%] z-10 w-max max-w-[54vw] sm:left-[52%] sm:max-w-[290px]">
					{step === THINKING && (
						<Bubble className="bubble-in">
							<span className="thinking-dots flex h-5 items-center gap-1.5" aria-label="Thinking">
								<span />
								<span />
								<span />
							</span>
						</Bubble>
					)}
					{step >= REPLIED && (
						<>
							<Bubble className="bubble-in">
								<span className="flex items-start gap-2.5">
									<SoundBars isPlaying={isSpeaking} className="mt-0.5 shrink-0 text-brand-ink" />
									{WEEK_TALK.reply}
								</span>
								{/* Inside the bubble, as the app shows it, so it reads on any sky. */}
								<span
									className={cn(
										'mt-2 flex items-center gap-1.5 text-[13px] font-medium text-brand-ink transition-opacity duration-base',
										step >= KEPT ? 'opacity-100' : 'opacity-0'
									)}
								>
									<BookHeart aria-hidden="true" className="h-3.5 w-3.5" />
									Mochi will remember that
								</span>
							</Bubble>
						</>
					)}
				</div>
				<Stand>
					<LivePet
						appearance={MOCHI.appearance}
						mood={step >= REPLIED ? 'happy' : 'content'}
						label="Mochi, a ginger cat, listening"
						sizeClassName="scene-pet"
					/>
				</Stand>
				<p
					className={cn(
						'mx-auto mt-4 w-fit max-w-[19rem] rounded-pill border border-brand-border bg-surface2 px-4 py-2 text-center text-sm text-ink-secondary transition-opacity duration-base',
						step >= SAID ? 'opacity-100' : 'opacity-0'
					)}
				>
					<span className="sr-only">You said: </span>
					{/* The whole line holds the chip's size; only the typed letters show. */}
					<span aria-hidden="true">
						{WEEK_TALK.said.slice(0, letters)}
						<span className="invisible">{WEEK_TALK.said.slice(letters)}</span>
					</span>
					<span className="sr-only">{WEEK_TALK.said}</span>
				</p>
			</div>

			<div>
				<div className="rounded-card border border-line-soft bg-surface p-5 shadow-card">
					<p className="font-display text-lg font-semibold text-ink">Mochi remembers&hellip;</p>
					<ul className="mt-3 space-y-1.5 text-[15px] text-ink-body">
						<li
							className={cn(
								'flex items-center justify-between gap-3 rounded-row bg-brand-dim px-3 py-2.5 font-medium text-ink transition-[opacity,transform] duration-slow ease-out',
								step >= KEPT ? 'opacity-100' : 'translate-y-2 opacity-0'
							)}
						>
							{WEEK_TALK.fact}
							<span className="text-xs font-semibold text-brand-ink">new</span>
						</li>
						{WEEK_TALK.known.map((fact) => (
							<li key={fact} className="rounded-row px-3 py-2.5">
								{fact}
							</li>
						))}
					</ul>
				</div>
				<div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
					<button
						type="button"
						onClick={onHear}
						className="inline-flex h-11 items-center gap-2 rounded-pill bg-ink px-5 text-sm font-semibold text-ink-inverse transition-[transform,background-color] duration-fast hover:bg-ink/90 active:scale-[0.96]"
					>
						<Volume2 aria-hidden="true" className="h-4 w-4" />
						Play it with sound
					</button>
					<p className="text-[13px] text-ink-secondary">A scripted replay.</p>
				</div>
			</div>
		</div>
	)
}
