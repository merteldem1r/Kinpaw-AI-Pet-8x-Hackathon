import AsyncStorage from '@react-native-async-storage/async-storage'
import { localDayNow } from '@/lib/timeZone'

// What this phone remembers about photos (docs/application/features/v2-pet-from-photo-
// requirements.md): whether today's redo is used (R26), a hint for Change look's "1 left today" or
// "Used today" (the server counts redos by account and decides); and whether the person allowed
// their photos to go to the AI service (Apple 5.1.2(i)).

const KEY = 'kinpaw:photoRedoDay'

/** True when the server said today's redo is used. Never throws. */
export async function redoUsedToday(): Promise<boolean> {
	try {
		return (await AsyncStorage.getItem(KEY)) === localDayNow()
	} catch {
		return false
	}
}

/** Remember that today's redo is used. */
export async function markRedoUsed(): Promise<void> {
	try {
		await AsyncStorage.setItem(KEY, localDayNow())
	} catch {
		// A hint only: the server still refuses a second redo today.
	}
}

// ── Permission to send a photo to the AI (Apple 5.1.2(i)) ───────────────────

const CONSENT_KEY = 'kinpaw:photoAiConsent'

/** Whether the person said yes to sending their photos to the AI service. Never throws. */
export async function hasPhotoAiConsent(): Promise<boolean> {
	try {
		return (await AsyncStorage.getItem(CONSENT_KEY)) === 'yes'
	} catch {
		return false
	}
}

/** Remember the yes, so it is asked once per phone. */
export async function savePhotoAiConsent(): Promise<void> {
	try {
		await AsyncStorage.setItem(CONSENT_KEY, 'yes')
	} catch {
		// Asked again next time: never sent without a yes.
	}
}
