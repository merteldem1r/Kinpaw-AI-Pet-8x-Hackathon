import * as SecureStore from 'expo-secure-store'
import { PHOTO_TRIES_SIGNED_OUT } from '@app/contract'
import { newId } from '@/lib/ids'
import { log } from '@/lib/logger'

// This iPhone's install id and its photo tries (docs/application/features/v2-pet-from-photo-
// requirements.md, R16, R19). Both live in the Keychain, which iOS keeps when the app is deleted,
// so reinstalling doesn't hand out two more tries. The server is the authority on tries (it
// counts by a hash of this id); the number here is a hint, so Start can show "Used" before asking.

const INSTALL_ID = 'kinpaw.installId'
const TRIES_LEFT = 'kinpaw.photoTriesLeft'
/** Readable after the first unlock, so it never fails while the app wakes in the background. */
const OPTIONS: SecureStore.SecureStoreOptions = {
	keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK
}

let installId: string | null = null

/** This phone's install id, made once and kept in the Keychain. Never throws. */
export async function getInstallId(): Promise<string> {
	if (installId) return installId
	try {
		installId = await SecureStore.getItemAsync(INSTALL_ID, OPTIONS)
		if (!installId) {
			installId = newId()
			await SecureStore.setItemAsync(INSTALL_ID, installId, OPTIONS)
		}
	} catch (error) {
		// Without the Keychain this launch still works; the server still counts by network.
		log.warn('Could not keep the install id in the Keychain', { error })
		installId ??= newId()
	}
	return installId
}

/** The photo tries this phone has left, as last told by the server. */
export async function photoTriesLeft(): Promise<number> {
	try {
		const stored = await SecureStore.getItemAsync(TRIES_LEFT, OPTIONS)
		const left = stored === null ? PHOTO_TRIES_SIGNED_OUT : Number.parseInt(stored, 10)
		return Number.isInteger(left) && left >= 0 ? left : PHOTO_TRIES_SIGNED_OUT
	} catch {
		return PHOTO_TRIES_SIGNED_OUT
	}
}

/** Keep what the server said is left. */
export async function savePhotoTriesLeft(left: number): Promise<void> {
	try {
		await SecureStore.setItemAsync(TRIES_LEFT, String(left), OPTIONS)
	} catch (error) {
		log.warn('Could not keep the photo tries left', { error })
	}
}

/**
 * DEV ONLY, TEMPORARY (2026-10-06, Mert; delete with its button on Start): a fresh install id and
 * the tries hint cleared, so this phone gets the signed-out photo tries again. The server counts
 * tries by a hash of the install id, so a new id is a new phone to it; nothing on the server
 * changes. The per-network daily limit still applies.
 */
export async function resetPhotoTriesForDev(): Promise<void> {
	if (!__DEV__) return
	installId = newId()
	try {
		await SecureStore.setItemAsync(INSTALL_ID, installId, OPTIONS)
		await SecureStore.deleteItemAsync(TRIES_LEFT, OPTIONS)
	} catch (error) {
		log.warn('Could not reset the photo tries', { error })
	}
}
