'use client'

import { useEffect, useRef, useState } from 'react'
import type { Scheme } from '@app/brand'
import { cn } from '@/lib/utils'
import { gaEvent } from '@/lib/analytics/client'
import { WEEK_EVENTS } from '@/lib/analytics/events'

/** The week. A day with a scene is a link; day 4 passes while you scroll and is a dot. */
const DAYS = [
	{ day: 1, label: 'You meet', href: '#day-1' },
	{ day: 2, label: 'It speaks', href: '#day-2' },
	{ day: 3, label: 'It listens', href: '#day-3' },
	{ day: 4 },
	{ day: 5, label: "You're away", href: '#day-5' },
	{ day: 6, label: 'Friends', href: '#day-6' },
	{ day: 7, label: 'It remembers', href: '#day-7' }
] as const

/** A day is the current one while it crosses the middle of the screen. */
const MIDDLE_OF_SCREEN = '-50% 0px -50% 0px'

/**
 * The week's spine: seven days in a capsule on the bottom edge, the current one
 * lit and named. It follows the scroll, jumps on a tap, takes the scheme of the
 * sky it floats over, and leaves when the week ends. Reaching a day's scene is
 * also what `week_day_viewed` counts, once per day per page view.
 */
export function WeekStrip() {
	const [active, setActive] = useState(1)
	const [scheme, setScheme] = useState<Scheme | undefined>(undefined)
	const [isOver, setIsOver] = useState(false)
	const seen = useRef(new Set<number>())

	useEffect(() => {
		const days = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue
					const day = Number(entry.target.dataset.day)
					setActive(day)
					// A day that passes in a line sits on the page's own ground.
					setScheme(entry.target.dataset.scheme === 'light' ? 'light' : 'dark')
					const isScene = DAYS.some((d) => d.day === day && 'href' in d)
					if (isScene && !seen.current.has(day)) {
						seen.current.add(day)
						gaEvent(WEEK_EVENTS.dayViewed, { day: String(day) })
					}
				}
			},
			{ rootMargin: MIDDLE_OF_SCREEN }
		)
		document.querySelectorAll('[data-day]').forEach((el) => days.observe(el))

		// The week is over once the middle of the screen has left it. Watching the
		// whole week, not a marker at its end, also catches a jump straight past it.
		const week = new IntersectionObserver(
			([entry]) => {
				if (entry) setIsOver(!entry.isIntersecting)
			},
			{ rootMargin: MIDDLE_OF_SCREEN }
		)
		const el = document.getElementById('week')
		if (el) week.observe(el)

		return () => {
			days.disconnect()
			week.disconnect()
		}
	}, [])

	return (
		<nav
			aria-label="The week"
			data-scheme={scheme}
			inert={isOver}
			className={cn(
				'fixed inset-x-0 bottom-4 z-40 flex justify-center px-3 transition-[opacity,transform] duration-base ease-out',
				isOver && 'translate-y-3 opacity-0'
			)}
		>
			<ol className="flex h-12 items-center gap-0.5 rounded-pill border border-line-glass bg-bg/80 pl-4 pr-1.5 text-ink shadow-raised backdrop-blur-xl backdrop-saturate-150">
				<li aria-hidden="true" className="pr-1.5 text-[13px] font-medium text-ink-tertiary">
					Day
				</li>
				{DAYS.map((d) => {
					const isActive = d.day === active
					if (!('href' in d)) {
						return (
							<li key={d.day} aria-hidden="true" className="grid h-9 w-4 place-items-center">
								<span
									className={cn(
										'h-1 w-1 rounded-full transition-colors duration-base',
										isActive ? 'bg-brand-ink' : 'bg-ink-tertiary'
									)}
								/>
							</li>
						)
					}
					return (
						<li key={d.day}>
							<a
								href={d.href}
								aria-current={isActive ? 'step' : undefined}
								className="flex h-9 min-w-9 items-center justify-center gap-2 rounded-pill px-3 text-sm font-medium text-ink-secondary transition-colors duration-base hover:text-ink aria-[current=step]:bg-brand-dim aria-[current=step]:text-brand-ink"
							>
								<span className="sr-only">Day </span>
								<span className="t-number font-semibold">{d.day}</span>
								<span className={cn('whitespace-nowrap', isActive ? 'inline' : 'sr-only')}>
									{d.label}
								</span>
							</a>
						</li>
					)
				})}
			</ol>
		</nav>
	)
}
