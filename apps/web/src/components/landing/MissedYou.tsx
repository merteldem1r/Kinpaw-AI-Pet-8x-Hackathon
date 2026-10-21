'use client'

import { useEffect, useRef, useState } from 'react'
import { BookHeart, Volume2 } from 'lucide-react'
import { DEFAULT_LOOK, lookById } from '@app/contract'
import { gaEvent } from '@/lib/analytics/client'
import { WEEK_EVENTS } from '@/lib/analytics/events'
import { playClip, stopClip } from '@/lib/clips'
import { WEEK_TALK } from '@/lib/pet-lines'
import { LivePet } from '../pet/LivePet'
import { SoundBars, Stand } from './stage'
import { useInViewOnce } from './useInViewOnce'

const MOCHI = lookById(DEFAULT_LOOK.cat)

/**
 * Day 7: the pet's first line when you come back, at the size of a headline,
 * because it is the page's point. The line and the note under it are the app's
 * (the greeting asks about a remembered event once its day has come; "From
 * Mochi's memory" marks a reply that used a fact). The button says it aloud.
 */
export function MissedYou() {
	const root = useRef<HTMLDivElement>(null)
	const isInView = useInViewOnce(root, 0.5)
	const [isSpeaking, setIsSpeaking] = useState(false)

	useEffect(() => stopClip, [])

	const onHear = () => {
		gaEvent(WEEK_EVENTS.memoryReplayPlayed, { part: 'day7' })
		setIsSpeaking(true)
		playClip(WEEK_TALK.missedClip, () => setIsSpeaking(false))
	}

	return (
		<div
			ref={root}
			data-arrived={isInView || undefined}
			className="missed grid items-end gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:gap-8"
		>
			<div>
				<blockquote className="missed-line relative rounded-[2rem] rounded-br-[10px] border border-line-hairline bg-surface2 px-7 py-8 shadow-raised sm:px-10 sm:py-10">
					<p className="missed-words text-balance font-sans font-semibold text-ink">
						{WEEK_TALK.missed}
					</p>
					<footer className="mt-5 flex items-center gap-1.5 text-sm font-medium text-brand-ink">
						<BookHeart aria-hidden="true" className="h-4 w-4" />
						From Mochi&rsquo;s memory
					</footer>
				</blockquote>
				<div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
					<button
						type="button"
						onClick={onHear}
						className="inline-flex h-12 items-center gap-2.5 rounded-pill bg-brand px-6 text-[15px] font-semibold text-on-brand shadow-cta transition-[transform,background-color] duration-fast hover:bg-brand-hover active:scale-[0.96]"
					>
						{isSpeaking ? (
							<SoundBars isPlaying />
						) : (
							<Volume2 aria-hidden="true" className="h-[18px] w-[18px]" />
						)}
						Hear Mochi say it
					</button>
				</div>
			</div>
			<div className="missed-pet flex justify-center lg:justify-end">
				<Stand hasLamp>
					<LivePet
						appearance={MOCHI.appearance}
						mood="happy"
						label="Mochi, a ginger cat, happy to see you"
						sizeClassName="scene-pet scene-pet-large"
					/>
				</Stand>
			</div>
		</div>
	)
}
