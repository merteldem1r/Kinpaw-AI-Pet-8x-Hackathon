'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Dices, Plus, Volume2 } from 'lucide-react'
import { art } from '@app/brand'
import {
	BUILDER_TABS,
	PET_NAME_MAX,
	PRESETS,
	SPECIES,
	attributesIn,
	optionsFor,
	randomAppearance,
	withAttribute,
	withSpecies,
	type AttributeKey,
	type AttributeOption,
	type BuilderTab,
	type EyeId,
	type FurId,
	type PetAppearance,
	type Species
} from '@app/contract'
import { gaEvent } from '@/lib/analytics/client'
import { WEEK_EVENTS } from '@/lib/analytics/events'
import { playClip, stopClip } from '@/lib/clips'
import { helloClip, voiceId } from '@/lib/pet-lines'
import { LivePet } from '../pet/LivePet'
import { usePetDraft } from './PetDraft'
import { SoundBars } from './stage'

const SPECIES_LABEL: Record<Species, string> = { cat: 'Cat', dog: 'Dog' }

/** A colour option's paint, from the pet's own art; null where it has none ("Matching"). */
function paintOf(key: AttributeKey, id: string): string | null {
	if (key === 'eyes') {
		if (id === 'odd') {
			return `linear-gradient(90deg, ${art.pet.eyes.blue} 50%, ${art.pet.eyes.amber} 50%)`
		}
		return art.pet.eyes[id as Exclude<EyeId, 'odd'>]
	}
	if (id === 'auto') return null
	if (id === 'white') return art.pet.white
	return art.pet.fur[id as FurId].base
}

/**
 * The app's pet builder, on the page: the same catalogue (@app/contract) and
 * the same drawing code (@app/brand), so what a visitor makes here is what the
 * app would draw. Plus options are marked and can be tried. The pet and its
 * name stay in this page view (PetDraft): the closing scene draws the pet, and
 * the last waitlist button carries the name.
 */
