import AsyncStorage from '@react-native-async-storage/async-storage'
import { normalizeFriendCode } from '@app/contract'
import { log } from '@/lib/logger'

// A friend link that arrived before there was a pet to add a friend with (docs/application/
// features/v2-friends-requirements.md, R10): signed out, or still creating one. Kept on the phone,
// one code at a time, for a day; the add screen opens with it once the pet is saved and Home has
// shown. Signing out drops it. Never throws: a lost code only means scanning again.

const KEY = 'kinpaw:pendingFriendCode:v1'
/** How long a pending code waits: a day. */
const PENDING_MS = 24 * 60 * 60 * 1000

type Stored = { code: string; at: number }

/** Keep the code from an incoming friend link, replacing any older one. */
export async function savePendingFriendCode(code: string, now = Date.now()): Promise<void> {
	try {
		await AsyncStorage.setItem(KEY, JSON.stringify({ code, at: now } satisfies Stored))
	} catch (error) {
		log.warn('pending friend code not saved', { error })
	}
}

/** The waiting code, if one is there and less than a day old; cleared either way. */
export async function takePendingFriendCode(now = Date.now()): Promise<string | null> {
	try {
		const raw = await AsyncStorage.getItem(KEY)
		if (!raw) return null
		await AsyncStorage.removeItem(KEY)
		const stored = JSON.parse(raw) as Partial<Stored>
		if (typeof stored.code !== 'string' || typeof stored.at !== 'number') return null
		if (now - stored.at > PENDING_MS) return null
		return normalizeFriendCode(stored.code)
	} catch (error) {
		log.warn('pending friend code not read', { error })
		return null
	}
}

export async function clearPendingFriendCode(): Promise<void> {
	try {
		await AsyncStorage.removeItem(KEY)
	} catch (error) {
		log.warn('pending friend code not cleared', { error })
	}
}

/** The code in an incoming friend link (`cozypet://friends/add?code=…`), or null for any other path. */
export function friendCodeInPath(path: string): string | null {
	const match = /(?:^|\/)friends\/add\/?\?(?:[^#]*&)?code=([^&#]+)/.exec(path)
	if (!match?.[1]) return null
	try {
		return normalizeFriendCode(decodeURIComponent(match[1]))
	} catch {
		return null
	}
}
