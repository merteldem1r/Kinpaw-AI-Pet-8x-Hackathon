'use client'

import { LivePet } from '../pet/LivePet'
import { usePetDraft } from './PetDraft'
import { Stand } from './stage'

/** The pet from "Make yours", asleep at the end of the week; Mochi if none was made. */
export function ClosingPet() {
	const draft = usePetDraft()
	if (!draft) return null
	const name = draft.name.trim() || 'Mochi'
	return (
		<figure className="text-center">
			<Stand hasLamp>
				<LivePet
					appearance={draft.appearance}
					mood="sleepy"
					isLooking={false}
					label={`${name}, asleep`}
					sizeClassName="scene-pet"
				/>
			</Stand>
			<figcaption className="mt-3 font-display text-lg text-ink-secondary">
				{name} is asleep. It will be here.
			</figcaption>
		</figure>
	)
}
