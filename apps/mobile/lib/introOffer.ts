import { useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Pet } from '@app/contract'
import { log } from '@/lib/logger'

// When "Tell me about you" opens by itself (docs/application/UI/kinpaw-screen-spec-v1.md, "Tell
// me about you (v2)", Entry points). Right after a pet is saved, it covers everything at once. A pet from
// before the intro is offered it once, in Home's bubble; the phone remembers that offer for that
// pet (decision 10: a reinstall offers it once more; another account's pet on the same phone is
// offered it too). Whether the step is still open is the server's (`intro_due`).

/**
 * The pet this session just saved, while "Tell me about you" shows before Home (Mert,
 * 2026-10-04: straight after the email code, not after a glimpse of Home). The root layout shows
 * the intro over everything while it is set, and only puts the pet in the cache, which is what
 * opens Home, when the intro ends. Not a navigation (one was lost while the app switched from
 * sign-in to Home) and not a Modal (closing it crashed the app on Mert's iPhone).
 */
let afterSave: Pet | null = null
const listeners = new Set<() => void>()
const setAfterSave = (pet: Pet | null) => {
	if (afterSave === pet) return
	afterSave = pet
	listeners.forEach((listener) => listener())
}

/** A new pet was saved: the intro first. */
export function markPetJustSaved(pet: Pet) {
	setAfterSave(pet)
}

/** The intro after saving is over (or the person signed out): the pet it was for, if any. */
export function endIntroAfterSave(): Pet | null {
	const pet = afterSave
	setAfterSave(null)
	return pet
}

/** The pet whose intro is showing before Home, or null. */
export function useIntroAfterSave(): Pet | null {
	return useSyncExternalStore(
		(listener) => {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
		() => afterSave
	)
}

/** One key per pet: a second account's pet on this phone is offered it too (Mert, 2026-10-04). */
const offeredKey = (petId: string) => `kinpaw:introOffered:v2:${petId}`

/** Whether Home has offered this pet the intro on this phone. Unreadable storage counts as offered. */
export async function introOffered(petId: string): Promise<boolean> {
	try {
		return (await AsyncStorage.getItem(offeredKey(petId))) !== null
	} catch (error) {
		log.warn('intro offer not read', { error })
		return true
	}
}

export async function markIntroOffered(petId: string): Promise<void> {
	try {
		await AsyncStorage.setItem(offeredKey(petId), new Date().toISOString())
	} catch (error) {
		log.warn('intro offer not saved', { error })
	}
}
