/**
 * A friend's pet (docs/application/features/v2-friends-requirements.md, R11–R12): the pet in its
 * mood under your sky, whose it is, since when, and how it feels in words, never numbers.
 * Read-only: no care, no talking. Remove friend ends it for both, after a confirm.
 */
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { UserMinus } from 'lucide-react-native'
import { describeAppearance, type Friend, type FriendPet } from '@app/contract'
import { FriendNeeds } from '@/components/friends/FriendNeeds'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { HERO_HEIGHT, PetHero } from '@/components/pet/PetHero'
import { QueryErrorState } from '@/components/QueryError'
import { AlertModal } from '@/components/ui/AppModal'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/contexts/ToastContext'
import { useFriends, useRemoveFriend } from '@/hooks/useFriends'
import { track } from '@/lib/analytics'
import { friendName, friendPetCaption, friendPetLine } from '@/lib/friends'

export default function FriendPetScreen() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const friends = useFriends()
	const friend = friends.data?.friends.find((candidate) => candidate.id === id)

	return (
		<Screen
			header={<PageHeader title={friend?.pet?.name ?? friend?.display_name ?? undefined} />}
			gap={18}
		>
			{friend ? (
				<Details friend={friend} />
			) : friends.isError && !friends.data ? (
				<QueryErrorState
					error={friends.error}
					title="Couldn't load your friend"
					onRetry={() => void friends.refetch()}
				/>
			) : friends.isPending ? (
				<Loading />
			) : (
				<NotFriends />
			)}
		</Screen>
	)
}

function Details({ friend }: { friend: Friend }) {
	const viewed = useRef(false)
	useEffect(() => {
		if (viewed.current || !friend.pet) return
		viewed.current = true
		track('friend_pet_viewed', { mood: friend.pet.mood })
	}, [friend.pet])

	const since = new Date(friend.since).toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	})
	return (
		<>
			{friend.pet ? <PetSide pet={friend.pet} caption={friendPetCaption(friend)} /> : null}
			<FadeSlideIn index={3}>
				<Text variant="bodySm" tone="secondary">
					{`Friends with ${friendName(friend)} since ${since}.`}
				</Text>
			</FadeSlideIn>
			<FadeSlideIn index={4}>
				<RemoveFriend friend={friend} />
			</FadeSlideIn>
		</>
	)
}

function PetSide({ pet, caption }: { pet: FriendPet; caption: string }) {
	return (
		<>
			<FadeSlideIn index={0}>
				<PetHero name={pet.name} appearance={pet.appearance} mood={pet.mood} />
			</FadeSlideIn>
			<FadeSlideIn index={1} style={s.names}>
				<Text variant="display" numberOfLines={1} adjustsFontSizeToFit>
					{pet.name}
				</Text>
				<Text variant="body" tone="secondary">
					{`${caption}. ${describeAppearance(pet.appearance)}.`}
				</Text>
			</FadeSlideIn>
			<FadeSlideIn index={2} style={s.needs}>
				<Text variant="label">{friendPetLine(pet)}</Text>
				<FriendNeeds needs={pet.needs} />
			</FadeSlideIn>
		</>
	)
}

function RemoveFriend({ friend }: { friend: Friend }) {
	const remove = useRemoveFriend()
	const { showToast } = useToast()
	const [asking, setAsking] = useState(false)
	const name = friendName(friend)
	return (
		<>
			<Button
				label="Remove friend"
				variant="ghost"
				icon={(color) => <UserMinus size={16} color={color} strokeWidth={2} />}
				onPress={() => setAsking(true)}
				style={s.remove}
			/>
			<AlertModal
				visible={asking}
				title={`Remove ${name}?`}
				message="You'll stop seeing each other's pets. To be friends again, one of you scans the other's code."
				buttons={[
					{ text: 'Cancel', style: 'cancel' },
					{
						text: 'Remove',
						style: 'destructive',
						onPress: () => {
							router.back()
							remove.mutate(friend.id, {
								onError: () => showToast(`Couldn't remove ${name} just now. Try again.`, 'error')
							})
						}
					}
				]}
				onDismiss={() => setAsking(false)}
			/>
		</>
	)
}

function Loading() {
	const { radii } = useTheme()
	return (
		<>
			<Skeleton width="100%" height={HERO_HEIGHT} radius={radii.card + 6} />
			<Skeleton width="50%" height={36} />
			<Skeleton width="80%" height={16} />
		</>
	)
}

/** A friendship that ended (removed here or by them) while the page was open. */
function NotFriends() {
	return (
		<View style={s.gone}>
			<Text variant="h3">You&apos;re not friends any more</Text>
			<Text variant="body" tone="secondary">
				One of you removed the other. Scan their code to be friends again.
			</Text>
			<Button label="Back" variant="secondary" onPress={() => router.back()} />
		</View>
	)
}

const s = StyleSheet.create({
	names: { gap: 4 },
	needs: { gap: 10 },
	remove: { marginTop: 8 },
	gone: { gap: 12, paddingTop: 24 }
})
