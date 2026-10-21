/**
 * "{name} remembers": every fact the pet keeps, newest first, a page at a time, with a search and
 * a way to forget each one, asked first (docs/application/features/v2-memory-requirements.md,
 * R16–R17). Opened from the pet's page ("Manage all"); `memory` highlights the fact Home's
 * memory row was about.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Search } from 'lucide-react-native'
import { MEMORY_SEARCH_MAX, type MemoryItem } from '@app/contract'
import { countBucket } from '@/components/pet/MemoryList'
import { MemoryRow, useConfirmForget } from '@/components/pet/MemoryRow'
import { QueryErrorState } from '@/components/QueryError'
import { PageHeader } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { useTheme } from '@/contexts/ThemeContext'
import { useDebounced, useForgetMemory, useMemoryPages } from '@/hooks/useMemories'
import { usePet } from '@/hooks/usePet'
import { track } from '@/lib/analytics'
import { localDayNow } from '@/lib/timeZone'

export default function MemoriesScreen() {
	const { memory: highlight } = useLocalSearchParams<{ memory?: string }>()
	const { colors: c, layout } = useTheme()
	const name = usePet().data?.name ?? 'Your pet'
	const [typed, setTyped] = useState('')
	const search = useDebounced(typed.trim())
	const pages = useMemoryPages(search)
	const forget = useForgetMemory('list')
	const confirm = useConfirmForget(name, (id) => forget.mutate(id))
	const today = localDayNow()
	const viewed = useRef(false)
	const searched = useRef(false)

	const memories = useMemo<MemoryItem[]>(
		() => pages.data?.pages.flatMap((page) => page.memories) ?? [],
		[pages.data]
	)
	const first = pages.data?.pages[0]

	useEffect(() => {
		if (!first || viewed.current) return
		viewed.current = true
		track('memory_list_viewed', {
			surface: 'page',
			count_bucket: countBucket(first.total),
			full: first.total >= first.cap
		})
	}, [first])

	// Whether people search at all, and whether they find it: once a visit, never the words.
	useEffect(() => {
		if (!search || !first || pages.isPlaceholderData || searched.current) return
		searched.current = true
		track('memory_searched', { found: first.matched > 0 })
	}, [search, first, pages.isPlaceholderData])

	const loadMore = useCallback(() => {
		if (pages.hasNextPage && !pages.isFetchingNextPage) void pages.fetchNextPage()
	}, [pages])

	const renderItem = useCallback(
		({ item }: { item: MemoryItem }) => (
			<MemoryRow
				memory={item}
				today={today}
				highlighted={item.id === highlight}
				onForget={confirm.ask}
			/>
		),
		[today, highlight, confirm.ask]
	)

	return (
		<Screen header={<PageHeader title={`${name} remembers`} />} scroll={false} gap={12}>
			<TextInputField
				value={typed}
				onChangeText={setTyped}
				placeholder="Search what they remember"
				icon={(color) => <Search size={16} color={color} strokeWidth={2} />}
				maxLength={MEMORY_SEARCH_MAX}
				autoCorrect={false}
				autoCapitalize="none"
				returnKeyType="search"
				clearButtonMode="while-editing"
				accessibilityLabel="Search what they remember"
			/>
			{first ? (
				<Text variant="caption" tone="secondary">
					{search
						? `${first.matched} found · ${first.total} of ${first.cap} kept`
						: `${first.total} of ${first.cap} kept`}
				</Text>
			) : null}

			{pages.isPending ? (
				<View style={s.loading}>
					<Skeleton width="90%" height={20} />
					<Skeleton width="70%" height={20} />
					<Skeleton width="80%" height={20} />
				</View>
			) : pages.isError && memories.length === 0 ? (
				<QueryErrorState
					error={pages.error}
					title={`Couldn't load what ${name} remembers`}
					onRetry={() => void pages.refetch()}
				/>
			) : (
				<FlatList
					data={memories}
					keyExtractor={(item) => item.id}
					renderItem={renderItem}
					onEndReached={loadMore}
					onEndReachedThreshold={0.5}
					initialNumToRender={12}
					windowSize={7}
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="on-drag"
					showsVerticalScrollIndicator={false}
					contentContainerStyle={[s.list, { paddingBottom: layout.gutter * 2 }]}
					refreshControl={
						<RefreshControl
							refreshing={pages.isRefetching && !pages.isFetchingNextPage}
							onRefresh={() => void pages.refetch()}
							tintColor={c.brandInk}
						/>
					}
					ListEmptyComponent={
						<Text variant="bodySm" tone="secondary" style={s.empty}>
							{search
								? `Nothing ${name} remembers matches "${search}".`
								: `Nothing yet. Tell ${name} about your day: what ${name} keeps shows up here.`}
						</Text>
					}
					ListFooterComponent={
						pages.isFetchingNextPage ? (
							<ActivityIndicator color={c.brandInk} style={s.more} />
						) : null
					}
				/>
			)}
			{confirm.modal}
		</Screen>
	)
}

const s = StyleSheet.create({
	loading: { gap: 12, paddingTop: 8 },
	list: { gap: 6 },
	empty: { paddingTop: 12 },
	more: { paddingVertical: 16 }
})
