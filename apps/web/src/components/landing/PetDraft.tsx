'use client'

import { createContext, useContext, useMemo, useState } from 'react'
import {
	DEFAULT_LOOK,
	DEFAULT_PRESET,
	lookById,
	type PetAppearance,
	type PresetId
} from '@app/contract'

/*
 * The pet a visitor makes in "Make yours", kept for this page view only. The
 * closing scene draws it asleep and the last waitlist button carries its name.
 * Nothing here is stored or sent: the name never leaves the page.
 */
type PetDraft = {
	appearance: PetAppearance
	setAppearance: (appearance: PetAppearance) => void
	preset: PresetId
	setPreset: (preset: PresetId) => void
	/** Empty until the visitor types one. */
	name: string
	setName: (name: string) => void
}

const PetDraftContext = createContext<PetDraft | null>(null)

export function PetDraftProvider({ children }: { children: React.ReactNode }) {
	const [appearance, setAppearance] = useState<PetAppearance>(
		() => lookById(DEFAULT_LOOK.cat).appearance
	)
	const [preset, setPreset] = useState<PresetId>(DEFAULT_PRESET)
	const [name, setName] = useState('')
	const draft = useMemo(
		() => ({ appearance, setAppearance, preset, setPreset, name, setName }),
		[appearance, preset, name]
	)
	return <PetDraftContext.Provider value={draft}>{children}</PetDraftContext.Provider>
}

/** The visitor's pet, or null on a page that has no builder (pricing, support). */
export function usePetDraft(): PetDraft | null {
	return useContext(PetDraftContext)
}
