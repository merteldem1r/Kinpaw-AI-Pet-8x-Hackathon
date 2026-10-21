import { useEffect } from 'react'
import { AppState } from 'react-native'
import { router } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import type { Pet } from '@app/contract'
import { PET_QUERY_KEY } from '@/hooks/usePet'
import { PROFILE_QUERY_KEY, type UserProfile } from '@/hooks/useProfile'
import { track } from '@/lib/analytics'
import { cancelNudges, nudgeData, rememberOpenedNudge, scheduleNudges } from '@/lib/notifications'

// Each tapped note is handled once, even when the last response is read again after a restart.
const handled = new Set<string>()

/**
 * The pet's daily notes, for a signed-in person with a pet (docs/application/features/
 * v2-notifications-requirements.md, R8, R16): leaving the app schedules them from the needs the
 * app already holds (no request), coming back cancels them, and a tapped note opens Home.
 */
export function useNudges(active: boolean) {
	const queryClient = useQueryClient()

	useEffect(() => {
		if (!active) return
		// Launched or signed in with notes still pending: they are about a visit that is now over.
		void cancelNudges()
		const subscription = AppState.addEventListener('change', (state) => {
			if (state === 'active') {
				void cancelNudges()
				return
			}
			if (state !== 'background') return
			const pet = queryClient.getQueryData<Pet | null>(PET_QUERY_KEY)
			if (!pet) return
			const profile = queryClient.getQueryData<UserProfile>(PROFILE_QUERY_KEY)
			void scheduleNudges(pet, profile?.displayName ?? null)
		})
		return () => subscription.remove()
	}, [active, queryClient])

	const response = Notifications.useLastNotificationResponse()
	useEffect(() => {
		if (!active || !response) return
		const { request, date } = response.notification
		const key = `${request.identifier}:${date}`
		if (handled.has(key)) return
		handled.add(key)
		const data = nudgeData(request.content.data)
		if (!data) return
		track('notification_tapped', { day: data.day, need: data.need })
		rememberOpenedNudge(data)
		// A cold start already lands on Home; from another screen, go there. Before the navigator
		// is ready (the first frames of a cold start) there is nowhere else to be.
		try {
			router.navigate('/(tabs)')
		} catch {
			// Home is the first screen with a pet.
		}
	}, [active, response])
}
