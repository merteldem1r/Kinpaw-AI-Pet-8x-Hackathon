import { art } from '@app/brand'
import { cn, type CssVars } from '@/lib/utils'

/*
 * The app's evening sky (apps/mobile/components/pet/SkyBand.tsx and
 * SkyScene.tsx, "evening"), for the site. The site always shows the evening:
 * the hour the pet has missed you most. Positions are the app's, on its
 * 393-point-wide screen; the scene scales with the box it is placed in.
 */

const WIDTH = 393
const SKY = art.sky.evening
/** Where the art's four stops sit; the band then ends on the page's `bg`. */
const LOCATIONS = [0, 28, 50, 74] as const

const SUN = { x: 0.38, y: 238, r: 20, rayFrom: 28, rayTo: 36 }
const CLOUDS = [
	{ x: 0.62, y: 136, scale: 1.1 },
	{ x: 0.17, y: 196, scale: 0.85 }
]
const CLOUD_OPACITY = 0.4
const STARS = [
	{ x: 0.11, y: 44, r: 1.6 },
	{ x: 0.38, y: 30, r: 1.1 },
	{ x: 0.58, y: 62, r: 1.3 },
	{ x: 0.95, y: 58, r: 1.6 },
	{ x: 0.18, y: 112, r: 1.1 },
	{ x: 0.7, y: 92, r: 1.2 }
]
const STAR_OPACITY = 0.5

/** The evening gradient, ending on the page's ground, as a CSS background. */
const EVENING_GRADIENT = `linear-gradient(180deg, ${SKY.stops
	.map((stop, i) => `${stop} ${LOCATIONS[i]}%`)
	.join(', ')}, rgb(var(--c-bg)) 100%)`

/**
 * The sky band: gradient, setting sun, thin clouds and a few stars, `height`
 * points tall at the app's 393-point width. Decorative.
 */
export function EveningSky({ height, className }: { height: number; className?: string }) {
	return (
		<div
			aria-hidden="true"
			className={cn('pointer-events-none absolute inset-x-0 top-0', className)}
			style={{ height, background: EVENING_GRADIENT }}
		>
			<svg
				viewBox={`0 0 ${WIDTH} ${height}`}
				preserveAspectRatio="xMidYMin slice"
				className="absolute inset-0 h-full w-full"
			>
				{STARS.map((star, i) => (
					<circle
						key={i}
						cx={star.x * WIDTH}
						cy={star.y}
						r={star.r}
						fill={art.star}
						opacity={STAR_OPACITY}
						className="sky-twinkle"
						style={{ '--i': i } as CssVars}
					/>
				))}
				<Sun />
				{CLOUDS.map((cloud, i) => (
					<Cloud key={i} {...cloud} />
				))}
			</svg>
		</div>
	)
}

function Sun() {
	const cx = SUN.x * WIDTH
	return (
		<g>
			<g
				className="sky-rays"
				stroke={SKY.body}
				strokeWidth={2.4}
				strokeLinecap="round"
				style={{ transformOrigin: `${cx}px ${SUN.y}px` }}
			>
				{Array.from({ length: 8 }, (_, i) => {
					const a = (i * Math.PI) / 4
					return (
						<line
							key={i}
							x1={cx + Math.cos(a) * SUN.rayFrom}
							y1={SUN.y + Math.sin(a) * SUN.rayFrom}
							x2={cx + Math.cos(a) * SUN.rayTo}
							y2={SUN.y + Math.sin(a) * SUN.rayTo}
						/>
					)
				})}
			</g>
			<circle cx={cx} cy={SUN.y} r={SUN.r} fill={SKY.body} />
		</g>
	)
}

/** Two soft shapes, as the app draws them: a long low base and a round top. */
function Cloud({ x, y, scale }: { x: number; y: number; scale: number }) {
	const w = 56 * scale
	const h = 26 * scale
	const left = x * WIDTH - w / 2
	const top = y - h / 2
	const base = h * 0.62
	const puff = (h * 0.9) / 2
	return (
		<g fill={art.cloud} opacity={CLOUD_OPACITY}>
			<rect x={left} y={top + h - base} width={w} height={base} rx={base / 2} />
			<circle cx={left + w * 0.42 + puff} cy={top + puff} r={puff} />
		</g>
	)
}
