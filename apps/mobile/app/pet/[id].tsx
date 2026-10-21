/**
 * Pet details — one pet's page, read-only (opened from the pet on Profile): the
 * pet under the sky outside, its name and look, how long it has been home and
 * the milestones, what it remembers about you (v2), its personality and its looks, and the
 * way back to its room. `memory` (from Home's chip) highlights the fact it was about.
 * One route per pet, so a second pet later gets its own page.
 */
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { CalendarHeart, Hourglass, Palette, Sparkles, type LucideIcon } from 'lucide-react-native'
import {
	ATTRIBUTES,
	describeAppearance,
	hasCustomTraits,
	isPremiumOption,
	moodFor,
	optionLabel,
	presetById,
	TRAITS,
	type Pet
} from '@app/contract'
import { FadeSlideIn } from '@/components/motion/FadeSlideIn'
import { MemoryList } from '@/components/pet/MemoryList'
import { HERO_HEIGHT, PetHero } from '@/components/pet/PetHero'
import { TraitBar } from '@/components/pet/TraitBar'
import { QueryErrorState } from '@/components/QueryError'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { PageHeader } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { Skeleton } from '@/components/ui/Skeleton'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { useIntroDue } from '@/hooks/useIntro'
import { usePet } from '@/hooks/usePet'
import { usePetNeeds } from '@/hooks/usePetNeeds'
import { track } from '@/lib/analytics'
import { daysTogether, milestoneFor } from '@/lib/petAge'

export default function PetDetailsScreen() {
	const { id, memory } = useLocalSearchParams<{ id: string; memory?: string }>()
	const petQuery = usePet()
	const pet = petQuery.data
	// One pet today: the page is the signed-in person's pet, if it is the one asked for.
	const found = pet && pet.id === id ? pet : null

	useEffect(() => {
		track('pet_details_viewed', { from: 'profile' })
	}, [])

	return (
		<Screen
			header={<PageHeader title={found?.name} />}
			gap={18}
			footer={found ? <RoomButton pet={found} /> : undefined}
		>
			{found ? (
				<Details pet={found} highlight={memory} />
			) : petQuery.isError ? (
				<QueryErrorState
					error={petQuery.error}
					title="Couldn't load your pet"
					onRetry={() => petQuery.refetch()}
				/>
			) : petQuery.isPending ? (
				<Loading />
			) : (
				<NotHere />
			)}
		</Screen>
	)
}

function Details({ pet, highlight }: { pet: Pet; highlight?: string }) {
	// "Tell me about you", while it is open (the spec, Entry points).
	const introDue = useIntroDue()
	const needs = usePetNeeds(pet)
	const mood = needs ? moodFor(needs) : 'content'
	const look = describeAppearance(pet.appearance)
	return (
		<>
			<FadeSlideIn index={0}>
				<PetHero name={pet.name} appearance={pet.appearance} mood={mood} />
			</FadeSlideIn>
			<FadeSlideIn index={1} style={s.names}>
				<Text variant="display" numberOfLines={1} adjustsFontSizeToFit>
					{pet.name}
				</Text>
				<Text variant="body" tone="secondary">
					{`${look}.`}
				</Text>
			</FadeSlideIn>
			<FadeSlideIn index={2}>
				<Together createdAt={new Date(pet.created_at)} />
			</FadeSlideIn>
			<FadeSlideIn index={3} style={s.memory}>
				{introDue ? (
					<Button
						label={`Tell ${pet.name} about you`}
						variant="secondary"
						fullWidth
						icon={(color) => <Sparkles size={16} color={color} strokeWidth={2} />}
						onPress={() => router.push({ pathname: '/intro', params: { entry: 'pet_details' } })}
					/>
				) : null}
				<MemoryList name={pet.name} highlight={highlight} />
			</FadeSlideIn>
			<FadeSlideIn index={4}>
				<Personality pet={pet} />
			</FadeSlideIn>
			<FadeSlideIn index={5}>
				<Looks pet={pet} />
			</FadeSlideIn>
		</>
	)
}

/** Home since, days together, and the milestone: three tiles. */
function Together({ createdAt }: { createdAt: Date }) {
	const days = daysTogether(createdAt, new Date())
	const milestone = milestoneFor(days)
	const since = createdAt.toLocaleDateString(undefined, {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	})
	return (
		<View style={s.tiles}>
			<Tile icon={CalendarHeart} value={since} caption="Home since" />
			<Tile
				icon={Hourglass}
				value={`${days}`}
				caption={days === 1 ? 'Day together' : 'Days together'}
			/>
			<Tile
				icon={Sparkles}
				value={milestone.reached}
				caption={
					milestone.next ? `${milestone.next.label} in ${milestone.next.inDays}d` : 'Milestone'
				}
				featured
			/>
		</View>
	)
}

