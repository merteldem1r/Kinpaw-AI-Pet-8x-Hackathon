'use client'

import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import {
	DEFAULT_LOOK,
	DEFAULT_PRESET,
	PRESETS,
	SPECIES,
	lookById,
	type PresetId,
	type Species
} from '@app/contract'
import { cn } from '@/lib/utils'
import { gaEvent } from '@/lib/analytics/client'
import { WEEK_EVENTS } from '@/lib/analytics/events'
import { playClip, stopClip } from '@/lib/clips'
import { HELLO_LINES, helloClip, voiceId } from '@/lib/pet-lines'
import { LivePet } from '../pet/LivePet'
import { Bubble, SoundBars, Stand } from './stage'

const SPECIES_LABEL: Record<Species, string> = { cat: 'Cat', dog: 'Dog' }

/**
 * Day 2: the eight voices. A cat or a dog, in one of four personalities, each
 * saying its own line in the recording the app ships (public/voice, copied from
 * apps/mobile/assets/voice). Sound only ever starts from a tap here.
 */
export function Voices() {
	const [species, setSpecies] = useState<Species>('cat')
	const [preset, setPreset] = useState<PresetId>(DEFAULT_PRESET)
	const [isPlaying, setIsPlaying] = useState(false)
	const pet = lookById(DEFAULT_LOOK[species])

	// Leaving the page mid-line stops the line.
	useEffect(() => stopClip, [])

	const play = (next: PresetId) => {
		setPreset(next)
		setIsPlaying(true)
		gaEvent(WEEK_EVENTS.voiceSamplePlayed, { voice: voiceId(species, next) })
		playClip(helloClip(species, next), () => setIsPlaying(false))
	}

	const switchTo = (next: Species) => {
		stopClip()
		setSpecies(next)
	}

	return (
		<div>
			<Stand className="relative mx-auto w-fit">
				<Bubble
					key={`${species}-${preset}`}
					className="bubble-in absolute bottom-[78%] left-[60%] z-10 w-max max-w-[37vw] sm:max-w-[250px]"
				>
					<span className="flex items-start gap-2.5">
						<SoundBars isPlaying={isPlaying} className="mt-0.5 shrink-0 text-brand-ink" />
						{HELLO_LINES[preset]}
					</span>
				</Bubble>
				<LivePet
					appearance={pet.appearance}
					mood={isPlaying ? 'happy' : 'content'}
					label={`${pet.name}, a ${species}`}
					sizeClassName="scene-pet"
				/>
			</Stand>

			<div className="mt-8 flex justify-center">
				<div
					role="radiogroup"
					aria-label="Whose voice"
					className="flex rounded-pill border border-line-soft bg-surface2 p-1 shadow-soft"
				>
					{SPECIES.map((s) => (
						<button
							key={s}
							type="button"
							role="radio"
							aria-checked={s === species}
							onClick={() => switchTo(s)}
							className="h-10 min-w-20 rounded-pill px-5 text-sm font-semibold text-ink-secondary transition-colors duration-fast aria-checked:bg-ink aria-checked:text-ink-inverse"
						>
							{SPECIES_LABEL[s]}
						</button>
					))}
				</div>
			</div>

			{/* One instrument, four keys: joined, so it reads as a control and not as cards. */}
			<ul className="stagger mt-4 grid overflow-hidden rounded-card border border-line-soft bg-surface shadow-card sm:grid-cols-2 lg:grid-cols-4">
				{PRESETS.map((p) => {
					const isCurrent = p.id === preset
					return (
						<li
							key={p.id}
							className="border-line-hairline max-sm:border-t max-sm:first:border-t-0 sm:max-lg:odd:border-r lg:border-l lg:first:border-l-0 sm:max-lg:[&:nth-child(n+3)]:border-t"
						>
							<button
								type="button"
								onClick={() => play(p.id)}
								aria-label={`Hear the ${p.title.toLowerCase()} ${species}`}
								className={cn(
									'group flex h-full w-full items-start gap-3 p-4 text-left transition-colors duration-fast sm:p-5',
									isCurrent ? 'bg-brand-dim' : 'hover:bg-surface2'
								)}
							>
								<span
									aria-hidden="true"
									className={cn(
										'grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-fast',
										isCurrent
											? 'bg-brand text-on-brand'
											: 'bg-surface2 text-ink group-hover:bg-surface3'
									)}
								>
									{isCurrent && isPlaying ? (
										<SoundBars isPlaying />
									) : (
										<Play className="ml-0.5 h-4 w-4" fill="currentColor" strokeWidth={0} />
									)}
								</span>
								<span>
									<span className="block text-[15px] font-semibold text-ink">{p.title}</span>
									<span className="mt-0.5 block text-sm leading-snug text-ink-secondary">
										{p.description}
									</span>
								</span>
							</button>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
