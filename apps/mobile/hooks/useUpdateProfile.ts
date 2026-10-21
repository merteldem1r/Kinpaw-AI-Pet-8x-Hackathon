import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdateProfileBody } from '@app/contract'
import { PROFILE_QUERY_KEY, toUserProfile } from '@/hooks/useProfile'
import { api } from '@/lib/api'

// Saves the person's own name and photo through PATCH /api/app/v1/profile
// (docs/application/features/profile-edit-requirements.md, R7, R9). The answer is the whole
// profile as it now is, so it replaces the cached one and no second request is needed. The
// plan is never sent: the contract refuses it (AGENTS.md, non-negotiable 3).

export function useUpdateProfile() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (body: UpdateProfileBody) => api('updateProfile', { body }),
		onSuccess: ({ profile }) => {
			queryClient.setQueryData(PROFILE_QUERY_KEY, toUserProfile(profile))
		}
	})
}
