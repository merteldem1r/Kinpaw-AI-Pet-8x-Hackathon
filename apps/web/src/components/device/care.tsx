import {
	Hand,
	Heart,
	Keyboard,
	Mic,
	Smile,
	Soup,
	Volleyball,
	Zap,
	type LucideIcon
} from 'lucide-react'
import { art } from '@app/brand'
import { cn } from '@/lib/utils'
import { type } from './parts'

/*
 * Kinpaw's own pieces of the Home screen, drawn after apps/mobile/components/pet (NeedPill,
 * CareButton, MicButton, WordsChip, PetBubble) in the app's points. When one of those changes
 * shape, change its twin here (M8: brought in line with the one-screen Home and talking by voice).
 */

/** Below this a need reads as low (isLow in @app/contract). */
const LOW_BELOW = 30

const NEED: Record<
	'hunger' | 'happiness' | 'energy' | 'affection',
	{ label: string; icon: LucideIcon }
> = {
	hunger: { label: 'Hunger', icon: Soup },
	happiness: { label: 'Happiness', icon: Smile },
	energy: { label: 'Energy', icon: Zap },
	affection: { label: 'Affection', icon: Heart }
}
export type Need = keyof typeof NEED

const PILL_HEIGHT = 32
const PILL_BAR = 34

/**
 * One need in a small pill beside the pet: an icon and a short bar, no name and no number. Low
 * turns coral and says "low", never colour alone.
 */
export function NeedPill({ need, value }: { need: Need; value: number }) {
	const { label, icon: Icon } = NEED[need]
	const isLow = value < LOW_BELOW
	return (
		<span
			aria-label={`${label}, ${value} percent${isLow ? ', low' : ''}`}
			className={cn(
				'flex items-center gap-[7px] rounded-pill bg-surface2 px-[10px]',
				isLow ? 'border-[1.5px] border-error-text' : 'border border-line-soft'
			)}
			style={{ height: PILL_HEIGHT }}
		>
			<Icon
				size={16}
				strokeWidth={1.9}
				className={isLow ? 'text-error-text' : 'text-ink-secondary'}
			/>
			<span
				className="block h-[5px] overflow-hidden rounded-pill bg-tint-track"
				style={{ width: PILL_BAR }}
			>
				<span
					className={cn('block h-full rounded-pill', isLow ? 'bg-error-text' : 'bg-brand-ink')}
					style={{ width: `${value}%` }}
				/>
			</span>
			{isLow && (
				<span className="font-semibold text-error-text" style={type('caption')}>
					low
				</span>
			)}
		</span>
	)
}

const CARE = {
	feed: { label: 'Feed', icon: Soup, color: art.care.feed },
	play: { label: 'Play', icon: Volleyball, color: art.care.play },
	pet: { label: 'Pet', icon: Hand, color: art.care.pet }
} as const
export type CareAction = keyof typeof CARE

const TILE_HEIGHT = 56
const DISC = 32

/**
 * Feed, Play or Pet: a slim tile in its own colour. Wanted (the lowest need is low and this
 * helps, or the pet's reply asked for it) fills with the colour and wears a badge.
 */
export function CareTile({ action, badge }: { action: CareAction; badge?: string }) {
	const { label, icon: Icon, color } = CARE[action]
	const wanted = Boolean(badge)
	return (
		<span
			className="relative flex flex-1 items-center justify-center gap-[8px] bg-surface2"
			style={{
				height: TILE_HEIGHT,
				borderRadius: 18,
				border: wanted ? `1.5px solid ${color}` : `1px solid ${color}47`,
				background: wanted ? `linear-gradient(180deg, ${color}40, ${color}14)` : undefined,
				boxShadow: wanted ? `0 0 18px ${color}55` : undefined
			}}
		>
			{badge && (
				<span
					className="absolute -top-[10px] rounded-pill px-[8px] py-[1px] font-semibold"
					style={{ ...type('caption'), backgroundColor: color, color: art.mark.ground }}
				>
					{badge}
				</span>
			)}
			<span
				className="grid place-items-center rounded-full"
				style={{
					width: DISC,
					height: DISC,
					backgroundColor: wanted ? color : `${color}2e`,
					color: wanted ? art.mark.ground : color
				}}
			>
				<Icon size={17} strokeWidth={2} />
			</span>
			<span style={type('label')}>{label}</span>
		</span>
	)
}

const MIC = 64
const SIDE = 44

/** Talking on Home: the round amber mic, the keyboard beside it to type instead. */
export function TalkRow({ listening = false }: { listening?: boolean }) {
	return (
		<span className="flex items-center justify-center gap-[22px]">
			<span style={{ width: SIDE }} />
			<span
				className={cn(
					'grid place-items-center rounded-full bg-gradient-to-br from-brand-from to-brand-to text-on-brand shadow-card',
					listening && 'scale-[1.06] ring-4 ring-brand-ink/25'
				)}
				style={{ width: MIC, height: MIC }}
			>
				<Mic size={26} strokeWidth={2} />
			</span>
			<span
				className="grid place-items-center rounded-full border border-line-soft bg-surface2 text-ink-secondary"
				style={{ width: SIDE, height: SIDE }}
			>
				<Keyboard size={18} strokeWidth={1.9} />
			</span>
		</span>
	)
}

/** What you said, shown back above the mic while the pet answers. */
export function WordsChip({ words, className }: { words: string; className?: string }) {
	return (
		<span
			className={cn(
				'max-w-[78%] self-center rounded-pill border border-brand-border bg-surface2 px-[14px] py-[7px] text-ink-secondary',
				className
			)}
			style={type('bodySm')}
		>
			{words}
		</span>
	)
}

/** The pet's speech bubble: the corner nearest the pet is its tail. */
export function PetBubble({ line, className }: { line: string; className?: string }) {
	return (
		<span
			className={cn(
				'flex max-w-[220px] rounded-card rounded-bl-[6px] border border-line-hairline bg-surface2 px-[16px] py-[14px] shadow-card',
				className
			)}
		>
			<span style={type('body')}>{line}</span>
		</span>
	)
}