export function MakeYours() {
	const draft = usePetDraft()
	const [tab, setTab] = useState<BuilderTab>('fur')
	const [isSpeaking, setIsSpeaking] = useState(false)
	const hasCounted = useRef(false)
	const nameId = useId()
	const panelId = useId()

	useEffect(() => stopClip, [])

	if (!draft) return null
	const { appearance, setAppearance, preset, setPreset, name, setName } = draft
	const { species } = appearance

	const change = (next: PetAppearance) => {
		setAppearance(next)
		if (hasCounted.current) return
		hasCounted.current = true
		gaEvent(WEEK_EVENTS.petBuilderUsed, { species: next.species })
	}

	const hear = () => {
		setIsSpeaking(true)
		gaEvent(WEEK_EVENTS.voiceSamplePlayed, { voice: voiceId(species, preset) })
		playClip(helloClip(species, preset), () => setIsSpeaking(false))
	}

	return (
		<div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
			<div className="flex min-w-0 flex-col items-center">
				<LivePet
					appearance={appearance}
					mood={isSpeaking ? 'happy' : 'content'}
					label={`${name.trim() || 'Your pet'}, as you have made it`}
					sizeClassName="h-[min(72vw,340px)] w-[min(72vw,340px)]"
				/>
				<div className="mt-4 w-full max-w-[22rem]">
					<label htmlFor={nameId} className="text-sm font-medium text-ink-secondary">
						Its name
					</label>
					<input
						id={nameId}
						type="text"
						value={name}
						maxLength={PET_NAME_MAX}
						autoComplete="off"
						onChange={(e) => setName(e.target.value)}
						placeholder="Mochi, Biscuit, Sir Naps-a-lot"
						className="mt-2 h-[52px] w-full rounded-input border border-line-soft bg-well px-4 text-ink transition-colors duration-fast focus-visible:border-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
					/>
				</div>
				<div className="mt-4 flex flex-wrap justify-center gap-2.5">
					<button
						type="button"
						onClick={() => change(randomAppearance(species, { includePremium: true }))}
						className="inline-flex h-11 items-center gap-2 rounded-pill border border-line-active px-4 text-sm font-semibold text-ink transition-[transform,background-color] duration-fast hover:bg-surface2 active:scale-[0.96]"
					>
						<Dices aria-hidden="true" className="h-4 w-4" />
						Surprise me
					</button>
					<button
						type="button"
						onClick={hear}
						className="inline-flex h-11 items-center gap-2 rounded-pill border border-line-active px-4 text-sm font-semibold text-ink transition-[transform,background-color] duration-fast hover:bg-surface2 active:scale-[0.96]"
					>
						{isSpeaking ? (
							<SoundBars isPlaying className="text-brand-ink" />
						) : (
							<Volume2 aria-hidden="true" className="h-4 w-4" />
						)}
						Hear its voice
					</button>
				</div>
			</div>

			<div className="min-w-0">
				<div className="flex flex-wrap items-center gap-3">
					<div
						role="radiogroup"
						aria-label="Cat or dog"
						className="flex rounded-pill border border-line-soft bg-well p-1"
					>
						{SPECIES.map((s) => (
							<button
								key={s}
								type="button"
								role="radio"
								aria-checked={s === species}
								onClick={() => change(withSpecies(appearance, s))}
								className="h-10 min-w-[4.5rem] rounded-pill px-4 text-sm font-semibold text-ink-secondary transition-colors duration-fast aria-checked:bg-surface3 aria-checked:text-ink"
							>
								{SPECIES_LABEL[s]}
							</button>
						))}
					</div>
					<div role="radiogroup" aria-label="Personality" className="flex flex-wrap gap-1.5">
						{PRESETS.map((p) => (
							<button
								key={p.id}
								type="button"
								role="radio"
								aria-checked={p.id === preset}
								title={p.description}
								onClick={() => setPreset(p.id)}
								className="h-10 rounded-pill border border-line-soft px-3.5 text-sm font-medium text-ink-secondary transition-colors duration-fast hover:text-ink aria-checked:border-brand-border aria-checked:bg-brand-dim aria-checked:text-brand-ink"
							>
								{p.title.split(' ')[0]}
							</button>
						))}
					</div>
				</div>

				<div
					role="tablist"
					aria-label="What to change"
					className="mt-6 flex gap-1 overflow-x-auto border-b border-line-hairline"
				>
					{BUILDER_TABS.map((t) => (
						<button
							key={t.key}
							type="button"
							role="tab"
							aria-selected={t.tab === tab}
							aria-controls={panelId}
							onClick={() => setTab(t.tab)}
							className="-mb-px h-11 shrink-0 border-b-2 border-transparent px-3.5 text-[15px] font-semibold text-ink-secondary transition-colors duration-fast hover:text-ink aria-selected:border-brand-ink aria-selected:text-ink"
						>
							{t.label}
						</button>
					))}
				</div>

				<div id={panelId} role="tabpanel" className="min-h-[15rem] space-y-6 pt-6">
					{attributesIn(tab).map((attribute) => (
						<fieldset key={attribute.key}>
							<legend className="text-sm font-medium text-ink-secondary">{attribute.title}</legend>
							<div className="mt-3 flex flex-wrap gap-2.5">
								{optionsFor(attribute.key, species).map((option) => (
									<Option
										key={option.id}
										option={option}
										paint={
											attribute.display === 'swatch' ? paintOf(attribute.key, option.id) : null
										}
										isChosen={appearance[attribute.key] === option.id}
										onChoose={() => change(withAttribute(appearance, attribute.key, option.id))}
									/>
								))}
							</div>
						</fieldset>
					))}
				</div>
			</div>
		</div>
	)
}

/** One choice: a colour as a swatch, anything else as a chip. Plus options say so. */
function Option({
	option,
	paint,
	isChosen,
	onChoose
}: {
	option: AttributeOption
	paint: string | null
	isChosen: boolean
	onChoose: () => void
}) {
	if (paint) {
		return (
			<button
				type="button"
				aria-pressed={isChosen}
				aria-label={option.premium ? `${option.label}, a Plus colour` : option.label}
				title={option.label}
				onClick={onChoose}
				className="relative grid h-11 w-11 place-items-center rounded-full border border-line-soft transition-transform duration-fast active:scale-[0.92] aria-pressed:border-2 aria-pressed:border-brand-ink"
			>
				<span
					aria-hidden="true"
					className="h-8 w-8 rounded-full border border-line-hairline"
					style={{ background: paint }}
				/>
				{option.premium && <PlusDot />}
			</button>
		)
	}
	return (
		<button
			type="button"
			aria-pressed={isChosen}
			onClick={onChoose}
			className="relative h-11 rounded-pill border border-line-soft px-4 text-sm font-medium text-ink-secondary transition-[transform,color,background-color] duration-fast hover:text-ink active:scale-[0.96] aria-pressed:border-brand-border aria-pressed:bg-brand-dim aria-pressed:text-brand-ink"
		>
			{option.label}
			{option.premium && <span className="sr-only">, a Plus option</span>}
			{option.premium && <PlusDot />}
		</button>
	)
}

/** The mark on a Kinpaw Plus option: a small amber "+" on its corner. */
function PlusDot() {
	return (
		<span
			aria-hidden="true"
			className="absolute -right-1 -top-1 grid h-[18px] w-[18px] place-items-center rounded-full bg-brand text-on-brand"
		>
			<Plus className="h-3 w-3" strokeWidth={3.2} />
		</span>
	)
}
