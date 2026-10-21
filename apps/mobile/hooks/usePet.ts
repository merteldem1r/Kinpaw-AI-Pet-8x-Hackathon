import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Pet } from '@app/contract'
import { usePetDraftActions } from '@/contexts/PetDraftContext'
import { useToast } from '@/contexts/ToastContext'
import { track } from '@/lib/analytics'
import { api, errorCode } from '@/lib/api'
import { markPetJustSaved } from '@/lib/introOffer'
import { draftAppearance, draftLookId, type PetDraft } from '@/lib/petDraft'
import { sleep } from '@/lib/utils'

// The signed-in person's pet, through /api/app/v1/pet (docs/application/features/
// m4-save-your-pet-requirements.md). The root layout reads it to decide where a signed-in
// person belongs: a pet → the tabs; none → saving the draft, or Create.

export const PET_QUERY_KEY = ['pet'] as const

/** GET /api/app/v1/pet: the pet, or null before one is saved. Throws on any failure. */
export async function fetchPet({ signal }: { signal?: AbortSignal } = {}): Promise<Pet | null> {
	return (await api('getPet', { signal })).pet
}

/** The pet, or null before one is saved. Only while signed in. */
export function usePet(enabled = true) {
	return useQuery<Pet | null>({ queryKey: PET_QUERY_KEY, queryFn: fetchPet, enabled })
}

export type SavePetOutcome = { pet: Pet; existing: boolean }

/**
 * Saves the draft to the account, then clears it. On success the pet goes into the query
 * cache (a new pet only after "Tell me about you", lib/introOffer.ts), which is what moves the
 * root layout to the tabs (and drops Create and sign-in from
 * the stack, so Back can't return to them). A failure throws the API's error and keeps the
 * draft, so "Try again" sends the same pet (same id) again.
 *
 * If the account already had a pet, that one wins: the draft is dropped and the person is
 * told once.
 *
 * `holdMs` keeps a success on screen at least that long before the pet lands in the cache (the
 * sign-in screen's "going home" moment); a failure is never held.
 */
export function useSavePet() {
	const queryClient = useQueryClient()
	const { clear } = usePetDraftActions()
	const { showToast } = useToast()

	return useCallback(
		async (draft: PetDraft, { holdMs = 0 }: { holdMs?: number } = {}): Promise<SavePetOutcome> => {
			try {
				const [{ pet, existing }] = await Promise.all([
					api('createPet', {
						body: {
							id: draft.id,
							appearance: draftAppearance(draft),
							look_id: draftLookId(draft),
							name: draft.name,
							preset: draft.preset,
							traits: draft.traits
						}
					}),
					sleep(holdMs)
				])
				clear()
				if (existing) {
					showToast(`You already have ${pet.name}. They're right here.`, 'info')
					queryClient.setQueryData(PET_QUERY_KEY, pet)
				} else {
					// A new pet: "Tell me about you" first (v2 memory, R18). The root layout shows it and
					// puts the pet in the cache (which opens Home) when it ends.
					markPetJustSaved(pet)
				}
				return { pet, existing }
			} catch (error) {
				track('pet_save_failed', { error_kind: errorCode(error) ?? 'unknown' })
				throw error
			}
		},
		[clear, queryClient, showToast]
	)
}
