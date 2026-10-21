'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { art } from '@app/brand'
import { DEFAULT_LOOK, lookById, type LookId, type Mood } from '@app/contract'
import { LivePet } from '../pet/LivePet'
import { scatter } from './SkyLife'

/**
 * Friends as the app's Friends tab lists them (features/v2-friends-requirements.md,
 * R3): each friend's pet in its mood right now, its name, whose it is, and the
 * mood in a word. Made up for the page; the looks are the app's own.
 */
const FRIENDS: readonly { pet: string; look: LookId; owner: string; mood: Mood }[] = [
	{ pet: 'Luna', look: 'smoke', owner: 'Ece', mood: 'sleepy' },
	{ pet: 'Pretzel', look: 'biscuit', owner: 'Deniz', mood: 'happy' },
	{ pet: 'Olive', look: 'calico', owner: 'Jonah', mood: 'content' },
	{ pet: 'Bao', look: 'pepper', owner: 'Priya', mood: 'sad' }
]
/** A code as the app shows it (R6, R7): eight characters in two groups. An example, not a real one. */
const EXAMPLE_CODE = 'KP7X-M3QD'
const MOCHI = lookById(DEFAULT_LOOK.cat)

/**
 * Day 6's row: your code first, then your friends' pets. While the scene is
 * on screen the page holds still and the scroll moves the row sideways, so
 * every friend passes by; Reduce Motion makes it an ordinary row you swipe.
 * The scene's height is the row's own run, measured.
 */
export function FriendsRail({ children }: { children: React.ReactNode }) {
	const isStill = useReducedMotion()
	const root = useRef<HTMLDivElement>(null)
	const row = useRef<HTMLUListElement>(null)
	const [run, setRun] = useState(0)
	const { scrollYProgress } = useScroll({ target: root, offset: ['start start', 'end end'] })
	const x = useTransform(scrollYProgress, [0.05, 0.95], [0, -run])

	// How far the row must travel to show its last card: measured, and again on resize.
	useLayoutEffect(() => {
		const el = row.current
		if (!el) return
		const measure = () => setRun(Math.max(0, el.scrollWidth - el.clientWidth))
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(el)
		return () => observer.disconnect()
	}, [])

	const cards = (
		<>
			<li className="flex-none">
				<CodeCard />
			</li>
			{FRIENDS.map((friend) => (
				<li key={friend.pet} className="flex-none">
					<FriendCard {...friend} />
				</li>
			))}
		</>
	)

	if (isStill) {
		return (
			<div className="pb-28 pt-36 sm:pb-36 sm:pt-44">
				{children}
				<ul
					ref={row}
					aria-label="Your code and your friends' pets"
					className="friends-row mt-10 flex gap-4 overflow-x-auto pb-4 sm:gap-6"
				>
					{cards}
				</ul>
			</div>
		)
	}

	return (
		<div ref={root} className="relative" style={{ height: `calc(100svh + ${run}px)` }}>
			<div className="sticky top-0 flex h-[100svh] flex-col justify-center pb-16 pt-24 sm:pt-28">
				{children}
				<motion.ul
					ref={row}
					aria-label="Your code and your friends' pets"
					className="friends-row mt-8 flex gap-4 sm:mt-10 sm:gap-6"
					style={{ x }}
				>
					{cards}
				</motion.ul>
			</div>
		</div>
	)
}

/** One friend in the list: the pet under a little sky, its name, whose it is, and its mood. */
function FriendCard({
	pet,
	look,
	owner,
	mood
}: {
	pet: string
	look: LookId
	owner: string
	mood: Mood
}) {
	const { appearance } = lookById(look)
	return (
		<article className="friend-card pane w-[13.5rem] overflow-hidden sm:w-[15.5rem]">
			<div data-sky="morning" className="friend-sky relative h-36 sm:h-44">
				<span aria-hidden="true" className="sky-fill" />
				<div className="absolute inset-x-0 bottom-1 flex justify-center">
					<LivePet
						appearance={appearance}
						mood={mood}
						label={`${pet}, ${owner}'s ${appearance.species}, ${mood}`}
						sizeClassName="friend-pet"
					/>
				</div>
			</div>
			<div className="flex items-end justify-between gap-3 px-4 pb-4 pt-3">
				<div className="min-w-0">
					<h3 className="t-h3 truncate">{pet}</h3>
					<p className="mt-0.5 truncate text-sm text-ink-secondary">
						{owner}&rsquo;s {appearance.species}
					</p>
				</div>
				<span className="shrink-0 rounded-pill bg-surface2 px-2.5 py-1 text-xs font-medium text-ink-secondary">
					{mood}
				</span>
			</div>
		</article>
	)
}

/** "Show my code" (R6): your pet, your code as a QR and as text. */
function CodeCard() {
	return (
		<article className="friend-card pane flex w-[13.5rem] flex-col items-center px-4 pb-4 pt-5 text-center sm:w-[15.5rem]">
			<p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-ink">Your code</p>
			<div className="relative mt-3">
				<QrPattern />
				<span className="absolute -bottom-3 -right-5">
					<LivePet
						appearance={MOCHI.appearance}
						mood="happy"
						hasEffects={false}
						sizeClassName="code-pet"
					/>
				</span>
			</div>
			<p className="t-number mt-4 text-lg font-semibold tracking-[0.14em]">{EXAMPLE_CODE}</p>
			<p className="mt-1 text-sm text-ink-secondary">Scan it with the iPhone&rsquo;s Camera.</p>
		</article>
	)
}

/** A QR code's look (its three corner squares and a field of modules), drawn for the page: it scans to nothing. */
const QR_SIZE = 21
const QR_MODULES = scatter(150, 97, { top: 0, bottom: QR_SIZE }).map((p) => ({
	x: Math.floor((p.x / 100) * QR_SIZE),
	y: Math.min(QR_SIZE - 1, Math.floor(p.y))
}))
/** Inside a corner square or the quiet line around it. */
function isFinder(x: number, y: number): boolean {
	const far = QR_SIZE - 8
	return (x < 8 && y < 8) || (x >= far && y < 8) || (x < 8 && y >= far)
}
function QrPattern() {
	const finders = [
		[0, 0],
		[QR_SIZE - 7, 0],
		[0, QR_SIZE - 7]
	] as const
	return (
		<svg
			aria-hidden="true"
			viewBox={`-1 -1 ${QR_SIZE + 2} ${QR_SIZE + 2}`}
			className="h-28 w-28 rounded-xl sm:h-32 sm:w-32"
			style={{ background: art.qr.paper }}
		>
			{finders.map(([fx, fy]) => (
				<g key={`${fx}-${fy}`} fill={art.qr.ink}>
					<path d={`M${fx} ${fy}h7v7h-7z M${fx + 1} ${fy + 1}v5h5v-5z`} fillRule="evenodd" />
					<rect x={fx + 2} y={fy + 2} width={3} height={3} />
				</g>
			))}
			{QR_MODULES.filter((m) => !isFinder(m.x, m.y)).map((m, i) => (
				<rect key={i} x={m.x} y={m.y} width={1} height={1} fill={art.qr.ink} />
			))}
		</svg>
	)
}
