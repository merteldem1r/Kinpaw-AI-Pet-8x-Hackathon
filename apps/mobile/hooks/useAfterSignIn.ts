import { useCallback, useEffect, useState } from 'react'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import type { Burst } from '@/lib/petEffects'
import { usePetDraft } from '@/contexts/PetDraftContext'
import { fetchPet, PET_QUERY_KEY, useSavePet } from '@/hooks/usePet'
import { createStepRoute } from '@/lib/createFlow'
import { haptic } from '@/lib/haptics'
import type { PetDraft } from '@/lib/petDraft'
import { GOING_HOME_LINE_MS, type AfterSignIn } from '@/lib/signIn'
import { sleep } from '@/lib/utils'

// After the code is right (m4-save-your-pet-requirements.md): save the pet being made, or for
// Welcome back find the account's pet, or start one. Success moves the root layout to My pet,
// which drops the sign-in screen; a failure stays here with "Try again".

/**
 * The "going home" moment: a successful save or find stays on screen at least this long before
 * My pet appears, so it lands instead of flashing past. A failure is never held.
 */
export const GOING_HOME_MS = 1400

/** `saving`: the draft this visit saves; null for Welcome back. */
export function useAfterSignIn(saving: PetDraft | null) {
	const queryClient = useQueryClient()
	const savePet = useSavePet()
	const { draft, start, clear } = usePetDraft()
	const [after, setAfter] = useState<AfterSignIn>('none')
	// While going home: which line the pet is on, and the hearts it sends up.
	const [tick, setTick] = useState(0)
	const [hearts, setHearts] = useState<Burst[]>([])
	const goingHome = after === 'saving' || after === 'finding'

	useEffect(() => {
		if (!goingHome) return
		setTick(0)
		const t = setInterval(() => setTick((n) => n + 1), GOING_HOME_LINE_MS)
		return () => clearInterval(t)
	}, [goingHome])

	// Save: send the draft. A failure keeps the draft for "Try again".
	const saveDraft = useCallback(async () => {
		if (!saving) return
		setAfter('saving')
		setHearts([{ id: Date.now(), kind: 'pet', species: saving.species }])
		try {
			await savePet(saving, { holdMs: GOING_HOME_MS })
		} catch {
			haptic.warning()
			setAfter('save_failed')
		}
	}, [savePet, saving])

	// Welcome back: the root layout moves on once the account's pet is in the cache; with none,
	// Create starts (or resumes), signed in.
	const findPet = useCallback(async () => {
		setAfter('finding')
		const started = Date.now()
		try {
			const pet = await fetchPet()
			if (pet) {
				// The account's pet wins over anything half-made on this phone.
				if (draft) clear()
				await sleep(Math.max(0, GOING_HOME_MS - (Date.now() - started)))
				queryClient.setQueryData(PET_QUERY_KEY, pet)
				return
			}
			const next = draft ?? start()
			router.replace(createStepRoute(next.step))
		} catch {
			haptic.warning()
			setAfter('find_failed')
		}
	}, [clear, draft, queryClient, start])

	/** Signed in, or "Try again" after a failure: the same next step either way. */
	const signedIn = useCallback(() => {
		if (saving) void saveDraft()
		else void findPet()
	}, [findPet, saveDraft, saving])

	return { after, tick, hearts, signedIn }
}
