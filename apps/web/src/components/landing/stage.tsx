import {
	Bone,
	Fish,
	Hand,
	Heart,
	Smile,
	Soup,
	Star,
	Volleyball,
	Zap,
	type LucideIcon
} from 'lucide-react'
import { art } from '@app/brand'
import { isLow, type Need, type PetAction, type Species } from '@app/contract'
import { cn, type CssVars } from '@/lib/utils'

/*
 * The pieces a pet stands among on the landing page, at the page's own size:
 * a need, a care button, the pet's bubble, what floats up after a care action,
 * and the bars that move while it speaks. They follow the app's Home
 * (apps/mobile/components/pet), as the phone's twins in ../device/care.tsx do.
 */

const NEED: Record<Need, { label: string; icon: LucideIcon }> = {
	hunger: { label: 'Hunger', icon: Soup },
	happiness: { label: 'Happiness', icon: Smile },
	energy: { label: 'Energy', icon: Zap },
	affection: { label: 'Affection', icon: Heart }
}

/**
 * One need beside the pet, as the app's pills: an icon and a short bar. Low
 * turns coral and says "low" inside the pill, never colour alone; on a phone
 * the word takes the bar's place, so the pill keeps its width. From a laptop up
 * it also carries the need's name.
 *
 * With `fillAt` the bar fills from empty once, that many ms after the page
 * opens (`.meter-fill`); after that it moves only when the value does.
 */
export function NeedMeter({ need, value, fillAt }: { need: Need; value: number; fillAt?: number }) {
	const { label, icon: Icon } = NEED[need]
	const low = isLow(value)
	return (
		<span
			role="meter"
			aria-label={low ? `${label}, low` : label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(value)}
			className={cn(
				'flex h-8 items-center gap-1.5 rounded-pill bg-surface2 px-2 shadow-soft sm:h-10 sm:gap-2 sm:px-3',
				low ? 'border-[1.5px] border-error-text' : 'border border-line-soft'
			)}
		>
			<Icon
				aria-hidden="true"
				className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4', low ? 'text-error-text' : 'text-ink-secondary')}
				strokeWidth={1.9}
			/>
			<span className="hidden text-[13px] font-medium text-ink-secondary lg:inline">{label}</span>
			<span
				className={cn(
					'h-1.5 w-6 overflow-hidden rounded-pill bg-tint-track sm:block sm:w-12',
					low ? 'hidden' : 'block'
				)}
			>
				<span
					className={cn(
						'block h-full rounded-pill transition-[width] duration-slow ease-out',
						fillAt !== undefined && 'meter-fill',
						low ? 'bg-error-text' : 'bg-brand-ink'
					)}
					style={{
						width: `${value}%`,
						animationDelay: fillAt !== undefined ? `${fillAt}ms` : undefined
					}}
				/>
			</span>
			{low && (
				<span aria-hidden="true" className="text-xs font-semibold text-error-text">
					low
				</span>
			)}
		</span>
	)
}

/**
 * Where a pet stands: the app's ground band (the welcome screen's), a soft
 * rounded strip under its feet, so the pet is somewhere and not floating.
 * `hasLamp` adds the app's warm lamp glow behind it, which shows only on a
 * dark sky (evening and night).
 */
export function Stand({
	hasLamp = false,
	className,
	children
}: {
	hasLamp?: boolean
	className?: string
	children: React.ReactNode
}) {
	return (
		<div className={cn('pet-stand', className)}>
			{hasLamp && (
				<span aria-hidden="true" className="lamp-glow" style={{ '--lamp': art.lamp } as CssVars} />
			)}
			<span aria-hidden="true" className="pet-ground" />
			{children}
		</div>
	)
}

const CARE: Record<PetAction, { label: string; icon: LucideIcon; color: string }> = {
	feed: { label: 'Feed', icon: Soup, color: art.care.feed },
	play: { label: 'Play', icon: Volleyball, color: art.care.play },
	pet: { label: 'Pet', icon: Hand, color: art.care.pet }
}

/**
 * Feed, Play or Pet, in its own colour. The one the pet wants most fills with
 * the colour and wears a badge; `isNudging` gives it one small wiggle, to say
 * the buttons work.
 */
