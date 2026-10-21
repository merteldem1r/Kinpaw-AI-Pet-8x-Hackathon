/**
 * Every link that opens the app passes through here first (expo-router's native intent). A friend
 * link's code is kept on the phone (lib/pendingFriendCode.ts), because a person without a pet yet
 * can't reach the add screen: once their pet is saved and Home has shown, it opens with the code
 * (docs/application/features/v2-friends-requirements.md, R10). With a pet, the link goes straight
 * to the add screen, which drops the kept copy. The path itself is never changed.
 */
import { friendCodeInPath, savePendingFriendCode } from '@/lib/pendingFriendCode'

export async function redirectSystemPath({ path }: { path: string; initial: boolean }) {
	try {
		const code = friendCodeInPath(path)
		if (code) await savePendingFriendCode(code)
	} catch {
		// Never stand between a link and the app.
	}
	return path
}
