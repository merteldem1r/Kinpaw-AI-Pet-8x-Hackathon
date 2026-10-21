import { type ReactNode } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, {
	runOnJS,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withRepeat,
	withSequence,
	withSpring,
	withTiming
} from 'react-native-reanimated'
import type { MemoryItem } from '@app/contract'
import { useMountEffect } from '@/hooks/useMountEffect'
import { CATEGORY_ICON, eventWhen } from '@/components/pet/MemoryRow'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { Easings, Springs } from '@/lib/motion'

/** The gap between two facts popping out of the pet, ms (the spec: about 140 ms). */
const STAGGER_MS = 140
/** Before the first one, so the pet has risen into place. */
const FIRST_DELAY_MS = 450
/** How far a fact bobs once it has landed, pt, and its half-cycle (each a little different). */
const BOB = 3
const BOB_HALF_MS = 1700
/** At most this many facts side by side in a row. */
const PER_ROW = 2
/** Space between two facts in a row, and between rows, pt. */
const GAP = 10
/** How far a row leans left or right of centre, pt: the rows look scattered, never stacked. */
const LEAN = 18
/** The page's side margins, pt, which a row of two must fit inside. */
const MARGINS = 40

/**
 * The intro's result (the spec, "Tell me about you (v2)"): the pet big in the middle and what it
 * will remember around it, in rows above and below it, never more than two side by side, so they
 * never touch. The first facts land nearest the pet. Each pops out of the pet in turn and bobs
 * gently once it lands; `onLand` lets the pet bounce. Read-only: forgetting is on the pet's page
 * (Mert, 2026-10-04). Under Reduce Motion they are simply there, still.
 */
export function FactOrbit({
	facts,
	today,
	pet,
	onLand
}: {
	facts: readonly MemoryItem[]
	/** YYYY-MM-DD on this phone, for an event's day. */
	today: string
	/** The pet, at the size given. */
	pet: (petSize: number) => ReactNode
	/** A fact landed: `first` for the first one (the success haptic). */
	onLand: (first: boolean) => void
}) {
	const { width, height } = useWindowDimensions()
	// Alternating above and below, so a few facts already sit around the pet.
	const above = facts.filter((_, index) => index % 2 === 0)
	const below = facts.filter((_, index) => index % 2 === 1)
	// Above, the first row is the one nearest the pet (drawn last).
	const rowsAbove = rows(above)
	const rowsBelow = rows(below)
	const petSize = height < 760 ? 168 : 212
	const chipMax = (width - MARGINS - GAP) / PER_ROW

	const renderRow = (row: readonly MemoryItem[], depth: number, side: 'above' | 'below') => (
		<View
			key={`${side}-${depth}`}
			style={[
				s.row,
				// Rows lean alternately left and right, so the cloud never looks like a list.
				{
					transform: [
						{ translateX: (depth % 2 === 0 ? -LEAN : LEAN) * (side === 'above' ? 1 : -1) }
					]
				}
			]}
		>
			{row.map((fact) => (
				<FloatingFact
					key={fact.id}
					fact={fact}
					today={today}
					order={facts.indexOf(fact)}
					// From the pet: a fact above rises out of it, one below drops out of it.
					fromY={(side === 'above' ? 1 : -1) * (petSize / 2 + depth * 48)}
					maxWidth={chipMax}
					onLand={onLand}
				/>
			))}
		</View>
	)

	return (
		<View style={s.cloud}>
			<View style={s.band}>
				{rowsAbove.map((row, depth) => renderRow(row, depth, 'above')).reverse()}
			</View>
			<View style={s.pet}>{pet(petSize)}</View>
			<View style={s.band}>{rowsBelow.map((row, depth) => renderRow(row, depth, 'below'))}</View>
		</View>
	)
}

/** Items in rows of PER_ROW, in order. */
function rows<T>(items: readonly T[]): T[][] {
	const out: T[][] = []
	for (let i = 0; i < items.length; i += PER_ROW) out.push(items.slice(i, i + PER_ROW))
	return out
}

function FloatingFact({
	fact,
	today,
	order,
	fromY,
	maxWidth,
	onLand
}: {
	fact: MemoryItem
	today: string
	order: number
	fromY: number
	maxWidth: number
	onLand: (first: boolean) => void
}) {
	const { colors: c, radii, elevation } = useTheme()
	const still = useReducedMotion()
	const arrive = useSharedValue(still ? 1 : 0)
	const bob = useSharedValue(0)
	const Icon = CATEGORY_ICON[fact.category]
	const day =
		fact.kind === 'event' && fact.follow_up_on ? ` · ${eventWhen(fact.follow_up_on, today)}` : ''

	useMountEffect(() => {
		const first = order === 0
		if (still) {
			onLand(first)
			return
		}
		const delay = FIRST_DELAY_MS + order * STAGGER_MS
		arrive.value = withDelay(
			delay,
			withSpring(1, Springs.gentle, (finished) => {
				if (finished) runOnJS(onLand)(first)
			})
		)
		const half = { duration: BOB_HALF_MS + order * 130, easing: Easings.inOut }
		bob.value = withDelay(
			delay + 600,
			withRepeat(withSequence(withTiming(-BOB, half), withTiming(BOB, half)), -1, true)
		)
	})

	const style = useAnimatedStyle(() => ({
		opacity: Math.min(1, arrive.value * 1.6),
		transform: [
			{ translateY: fromY * (1 - arrive.value) + bob.value },
			{ scale: 0.4 + 0.6 * arrive.value }
		]
	}))

	return (
		<Animated.View
			accessible
			accessibilityLabel={`${fact.text}${day}`}
			style={[
				s.chip,
				elevation.card,
				{
					maxWidth,
					borderRadius: radii.pill,
					backgroundColor: c.surface2,
					borderColor: c.brandBorder
				},
				style
			]}
		>
			<View style={[s.icon, { backgroundColor: c.brandDim }]}>
				<Icon size={13} color={c.brandInk} strokeWidth={2.1} />
			</View>
			<Text variant="caption" style={[s.text, { color: c.textPrimary }]} numberOfLines={2}>
				{`${fact.text}${day}`}
			</Text>
		</Animated.View>
	)
}

/** The category icon's disc, pt. */
const ICON = 24

const s = StyleSheet.create({
	cloud: { flex: 1, justifyContent: 'center', gap: 16 },
	band: { gap: GAP },
	row: { flexDirection: 'row', justifyContent: 'center', gap: GAP },
	pet: { alignItems: 'center' },
	chip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 7,
		paddingLeft: 5,
		paddingRight: 12,
		paddingVertical: 5,
		borderWidth: 1
	},
	icon: {
		width: ICON,
		height: ICON,
		borderRadius: ICON / 2,
		alignItems: 'center',
		justifyContent: 'center'
	},
	text: { flexShrink: 1, fontWeight: '600' }
})