function Tile({
	icon: Icon,
	value,
	caption,
	featured = false
}: {
	icon: LucideIcon
	value: string
	caption: string
	featured?: boolean
}) {
	const { colors: c, radii } = useTheme()
	return (
		<View
			accessible
			accessibilityLabel={`${caption}: ${value}`}
			style={[
				s.tile,
				{
					borderRadius: radii.card,
					backgroundColor: featured ? c.brandDim : c.surface,
					borderColor: featured ? c.brandBorder : c.borderHairline
				}
			]}
		>
			<View style={[s.tileIcon, { backgroundColor: featured ? c.brandDim : c.surface2 }]}>
				<Icon size={16} color={c.brandInk} strokeWidth={2} />
			</View>
			<Text variant="label" numberOfLines={1} adjustsFontSizeToFit style={s.tileText}>
				{value}
			</Text>
			<Text
				variant="caption"
				tone="secondary"
				numberOfLines={1}
				adjustsFontSizeToFit
				style={s.tileText}
			>
				{caption}
			</Text>
		</View>
	)
}

/** The preset (or "Their own mix") and the six traits as read-only bars, each in its colour. */
function Personality({ pet }: { pet: Pet }) {
	const preset = presetById(pet.preset)
	const custom = hasCustomTraits(pet.preset, pet.traits)
	return (
		<Card style={s.card}>
			<Eyebrow>Personality</Eyebrow>
			<View style={s.cardHead}>
				<Text variant="h3">{custom ? 'Their own mix' : preset.title}</Text>
				<Text variant="caption" tone="secondary">
					{custom ? `Fine-tuned from ${preset.title}.` : preset.description}
				</Text>
			</View>
			<View style={s.traits}>
				{TRAITS.map((trait) => (
					<TraitBar key={trait} trait={trait} level={Math.round(pet.traits[trait] / 2)} />
				))}
			</View>
		</Card>
	)
}

/** Its appearance as tags; a Plus option carries a sparkle. Then Change look. */
function Looks({ pet }: { pet: Pet }) {
	const { colors: c } = useTheme()
	const a = pet.appearance
	const tags = [
		{ key: 'species', label: a.species === 'cat' ? 'Cat' : 'Dog', plus: false },
		...ATTRIBUTES.map((attribute) => ({
			key: attribute.key,
			label: `${optionLabel(attribute.key, a[attribute.key], a.species)} ${attribute.label.toLowerCase()}`,
			plus: isPremiumOption(attribute.key, a[attribute.key], a.species)
		}))
	]
	return (
		<Card style={s.card}>
			<Eyebrow>Looks</Eyebrow>
			<View style={s.tags}>
				{tags.map((tag) => (
					<View
						key={tag.key}
						style={[
							s.tag,
							tag.plus
								? { backgroundColor: c.brandDim, borderColor: c.brandBorder }
								: { backgroundColor: c.surface2, borderColor: c.borderHairline }
						]}
					>
						{tag.plus ? <Sparkles size={12} color={c.brandInk} strokeWidth={2.2} /> : null}
						<Text
							variant="caption"
							style={{ color: tag.plus ? c.brandInk : c.textPrimary }}
							accessibilityLabel={tag.plus ? `${tag.label}, Plus` : tag.label}
						>
							{tag.label}
						</Text>
					</View>
				))}
			</View>
			{/* Change look (M7, R14): the builder on this pet's own appearance. */}
			<Button
				label="Change look"
				variant="secondary"
				size="sm"
				icon={(color) => <Palette size={14} color={color} strokeWidth={2} />}
				onPress={() => router.push('/change-look')}
				style={s.changeLook}
			/>
		</Card>
	)
}

function RoomButton({ pet }: { pet: Pet }) {
	const { layout } = useTheme()
	return (
		<View style={{ paddingHorizontal: layout.gutter, paddingTop: 10 }}>
			<Button
				label={`Go to ${pet.name}'s room`}
				size="lg"
				withArrow
				fullWidth
				onPress={() => {
					track('pet_details_room_tapped')
					router.navigate('/(tabs)')
				}}
			/>
		</View>
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

/** Asked for a pet this account doesn't have (an old link, or one that has gone). */
function NotHere() {
	return (
		<View style={s.notHere}>
			<Text variant="h3">This pet isn&apos;t here</Text>
			<Text variant="bodySm" tone="secondary">
				It may belong to another account.
			</Text>
			<Button label="Back" variant="secondary" onPress={() => router.back()} />
		</View>
	)
}

const s = StyleSheet.create({
	memory: { gap: 12 },
	changeLook: { alignSelf: 'flex-start', marginTop: 4 },
	names: { gap: 4 },
	tiles: { flexDirection: 'row', gap: 10 },
	tile: {
		flex: 1,
		gap: 2,
		paddingVertical: 14,
		paddingHorizontal: 8,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: StyleSheet.hairlineWidth
	},
	tileIcon: {
		width: 32,
		height: 32,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
		marginBottom: 6
	},
	tileText: { textAlign: 'center' },
	card: { gap: 14 },
	cardHead: { gap: 4 },
	traits: { gap: 12 },
	tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	tag: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 5,
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 14,
		borderWidth: StyleSheet.hairlineWidth
	},
	notHere: { gap: 10, alignItems: 'flex-start', paddingTop: 20 }
})
