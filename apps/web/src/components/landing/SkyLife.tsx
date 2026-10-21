import { art } from '@app/brand'
import type { CssVars } from '@/lib/utils'

/*
 * Life in the sky, as the app's SkyScene has it (`art.life` in @app/brand):
 * fireflies at dusk, light motes in the morning, birds by day. CSS only
 * (globals.css, "Life in the sky"); a Scene shows the kind its hour has, a
 * time-lapse fades each in at its hours. Still under Reduce Motion.
 */

export type LifeKind = 'firefly' | 'mote' | 'bird'

/** Where the pieces are and how each moves, from a fixed seed, so the server and the browser agree. */
export function scatter(count: number, seed: number, area: { top: number; bottom: number }) {
	let state = seed
	const next = () => {
		state = (state * 1664525 + 1013904223) >>> 0
		return state / 2 ** 32
	}
	return Array.from({ length: count }, () => ({
		x: Math.round(next() * 96 + 2),
		y: Math.round(area.top + next() * (area.bottom - area.top)),
		/** 0–1, for size, speed and delay. */
		a: next(),
		b: next()
	}))
}

const FIREFLIES = scatter(12, 7, { top: 38, bottom: 94 })
const MOTES = scatter(14, 23, { top: 24, bottom: 96 })
const BIRDS = [
	{ y: 14, delay: 0, duration: 30, size: 22 },
	{ y: 19, delay: 1.4, duration: 30, size: 16 },
	{ y: 26, delay: 13, duration: 36, size: 19 }
]

export function SkyLife({ kind, className }: { kind: LifeKind; className?: string }) {
	return (
		<span aria-hidden="true" data-life={kind} className={className ?? 'sky-life'}>
			{kind === 'firefly' &&
				FIREFLIES.map((f, i) => (
					<span
						key={i}
						className="life-firefly"
						style={
							{
								left: `${f.x}%`,
								top: `${f.y}%`,
								color: art.life.firefly,
								'--drift-s': `${8 + f.a * 7}s`,
								'--glow-s': `${2 + f.b * 2.5}s`,
								'--delay': `${-f.a * 9}s`
							} as CssVars
						}
					/>
				))}
			{kind === 'mote' &&
				MOTES.map((m, i) => (
					<span
						key={i}
						className="life-mote"
						style={
							{
								left: `${m.x}%`,
								top: `${m.y}%`,
								color: art.life.mote,
								'--rise-s': `${11 + m.a * 9}s`,
								'--delay': `${-m.b * 16}s`
							} as CssVars
						}
					/>
				))}
			{kind === 'bird' &&
				BIRDS.map((bird, i) => (
					<span
						key={i}
						className="life-bird"
						style={
							{
								top: `${bird.y}%`,
								'--fly-s': `${bird.duration}s`,
								'--delay': `${bird.delay}s`
							} as CssVars
						}
					>
						<svg
							viewBox="0 0 20 8"
							width={bird.size}
							height={bird.size * 0.4}
							style={{ color: art.life.bird }}
						>
							<path
								d="M1 6 Q5.5 0.5 10 5 Q14.5 0.5 19 6"
								fill="none"
								stroke="currentColor"
								strokeWidth={1.6}
								strokeLinecap="round"
							/>
						</svg>
					</span>
				))}
		</span>
	)
}
