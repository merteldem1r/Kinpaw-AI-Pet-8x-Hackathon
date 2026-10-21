import type { Scheme } from '@app/brand'
import { LOCAL_SKY_SCRIPT, schemeForPhase, type SkyPhase } from '@/lib/sky'
import { cn, type CssVars } from '@/lib/utils'
import { PointerDepth } from './PointerDepth'
import { SkyLife, scatter } from './SkyLife'

/** Where the sky's stars sit, as % of the scene; shown in the evening and at night. */
export const STARS = [
	{ x: 7, y: 9, r: 1.6 },
	{ x: 19, y: 5, r: 1.1 },
	{ x: 33, y: 12, r: 1.3 },
	{ x: 46, y: 6, r: 1.1 },
	{ x: 58, y: 14, r: 1.5 },
	{ x: 69, y: 7, r: 1.2 },
	{ x: 91, y: 10, r: 1.4 },
	{ x: 96, y: 22, r: 1.1 },
	{ x: 12, y: 24, r: 1.2 },
	{ x: 77, y: 26, r: 1.1 }
]

/** Many small faint stars between the bright ones, from a fixed seed. */
export const FAINT_STARS = scatter(26, 41, { top: 2, bottom: 62 }).map((p) => ({
	x: p.x,
	y: p.y,
	r: 0.6 + p.a * 0.5
}))

/**
 * Two thin clouds, by day and in the evening; positions in % of the scene,
 * widths in px. Each scene takes its own pair, so no two days share a sky.
 */
const CLOUD_SETS = [
	[
		{ x: 74, y: 23, w: 168 },
		{ x: 3, y: 37, w: 124 }
	],
	[
		{ x: 62, y: 8, w: 150 },
		{ x: 8, y: 54, w: 110 }
	],
	[
		{ x: 4, y: 12, w: 132 },
		{ x: 80, y: 46, w: 150 }
	],
	[
		{ x: 40, y: 5, w: 120 },
		{ x: 86, y: 30, w: 96 }
	]
]

/**
 * One day of the week: a full-bleed sky at its own hour, with the scheme that
 * hour takes in the app (light by day, dark from the evening on), so the page
 * travels from light to dark as the week passes. The sky opens on the ground
 * the scene above it closed on (`prev`), which reads as the night turning into
 * a morning or a day into dusk.
 *
 * `followsLocalSky` is day 1: rendered as an evening, then set to the visitor's
 * own hour before the first paint by an inline script (LOCAL_SKY_SCRIPT in
 * src/lib/sky.ts), and again by <FollowSky> when the page is reached without a
 * reload, where an inline script does not run.
 */
export function Scene({
	id,
	day,
	phase,
	prev,
	followsLocalSky = false,
	followsLocalPrev = false,
	bodyAt,
	className,
	children
}: {
	id: string
	/** The day this scene is, for the week strip; the close after the week has none. */
	day?: number
	phase: SkyPhase
	/** The scheme of the scene above, whose ground this sky opens on. */
	prev?: Scheme
	followsLocalSky?: boolean
	/** The scene above is day 1, so its ground follows the visitor's hour too. */
	followsLocalPrev?: boolean
	/** Where this scene hangs its sun or moon, in %, when the hour's own place is behind something. */
	bodyAt?: { x: number; y: number }
	className?: string
	children: React.ReactNode
}) {
	const bodyStyle = bodyAt
		? ({ '--sky-body-x': `${bodyAt.x}%`, '--sky-body-y': `${bodyAt.y}%` } as CssVars)
		: undefined
	return (
		<section
			id={id}
			data-day={day}
			data-sky={phase}
			data-scheme={schemeForPhase(phase)}
			data-prev={prev}
			data-follow-sky={followsLocalSky ? '' : undefined}
			data-follow-prev={followsLocalPrev ? '' : undefined}
			// The inline script sets these three before hydration; React keeps what it finds.
			suppressHydrationWarning
			className={cn('scene relative isolate overflow-clip bg-bg text-ink', className)}
		>
			<span aria-hidden="true" className="sky-fill -z-20" />
			<span aria-hidden="true" className="sky-stars absolute inset-0 -z-20">
				{turned(STARS, day).map((star, i) => (
					<Star key={i} {...star} i={i} />
				))}
				{turned(FAINT_STARS, day).map((star, i) => (
					<Star key={`faint-${i}`} {...star} i={i + STARS.length} isFaint />
				))}
				{/* Now and then, one crosses the sky; each scene on its own beat. */}
				<span
					className="sky-shooting"
					style={{ '--shoot-delay': `${2 + (day ?? 0) * 2.7}s` } as CssVars}
				/>
			</span>
			<span aria-hidden="true" className="sky-clouds absolute inset-0 -z-20 max-sm:hidden">
				{CLOUD_SETS[(day ?? 0) % CLOUD_SETS.length]!.map((cloud, i) => (
					<Cloud key={i} {...cloud} />
				))}
			</span>
			<SkyLife kind="firefly" />
			<SkyLife kind="mote" />
			<SkyLife kind="bird" />
			<span aria-hidden="true" className="sky-glow -z-20" style={bodyStyle} />
			<span aria-hidden="true" className="sky-body -z-20" style={bodyStyle} />
			<PointerDepth />
			<span aria-hidden="true" className="grain -z-10" />
			{children}
			{/* After this scene's markup and before its first paint: the visitor's own hour. */}
			{(followsLocalSky || followsLocalPrev) && (
				<script dangerouslySetInnerHTML={{ __html: LOCAL_SKY_SCRIPT }} />
			)}
		</section>
	)
}

/** A star, twinkling on its own beat; the faint ones fill the sky between the bright ones. */
function Star({
	x,
	y,
	r,
	i,
	isFaint = false
}: {
	x: number
	y: number
	r: number
	i: number
	isFaint?: boolean
}) {
	return (
		<span
			className={cn('sky-star sky-twinkle absolute rounded-full', isFaint && 'sky-star-faint')}
			style={{ left: `${x}%`, top: `${y}%`, width: r * 2, height: r * 2, '--i': i } as CssVars}
		/>
	)
}

/** A cloud as the app draws it (SkyScene): a long low base and one round top. */
export function Cloud({ x, y, w }: { x: number; y: number; w: number }) {
	return (
		<svg
			viewBox="0 0 56 26"
			className="sky-cloud absolute"
			// Full size on a desktop, smaller on a tablet; a phone has no room for clouds.
			style={{ left: `${x}%`, top: `${y}%`, width: `clamp(${w * 0.6}px, ${w / 14.4}vw, ${w}px)` }}
		>
			<rect x="0" y="9.9" width="56" height="16.1" rx="8.05" fill="currentColor" />
			<circle cx="35.2" cy="11.7" r="11.7" fill="currentColor" />
		</svg>
	)
}

/** The sky's stars, mirrored on odd days, so neighbouring nights are not the same night. */
function turned<T extends { x: number }>(points: readonly T[], day = 0): readonly T[] {
	return day % 2 === 1 ? points.map((p) => ({ ...p, x: 100 - p.x })) : points
}
