import { useCallback, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
	applyAction,
	decayNeeds,
	moodFor,
	wholeNeeds,
	type Needs,
	type Pet,
	type PetAction
} from '@app/contract'
import { PET_QUERY_KEY } from '@/hooks/usePet'
import { track } from '@/lib/analytics'
import { api, errorCode } from '@/lib/api'
import { deviceTimeZone } from '@/lib/timeZone'

// Feed, Play and Pet (docs/application/features/m5-home-core-loop-requirements.md, R9–R10).
// The needs change on screen at once; the server then applies the same rules and its answer
// is the truth. Requests go one at a time, in order (one mutation scope), so the server sees
// the taps as they were made. Only the answer to the last request in flight is written back:
// any earlier one would briefly undo the taps still on their way, and the last one already
// includes them. A failure refetches the pet, so the screen returns to what the server holds,
// rather than to a snapshot that could undo a tap that did land.

export type ActionOutcome = {
	/** Whether any need rises (or falls) on screen. False: the action can't help. */
	changed: boolean
	/** The needs either side of the tap, as shown (whole numbers), for the on-screen effects. */
	before: Needs
	after: Needs
}

function storedNeeds(pet: Pet, now: Date): Needs {
	const { updated_at, ...stored } = pet.needs
	return decayNeeds(stored, new Date(updated_at), now, deviceTimeZone())
}

/** Every care request carries this key, so a screen can tell one is on its way. */
export const PET_ACTION_KEY = ['pet-action'] as const

type Variables = { action: PetAction; before: Needs; suggested: boolean }

export function usePetAction(callbacks: {
	onFailed: (action: PetAction) => void
	/** The server confirmed a care action (the notes ask waits for this: v2-notifications R13). */
	onConfirmed?: (action: PetAction) => void
}) {
	const queryClient = useQueryClient()
	const inFlight = useRef(0)
	// The latest callbacks, read when a request settles (the mutation keeps its first options).
	const latest = useRef(callbacks)
	latest.current = callbacks

	// Callbacks live here, not on mutate(): TanStack runs mutate()'s own callbacks only for the
	// most recent call, and every tap needs its answer handled.
	const { mutate } = useMutation({
		mutationKey: PET_ACTION_KEY,
		scope: { id: 'pet-action' },
		retry: false,
		mutationFn: ({ action }: Variables) =>
			api('petAction', { body: { action, time_zone: deviceTimeZone() } }),
		onSuccess: (result, { action, before, suggested }) => {
			if (inFlight.current === 1) queryClient.setQueryData(PET_QUERY_KEY, result.pet)
			track('pet_action_taken', {
				action,
				need_changed: result.changed,
				mood_before: moodFor(before),
				mood_after: moodFor(storedNeeds(result.pet, new Date())),
				suggested
			})
			latest.current.onConfirmed?.(action)
		},
		onError: (error, { action }) => {
			track('pet_action_failed', { action, error_kind: errorCode(error) ?? 'unknown' })
			void queryClient.invalidateQueries({ queryKey: PET_QUERY_KEY })
			latest.current.onFailed(action)
		},
		onSettled: () => {
			inFlight.current -= 1
		}
	})

	return useCallback(
		/** `suggested`: the pet's last reply suggested this action (its tile was glowing for it). */
		(action: PetAction, suggested = false): ActionOutcome | null => {
			const pet = queryClient.getQueryData<Pet | null>(PET_QUERY_KEY)
			if (!pet) return null
			const now = new Date()
			const before = storedNeeds(pet, now)
			const { needs, changed } = applyAction(before, action)
			// A background refetch (returning to the app) must not land over this tap.
			void queryClient.cancelQueries({ queryKey: PET_QUERY_KEY })
			const optimistic: Pet = { ...pet, needs: { ...needs, updated_at: now.toISOString() } }
			queryClient.setQueryData(PET_QUERY_KEY, optimistic)
			inFlight.current += 1
			mutate({ action, before, suggested })
			return { changed, before: wholeNeeds(before), after: wholeNeeds(needs) }
		},
		[mutate, queryClient]
	)
}