export function CareButton({
	action,
	badge,
	isNudging = false,
	onCare
}: {
	action: PetAction
	badge?: string
	isNudging?: boolean
	onCare: (action: PetAction) => void
}) {
	const { label, icon: Icon, color } = CARE[action]
	const wanted = Boolean(badge)
	return (
		<button
			type="button"
			onClick={() => onCare(action)}
			className={cn(
				'relative flex h-14 flex-1 items-center justify-center gap-2 rounded-[18px] bg-surface2 text-[15px] font-semibold text-ink transition-transform duration-fast ease-out active:scale-[0.96]',
				isNudging && 'care-nudge'
			)}
			style={{
				border: wanted ? `1.5px solid ${color}` : `1px solid ${color}66`,
				backgroundImage: wanted ? `linear-gradient(180deg, ${color}4d, ${color}1f)` : undefined,
				boxShadow: wanted ? `0 8px 18px -8px ${color}` : undefined
			}}
		>
			{badge && (
				<span
					className="absolute -top-2.5 rounded-pill px-2 py-px text-xs font-semibold"
					style={{ backgroundColor: color, color: art.mark.ground }}
				>
					{badge}
				</span>
			)}
			<span
				aria-hidden="true"
				className="grid h-8 w-8 place-items-center rounded-full"
				style={{
					backgroundColor: wanted ? color : `${color}33`,
					color: wanted ? art.mark.ground : color
				}}
			>
				<Icon className="h-[17px] w-[17px]" strokeWidth={2} />
			</span>
			{label}
		</button>
	)
}

/** What the pet says: Inter in a bubble whose tail corner points at the pet. */
export function Bubble({
	children,
	tail = 'left',
	className
}: {
	children: React.ReactNode
	/** The corner nearest the pet. */
	tail?: 'left' | 'right'
	className?: string
}) {
	return (
		<p
			className={cn(
				'rounded-card border border-line-hairline bg-surface2 px-4 py-3 text-[15px] leading-snug text-ink shadow-card',
				tail === 'left' ? 'rounded-bl-[6px]' : 'rounded-br-[6px]',
				className
			)}
		>
			{children}
		</p>
	)
}

const BURST: Record<PetAction, { color: string }> = {
	feed: { color: art.pet.fx.treat },
	play: { color: art.pet.fx.star },
	pet: { color: art.pet.fx.heart }
}
/** Where each piece starts and how far it drifts sideways, in px. */
const BURST_PIECES = [
	{ x: -46, drift: -14, delay: 0 },
	{ x: -14, drift: 6, delay: 70 },
	{ x: 18, drift: -6, delay: 30 },
	{ x: 48, drift: 16, delay: 110 }
]

/**
 * Hearts after Pet, treats after Feed (fish for a cat, bones for a dog), stars
 * after Play, floating up from the pet. Remount it (a new `key`) to play again.
 */
export function Burst({ action, species }: { action: PetAction; species: Species }) {
	const Icon = action === 'pet' ? Heart : action === 'play' ? Star : species === 'cat' ? Fish : Bone
	return (
		<span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[38%]">
			{BURST_PIECES.map((piece, i) => (
				<Icon
					key={i}
					className="burst-piece absolute left-1/2 h-5 w-5"
					fill={action === 'feed' ? 'none' : 'currentColor'}
					strokeWidth={2}
					style={
						{
							color: BURST[action].color,
							marginLeft: piece.x,
							'--drift': `${piece.drift}px`,
							animationDelay: `${piece.delay}ms`
						} as CssVars
					}
				/>
			))}
		</span>
	)
}

/** Four bars that move while the pet speaks, and rest when it stops. */
export function SoundBars({ isPlaying, className }: { isPlaying: boolean; className?: string }) {
	return (
		<span
			aria-hidden="true"
			data-playing={isPlaying || undefined}
			className={cn('sound-bars inline-flex h-4 items-center gap-[3px]', className)}
		>
			{[0, 1, 2, 3].map((i) => (
				<span key={i} className="w-[3px] rounded-pill bg-current" style={{ '--i': i } as CssVars} />
			))}
		</span>
	)
}
