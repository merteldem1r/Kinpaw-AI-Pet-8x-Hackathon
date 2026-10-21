import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { notesState, type NotesState } from '@/lib/notifications'

/**
 * Whether the pet's notes can reach this person, re-read whenever the screen shows and whenever
 * the app comes back, so a change made in iOS Settings shows at once (v2-notifications R15).
 * Null until first read. `set` shows a change before it is read back.
 */
export function useNotesState() {
	const [state, setState] = useState<NotesState | null>(null)
	const refresh = useCallback(() => {
		void notesState().then(setState)
	}, [])

	useFocusEffect(refresh)
	useEffect(() => {
		const subscription = AppState.addEventListener('change', (next) => {
			if (next === 'active') refresh()
		})
		return () => subscription.remove()
	}, [refresh])

	return { state, set: setState, refresh }
}
