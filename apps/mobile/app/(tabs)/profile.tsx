/**
 * Profile — the second tab: who you are, Kinpaw Plus, and your pet
 * (docs/application/product.md, "Structure and scope"; the Plus panel is M7, R12).
 */
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { ChevronRight, Pencil } from 'lucide-react-native'
import { presetById } from '@app/contract'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { PressableScale } from '@/components/motion/PressableScale'
import { InlineQueryError } from '@/components/QueryError'
import { PetPortrait } from '@/components/pet/PetPortrait'
import { PlusPanel } from '@/components/plus/PlusPanel'
import { Card } from '@/components/ui/Card'
import { Section } from '@/components/ui/List'
import { Avatar } from '@/components/ui/Marks'
import { Screen } from '@/components/ui/Screen'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { usePet } from '@/hooks/usePet'
import { usePlus } from '@/hooks/usePlus'
import { useProfile } from '@/hooks/useProfile'
import { track } from '@/lib/analytics'
import { openPaywall } from '@/lib/openPaywall'

export default function ProfileScreen() {
	const profileQuery = useProfile()
	const profile = profileQuery.data
	const petQuery = usePet()
	const pet = petQuery.data
	const plus = usePlus()
	const { colors: c, radii, elevation } = useTheme()

	useEffect(() => {
		track('profile_viewed')
	}, [])

	return (
		<Screen tabs gap={26}>
			<FadeSlideIn index={0}>
				<Text variant="title" accessibilityRole="header">
					Profile
				</Text>
			</FadeSlideIn>

			<FadeSlideIn index={1}>
				{/* You: a button to Edit profile once the profile is here; plain while it loads or failed. */}
				<PressableScale
					disabled={!profile}
					onPress={() => router.push('/profile-edit')}
					haptic="select"
					scaleTo="card"
					style={[
						s.identity,
						elevation.card,
						{
							backgroundColor: c.surface2,
							borderColor: c.borderHairline,
							borderRadius: radii.card
						}
					]}
					accessibilityRole={profile ? 'button' : undefined}
					accessibilityLabel={profile ? `Edit profile, ${profile.fullName}` : undefined}
					accessibilityHint={profile ? 'Change your name and photo' : undefined}
				>
					<View>
						<Avatar
							initials={profile?.initials ?? '·'}
							uri={profile?.avatarUrl}
							cacheKey={profile?.avatarKey}
							size={AVATAR}
						/>
						{profile ? (
							<View style={[s.badge, { backgroundColor: c.brandFill, borderColor: c.surface2 }]}>
								<Pencil size={12} color={c.onBrand} strokeWidth={2.4} />
							</View>
						) : null}
					</View>
					<View style={s.who}>
						{profile ? (
							<>
								<Text variant="h3" numberOfLines={1}>
									{profile.fullName}
								</Text>
								<Text variant="bodySm" tone="secondary" numberOfLines={1}>
									{profile.email}
								</Text>
							</>
						) : profileQuery.isError ? (
							<InlineQueryError error={profileQuery.error} onRetry={() => profileQuery.refetch()} />
						) : (
							<>
								<Skeleton width="60%" height={22} />
								<Skeleton width="80%" height={14} />
							</>
						)}
					</View>
					{profile ? (
						<View style={[s.edit, { backgroundColor: c.brandDim, borderColor: c.brandBorder }]}>
							<Pencil size={13} color={c.brandInk} strokeWidth={2.4} />
							<Text variant="label" style={{ color: c.brandInk }} maxFontSizeMultiplier={1.3}>
								Edit
							</Text>
						</View>
					) : null}
				</PressableScale>
			</FadeSlideIn>

			<FadeSlideIn index={2}>
				<PlusPanel
					name={pet?.name ?? 'your pet'}
					plus={plus}
					onSeePlans={() => openPaywall('profile_panel')}
				/>
			</FadeSlideIn>

			<FadeSlideIn index={3}>
				<Section title="Your pet">
					<Card
						padding="compact"
						onPress={
							pet ? () => router.push({ pathname: '/pet/[id]', params: { id: pet.id } }) : undefined
						}
						accessibilityLabel={
							pet ? `${pet.name}, ${presetById(pet.preset).title}. Opens their page` : undefined
						}
					>
						{pet ? (
							<View style={s.petRow}>
								<PetPortrait appearance={pet.appearance} mood="content" size={40} />
								<View style={s.who}>
									<Text variant="label" numberOfLines={1}>
										{pet.name}
									</Text>
									<Text variant="caption" tone="secondary" numberOfLines={1}>
										{presetById(pet.preset).title}
									</Text>
								</View>
								<ChevronRight size={18} color={c.textTertiary} strokeWidth={2} />
							</View>
						) : petQuery.isError ? (
							<InlineQueryError error={petQuery.error} onRetry={() => petQuery.refetch()} />
						) : (
							<View style={s.petRow}>
								<Skeleton width={40} height={40} />
								<Skeleton width="50%" height={14} />
							</View>
						)}
					</Card>
				</Section>
			</FadeSlideIn>
		</Screen>
	)
}

const AVATAR = 64
const BADGE = 26

const s = StyleSheet.create({
	identity: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 14,
		padding: 16,
		borderWidth: StyleSheet.hairlineWidth
	},
	// The amber pencil on the avatar, ringed in the card's colour so it sits on the photo cleanly.
	badge: {
		position: 'absolute',
		right: -4,
		bottom: -4,
		width: BADGE,
		height: BADGE,
		borderRadius: BADGE / 2,
		borderWidth: 2,
		alignItems: 'center',
		justifyContent: 'center'
	},
	// "Edit": says out loud that the card opens Edit profile (the whole card is the button).
	edit: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		paddingHorizontal: 12,
		height: 32,
		borderRadius: 16,
		borderWidth: StyleSheet.hairlineWidth
	},
	who: { flex: 1, gap: 3 },
	petRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }
})
