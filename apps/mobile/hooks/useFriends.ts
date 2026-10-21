import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FriendAddSource, GetFriendsResponse } from '@app/contract'
import { api } from '@/lib/api'
import { deviceTimeZone } from '@/lib/timeZone'

// Friends (docs/application/features/v2-friends-requirements.md, R17–R21), through
// /api/app/v1/friends: the caller's code and their friends' pets. Every write refreshes the list,
// so the tab, a friend's page and My code always agree. Only while signed in with a pet.

const FRIENDS_QUERY_KEY = ['friends'] as const

/** The code and the friends, newest first. Refetched on focus and on return to the app. */
export function useFriends(enabled = true) {
	return useQuery<GetFriendsResponse>({
		queryKey: FRIENDS_QUERY_KEY,
		queryFn: ({ signal }) => api('getFriends', { query: { time_zone: deviceTimeZone() }, signal }),
		enabled
	})
}

/** Whose code this is, before adding: their pet and name. Writes nothing. */
export function useLookupFriend() {
	return useMutation({
		mutationFn: (code: string) =>
			api('lookupFriend', { body: { code, time_zone: deviceTimeZone() } })
	})
}

export function useAddFriend() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: ({ code, source }: { code: string; source: FriendAddSource }) =>
			api('addFriend', { body: { code, source, time_zone: deviceTimeZone() } }),
		onSettled: () => queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY })
	})
}

/** Ends a friendship for both; gone from the list at once, back if the server refuses. */
export function useRemoveFriend() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (id: string) => api('removeFriend', { params: { id } }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: FRIENDS_QUERY_KEY })
			const before = queryClient.getQueryData<GetFriendsResponse>(FRIENDS_QUERY_KEY)
			if (before) {
				queryClient.setQueryData<GetFriendsResponse>(FRIENDS_QUERY_KEY, {
					...before,
					friends: before.friends.filter((friend) => friend.id !== id)
				})
			}
			return { before }
		},
		onError: (_error, _id, context) => {
			if (context?.before) queryClient.setQueryData(FRIENDS_QUERY_KEY, context.before)
		},
		onSettled: () => queryClient.invalidateQueries({ queryKey: FRIENDS_QUERY_KEY })
	})
}

/** A new code; the old one stops working. The list's code is replaced in place. */
export function useResetFriendCode() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: () => api('resetFriendCode', { body: {} }),
		onSuccess: ({ code }) => {
			queryClient.setQueryData<GetFriendsResponse>(FRIENDS_QUERY_KEY, (data) =>
				data ? { ...data, code } : data
			)
		}
	})
}
