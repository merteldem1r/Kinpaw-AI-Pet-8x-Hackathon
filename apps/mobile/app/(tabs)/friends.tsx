/**
 * Friends — the second tab (docs/application/features/v2-friends-requirements.md, R1–R5): your
 * friends' pets, newest friend first, and the two ways to make a friend: show your code, or add
 * theirs. Read-only: a friend's pet is seen, never cared for.
 */
import { useState } from 'react'
import { RefreshControl, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { QrCode, UserPlus } from 'lucide-react-native'
import { FRIENDS_MAX } from '@app/contract'
import { FriendRow } from '@/components/friends/FriendRow'
import { MyCodeSheet } from '@/components/friends/MyCodeSheet'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { PetArt } from '@/components/pet/PetArt'
import { QueryErrorState } from '@/components/QueryError'
import { Button } from '@/components/ui/Button'
import { Screen } from '@/components/ui/Screen'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { useFriends } from '@/hooks/useFriends'
import { usePet } from '@/hooks/usePet'

const EMPTY_PET = 150

export default function FriendsScreen() {
	const friends = useFriends()
	const pet = usePet().data
	const { colors: c, radii } = useTheme()
	const [codeFrom, setCodeFrom] = useState<'empty_state' | 'list' | null>(null)

	const data = friends.data
	const list = data?.friends ?? []
	const empty = data !== undefined && list.length === 0
	const full = list.length >= FRIENDS_MAX

	const actions = (
		<View style={empty ? s.stacked : s.row}>
			<Button
				label="Show my code"
				variant={empty ? 'primary' : 'secondary'}
				size={empty ? 'md' : 'sm'}
				fullWidth={empty}
				disabled={!data}
				icon={(color) => <QrCode size={16} color={color} strokeWidth={2} />}
				onPress={() => setCodeFrom(empty ? 'empty_state' : 'list')}
				style={empty ? undefined : s.action}
			/>
			<Button
				label="Add a friend"
				variant={empty ? 'secondary' : 'outline'}
				size={empty ? 'md' : 'sm'}
				fullWidth={empty}
				disabled={full}
				icon={(color) => <UserPlus size={16} color={color} strokeWidth={2} />}
				onPress={() => router.push('/friends/add')}
				style={empty ? undefined : s.action}
			/>
		</View>
	)

	return (
		<Screen
			tabs
			gap={20}
			refreshControl={
				<RefreshControl
					refreshing={friends.isRefetching}
					onRefresh={() => void friends.refetch()}
					tintColor={c.brandInk}
				/>
			}
		>
			<FadeSlideIn index={0}>
				<Text variant="title" accessibilityRole="header">
					Friends
				</Text>
			</FadeSlideIn>

			{friends.isError && !data ? (
				<QueryErrorState
					error={friends.error}
					title="Couldn't load your friends"
					onRetry={() => void friends.refetch()}
				/>
			) : !data ? (
				<View style={s.list}>
					{[0, 1, 2].map((i) => (
						<Skeleton key={i} width="100%" height={80} radius={radii.card} />
					))}
				</View>
			) : empty ? (
				<FadeSlideIn index={1} style={s.empty}>
					{pet ? <PetArt appearance={pet.appearance} mood="happy" size={EMPTY_PET} /> : null}
					<Text variant="h3" style={s.center}>
						See your friends&apos; pets
					</Text>
					<Text variant="body" tone="secondary" style={s.center}>
						Show them your code, or scan theirs with your iPhone&apos;s Camera.
					</Text>
					{actions}
				</FadeSlideIn>
			) : (
				<>
					<FadeSlideIn index={1}>{actions}</FadeSlideIn>
					{full ? (
						<Text variant="caption" tone="secondary">
							{`You have ${FRIENDS_MAX} friends, the most there can be.`}
						</Text>
					) : null}
					<View style={s.list}>
						{list.map((friend, i) => (
							<FadeSlideIn key={friend.id} index={Math.min(i + 2, 8)}>
								<FriendRow friend={friend} />
							</FadeSlideIn>
						))}
					</View>
				</>
			)}

			{data ? (
				<MyCodeSheet
					open={codeFrom !== null}
					onClose={() => setCodeFrom(null)}
					code={data.code}
					pet={pet}
					source={codeFrom ?? 'list'}
				/>
			) : null}
		</Screen>
	)
}

const s = StyleSheet.create({
	row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
	// The empty state's two buttons, full width, one above the other. No flexWrap here: a
	// wrapping column sizes its line to the widest child, so the buttons stop short of the edge.
	stacked: { alignSelf: 'stretch', gap: 10, marginTop: 8 },
	action: { flexGrow: 1 },
	list: { gap: 12 },
	empty: { alignItems: 'center', gap: 12, paddingTop: 12 },
	center: { textAlign: 'center' }
})
