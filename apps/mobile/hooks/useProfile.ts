import { useQuery } from '@tanstack/react-query'
import type { Profile } from '@app/contract'
import { api } from '@/lib/api'
import { avatarCacheKey } from '@/lib/avatar'
import { onDevHost } from '@/lib/env'
import { getInitials } from '@/lib/utils'

// The signed-in person's own profile, through GET /api/app/v1/profile. `plan`
// is read-only: the server decides it (the RevenueCat webhook, or an admin grant;
// AGENTS.md, non-negotiable 3), and the app only ever shows it, through usePlus.

export interface UserProfile {
	fullName: string
	/** The name on the profile, for the Edit profile field; null when none is set. */
	displayName: string | null
	email: string
	initials: string
	planType: Profile['plan']
	/** A short-lived signed URL. Show it; never store it. */
	avatarUrl: string | null
	/** What the photo is cached under: its path, which outlives the URL's hourly token. */
	avatarKey: string | null
}

export function toUserProfile(profile: Profile): UserProfile {
	const email = profile.email ?? ''
	const displayName = profile.display_name?.trim() || null
	const fullName = displayName || email.split('@')[0] || 'You'
	const avatarUrl = profile.avatar_url ? onDevHost(profile.avatar_url) : null
	return {
		fullName,
		displayName,
		email,
		initials: getInitials(fullName),
		planType: profile.plan,
		avatarUrl,
		avatarKey: avatarCacheKey(profile.avatar_url)
	}
}

export const PROFILE_QUERY_KEY = ['profile'] as const

export function useProfile() {
	return useQuery<UserProfile>({
		queryKey: PROFILE_QUERY_KEY,
		// The plan decides Kinpaw Plus (usePlus): coming back to the app always re-reads it, so a
		// grant or a lapse shows up without a restart (M7, R6).
		refetchOnWindowFocus: 'always',
		queryFn: async ({ signal }) => toUserProfile((await api('getProfile', { signal })).profile)
	})
}
