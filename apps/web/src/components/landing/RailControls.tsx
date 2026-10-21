'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

/** How far one press moves the row: most of what is in view. */
const STEP = 0.8

/**
 * Previous and next for a row that scrolls sideways, so a mouse can reach
 * every phone. Each button rests when its end of the row is reached.
 */
export function RailControls({ target }: { target: string }) {
	const [edge, setEdge] = useState({ start: true, end: false })

	useEffect(() => {
		const rail = document.getElementById(target)
		if (!rail) return
		const read = () =>
			setEdge({
				start: rail.scrollLeft <= 4,
				end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4
			})
		read()
		rail.addEventListener('scroll', read, { passive: true })
		window.addEventListener('resize', read)
		return () => {
			rail.removeEventListener('scroll', read)
			window.removeEventListener('resize', read)
		}
	}, [target])

	const move = (direction: 1 | -1) => {
		const rail = document.getElementById(target)
		rail?.scrollBy({ left: direction * rail.clientWidth * STEP, behavior: 'smooth' })
	}

	return (
		<div className="flex gap-2">
			<button
				type="button"
				onClick={() => move(-1)}
				disabled={edge.start}
				aria-controls={target}
				aria-label="Earlier screens"
				className="grid h-11 w-11 place-items-center rounded-full border border-line-active text-ink transition-[transform,background-color,opacity] duration-fast hover:bg-surface2 active:scale-[0.94] disabled:opacity-35"
			>
				<ArrowLeft aria-hidden="true" className="h-[18px] w-[18px]" />
			</button>
			<button
				type="button"
				onClick={() => move(1)}
				disabled={edge.end}
				aria-controls={target}
				aria-label="More screens"
				className="grid h-11 w-11 place-items-center rounded-full border border-line-active text-ink transition-[transform,background-color,opacity] duration-fast hover:bg-surface2 active:scale-[0.94] disabled:opacity-35"
			>
				<ArrowRight aria-hidden="true" className="h-[18px] w-[18px]" />
			</button>
		</div>
	)
}
