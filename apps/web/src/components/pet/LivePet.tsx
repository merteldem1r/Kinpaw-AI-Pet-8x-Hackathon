'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { HEAD_CENTRE, art } from '@app/brand'
import type { Mood, PetAppearance } from '@app/contract'
import { cn, type CssVars } from '@/lib/utils'
import { PetSvg } from './PetSvg'

/** What floats up from a sleeping pet, smallest first. */
const SLEEP_LETTERS = ['z', 'z', 'Z'] as const

/** How far the eyes turn toward the pointer at most, in the drawing's units. */
const LOOK_X = 1.8
const LOOK_Y = 1.3
/** Within this many pet-widths of the eyes, the pointer pulls the eyes less than all the way. */
const LOOK_REACH = 1.5

/**
 * A pet that is alive on the page: it breathes, wags its tail (faster when
 * happy, barely when asleep), blinks now and then (each pet on its own beat),
 * looks toward the mouse while it is on screen, hops when the mouse arrives,
 * shows its mood (z's asleep, a heart now and then when happy), and when its
 * mood changes the old face fades out over the new one instead of cutting.
 *
 * The look is two CSS variables written straight to the element on the next
 * frame (no React render per pointer move), read by PetSvg's `pet-gaze`. Under
 * Reduce Motion it does not look, and the blink and the fade are stilled by
 * globals.css.
 */
export function LivePet({
	appearance,
	mood,
	label,
	sizeClassName,
	isLooking = true,
	hasEffects = true
}: {
	appearance: PetAppearance
	mood: Mood
	label?: string
	/** The pet's size (e.g. `hero-pet`, `scene-pet`). */
	sizeClassName: string
	/** Look toward the pointer; off for a pet that should keep to itself. */
	isLooking?: boolean
	/** The mood's z's or hearts; off where the pet is small. */
	hasEffects?: boolean
}) {
	const ref = useRef<HTMLDivElement>(null)
	const beat = blinkBeat(useId())
	const [shownMood, setShownMood] = useState(mood)
	const [leaving, setLeaving] = useState<{ mood: Mood; n: number } | null>(null)

	// A new mood: the face it had leaves on top while the new one shows under it.
	if (mood !== shownMood) {
		setLeaving({ mood: shownMood, n: (leaving?.n ?? 0) + 1 })
		setShownMood(mood)
	}

	useEffect(() => {
		const el = ref.current
		if (!el || !isLooking) return
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

		let frame = 0
		let pointer: { x: number; y: number } | null = null
		const look = () => {
			frame = 0
			const box = el.getBoundingClientRect()
			let x = 0
			let y = 0
			if (pointer) {
				const dx = pointer.x - (box.left + box.width * HEAD_CENTRE.x)
				const dy = pointer.y - (box.top + box.height * HEAD_CENTRE.y)
				const distance = Math.hypot(dx, dy) || 1
				const pull = Math.min(1, distance / (box.width * LOOK_REACH))
				x = (dx / distance) * LOOK_X * pull
				y = (dy / distance) * LOOK_Y * pull
			}
			el.style.setProperty('--look-x', x.toFixed(2))
			el.style.setProperty('--look-y', y.toFixed(2))
		}
		const onMove = (e: PointerEvent) => {
			if (e.pointerType !== 'mouse') return
			pointer = { x: e.clientX, y: e.clientY }
			if (!frame) frame = requestAnimationFrame(look)
		}
		// The mouse left the window: look ahead again.
		const onLeave = () => {
			pointer = null
			if (!frame) frame = requestAnimationFrame(look)
		}

		// Only a pet on screen follows the pointer.
		let isWatching = false
		const io = new IntersectionObserver(([entry]) => {
			const isOnScreen = Boolean(entry?.isIntersecting)
			if (isOnScreen === isWatching) return
			isWatching = isOnScreen
			if (isOnScreen) {
				window.addEventListener('pointermove', onMove, { passive: true })
				document.documentElement.addEventListener('pointerleave', onLeave)
			} else {
				window.removeEventListener('pointermove', onMove)
				document.documentElement.removeEventListener('pointerleave', onLeave)
			}
		})
		io.observe(el)
		return () => {
			io.disconnect()
			window.removeEventListener('pointermove', onMove)
			document.documentElement.removeEventListener('pointerleave', onLeave)
			cancelAnimationFrame(frame)
		}
	}, [isLooking])

	return (
		<div
			ref={ref}
			data-mood={shownMood}
			className="live-pet relative"
			style={{ '--blink-delay': beat.delay, '--blink-period': beat.period } as CssVars}
		>
			<PetSvg
				appearance={appearance}
				mood={shownMood}
				label={label}
				className={cn('pet-breathe block', sizeClassName)}
			/>
			{hasEffects && shownMood === 'sleepy' && (
				<span aria-hidden="true" className="pet-zzz" style={{ color: art.pet.fx.sleep }}>
					{SLEEP_LETTERS.map((letter, i) => (
						<span key={i} style={{ '--i': i } as CssVars}>
							{letter}
						</span>
					))}
				</span>
			)}
			{hasEffects && shownMood === 'happy' && (
				<span aria-hidden="true" className="pet-hearts" style={{ color: art.pet.fx.heart }}>
					{[0, 1].map((i) => (
						<Heart key={i} fill="currentColor" strokeWidth={0} style={{ '--i': i } as CssVars} />
					))}
				</span>
			)}
			{leaving && (
				<span
					key={leaving.n}
					aria-hidden="true"
					className="pet-mood-out absolute inset-0"
					onAnimationEnd={() => setLeaving(null)}
				>
					<PetSvg
						appearance={appearance}
						mood={leaving.mood}
						className={cn('block', sizeClassName)}
					/>
				</span>
			)}
		</div>
	)
}

/**
 * Each pet's blink: when its first one comes and how often, from its React id,
 * so the pets on a page never blink together and the server and the browser
 * agree on the beat (a random one would not hydrate).
 */
function blinkBeat(id: string): { delay: string; period: string } {
	let hash = 0
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
	return { delay: `${(hash % 30) / 10}s`, period: `${4.4 + (hash % 9) * 0.35}s` }
}
