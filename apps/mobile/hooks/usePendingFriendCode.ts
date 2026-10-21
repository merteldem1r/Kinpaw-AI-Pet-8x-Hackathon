import { useEffect } from 'react'
import { router, usePathname } from 'expo-router'
import { clearPendingFriendCode, takePendingFriendCode } from '@/lib/pendingFriendCode'

/**
 * Opens the add screen with a friend link's code that arrived before there was a pet
 * (docs/application/features/v2-friends-requirements.md, R10), once `ready`: signed in, the pet
 * saved, "Tell me about you" over. When the link itself already opened the add screen, the kept
 * copy is only dropped.
 */
export function usePendingFriendCode(ready: boolean) {
	const pathname = usePathname()
	const onAdd = pathname.startsWith('/friends/add')
	useEffect(() => {
		if (!ready) return
		if (onAdd) {
			void clearPendingFriendCode()
			return
		}
		let cancelled = false
		void takePendingFriendCode().then((code) => {
			if (cancelled || !code) return
			router.push({ pathname: '/friends/add', params: { code } })
		})
		return () => {
			cancelled = true
		}
	}, [ready, onAdd])
}
