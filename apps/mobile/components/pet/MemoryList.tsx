import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { BookHeart } from 'lucide-react-native'
import { MEMORY_CAP_FREE } from '@app/contract'
import { MemoryRow } from '@/components/pet/MemoryRow'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { TextLink } from '@/components/ui/TextLink'
import { useTheme } from '@/contexts/ThemeContext'
import { MEMORY_PREVIEW, useMemoryPreview } from '@/hooks/useMemories'
import { track } from '@/lib/analytics'
import { openPaywall } from '@/lib/openPaywall'
import { localDayNow } from '@/lib/timeZone'

// "{name} remembers…" on the pet's page (docs/application/features/v2-memory-requirements.md,
// R16): the newest few facts, read-only, how many it keeps of how many it can, and a button to
// the full list (app/memories.tsx), where they can be searched and forgotten (Mert, 2026-10-03:
// changes happen in one place). Never the tags or scores: those are the server's.

/** How many it remembers, for `memory_list_viewed`: never the facts. */
export function countBucket(count: number): '0' | '1-5' | '6-15' | '16+' {
	if (count === 0) return '0'
	if (count <= 5) return '1-5'
	return count <= 15 ? '6-15' : '16+'
}

export function MemoryList({ name, highlight }: { name: string; highlight?: string }) {
	const { colors: c, radii } = useTheme()
	const query = useMemoryPreview()
	const viewed = useRef(false)
	const data = query.data
	const today = localDayNow()

	useEffect(() => {
		if (!data || viewed.current) return
		viewed.current = true
		track('memory_list_viewed', {
			surface: 'card',
			count_bucket: countBucket(data.total),
			full: data.total >= data.cap
		})
	}, [data])

	const full = data !== undefined && data.total >= data.cap
	return (
		<Card style={s.card}>
			<View style={s.head}>
				<Eyebrow>{`${name} remembers…`}</Eyebrow>
				{data ? (
					<Text variant="caption" tone="secondary">
						{`${data.total} of ${data.cap}`}
					</Text>
				) : null}
			</View>

			{query.isPending ? (
				<View style={s.rows}>
					<Skeleton width="85%" height={18} />
					<Skeleton width="65%" height={18} />
				</View>
			) : query.isError ? (
				<View style={s.empty}>
					<Text variant="bodySm" tone="secondary">
						{`Couldn't load what ${name} remembers.`}
					</Text>
					<TextLink label="Try again" tone="brand" onPress={() => void query.refetch()} />
				</View>
			) : data && data.total === 0 ? (
				<Text variant="bodySm" tone="secondary">
					{`Nothing yet. Tell ${name} about your day: what ${name} keeps shows up here, and you can make ${name} forget anything.`}
				</Text>
			) : (
				<View style={s.rows}>
					{data?.memories.slice(0, MEMORY_PREVIEW).map((memory) => (
						<MemoryRow
							key={memory.id}
							memory={memory}
							today={today}
							highlighted={memory.id === highlight}
						/>
					))}
				</View>
			)}

			{data && data.total > 0 ? (
				<Button
					label={
						data.total > MEMORY_PREVIEW
							? `See all ${data.total} and manage`
							: 'Manage what they remember'
					}
					variant="secondary"
					fullWidth
					icon={(color) => <BookHeart size={16} color={color} strokeWidth={2} />}
					onPress={() =>
						router.push({ pathname: '/memories', params: highlight ? { memory: highlight } : {} })
					}
				/>
			) : null}

			{full && data.cap === MEMORY_CAP_FREE ? (
				<View
					style={[
						s.plus,
						{ borderRadius: radii.card, backgroundColor: c.brandDim, borderColor: c.brandBorder }
					]}
				>
					<Text variant="bodySm">
						{`${name}'s memory is full: a new fact makes room by forgetting the least important.`}
					</Text>
					<TextLink
						label="Plus remembers up to 100"
						tone="brand"
						onPress={() => openPaywall('memory_full')}
					/>
				</View>
			) : null}
		</Card>
	)
}

const s = StyleSheet.create({
	card: { gap: 14 },
	head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	rows: { gap: 6 },
	empty: { gap: 6, alignItems: 'flex-start' },
	plus: { gap: 6, padding: 12, borderWidth: StyleSheet.hairlineWidth, alignItems: 'flex-start' }
})
