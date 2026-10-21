import { useCallback, useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	Briefcase,
	GraduationCap,
	Heart,
	Lightbulb,
	MapPin,
	PawPrint,
	Puzzle,
	Target,
	Users,
	X,
	type LucideIcon
} from 'lucide-react-native'
import { daysBetween, weekdayOf, type MemoryCategory, type MemoryItem } from '@app/contract'
import { AlertModal } from '@/components/ui/AppModal'
import { IconButton } from '@/components/ui/IconButton'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { Durations } from '@/lib/motion'

// One remembered fact as a row, shared by the pet's page and "Mochi remembers"
// (docs/application/features/v2-memory-requirements.md, R16), and the question asked before one
// is forgotten: a tap on ✕ never deletes on its own. Only "Mochi remembers" forgets; the pet's
// page shows rows read-only.

/** Each category's icon: the list's rows and the intro's chips. */
export const CATEGORY_ICON: Record<MemoryCategory, LucideIcon> = {
	study: GraduationCap,
	work: Briefcase,
	family: Users,
	pets: PawPrint,
	hobbies: Puzzle,
	place: MapPin,
	likes: Heart,
	goals: Target,
	other: Lightbulb
}

/** When an event is, from today: "Today", "Tomorrow", "Wednesday", "In 12 days", "Was Friday". */
export function eventWhen(followUpOn: string, today: string): string {
	const ahead = daysBetween(today, followUpOn)
	if (ahead === 0) return 'Today'
	if (ahead === 1) return 'Tomorrow'
	if (ahead > 1 && ahead < 7) return weekdayOf(followUpOn)
	if (ahead >= 7) return `In ${ahead} days`
	return ahead === -1 ? 'Yesterday' : `Was ${weekdayOf(followUpOn)}`
}

export function MemoryRow({
	memory,
	today,
	highlighted = false,
	onForget
}: {
	memory: MemoryItem
	today: string
	highlighted?: boolean
	/**
	 * Asks first (`useConfirmForget`); the row never deletes on its own. Absent: a read-only row
	 * (the pet's page; forgetting happens on "Mochi remembers").
	 */
	onForget?: (memory: MemoryItem) => void
}) {
	const { colors: c, radii } = useTheme()
	const Icon = CATEGORY_ICON[memory.category]
	const when =
		memory.kind === 'event' && memory.follow_up_on ? eventWhen(memory.follow_up_on, today) : null
	return (
		<View
			style={[
				s.row,
				{ borderRadius: radii.card },
				highlighted && { backgroundColor: c.brandDim, borderColor: c.brandBorder }
			]}
		>
			<View style={[s.icon, { backgroundColor: c.surface2 }]}>
				<Icon size={16} color={c.brandInk} strokeWidth={2} />
			</View>
			<View
				style={s.text}
				accessible
				accessibilityLabel={when ? `${memory.text}, ${when}` : memory.text}
			>
				<Text variant="bodySm">{memory.text}</Text>
				{when ? (
					<Text variant="caption" tone="secondary">
						{when}
					</Text>
				) : null}
			</View>
			{onForget ? (
				<IconButton
					icon={(color) => <X size={16} color={color} strokeWidth={2} />}
					onPress={() => onForget(memory)}
					accessibilityLabel={`Forget: ${memory.text}`}
					size={32}
					haptic="press"
				/>
			) : null}
		</View>
	)
}

/**
 * "Forget this?" before a fact goes: `ask(memory)` opens it, `modal` is rendered once by the
 * screen, and `forget` runs only on the destructive button.
 *
 * Two things made it close with a jump (Mert, 2026-10-03): the modal fades out on its own
 * props, and clearing the fact at once took its message away mid-fade, so the bottom-anchored
 * card shrank and dropped; and the row left the list under the fading backdrop at the same
 * moment. So the fact stays on the card until it has faded, and the forget runs after.
 */
export function useConfirmForget(name: string, forget: (id: string) => void) {
	const [asking, setAsking] = useState<{ memory: MemoryItem; open: boolean } | null>(null)
	// The forget waiting for the fade, and the latest `forget`: leaving the screen mid-fade
	// sends it at once rather than losing it.
	const pending = useRef<{ timer: ReturnType<typeof setTimeout>; id: string } | null>(null)
	const latestForget = useRef(forget)
	latestForget.current = forget
	const flush = useCallback(() => {
		if (!pending.current) return
		clearTimeout(pending.current.timer)
		const { id } = pending.current
		pending.current = null
		latestForget.current(id)
	}, [])
	useEffect(() => flush, [flush])

	const ask = useCallback((memory: MemoryItem) => setAsking({ memory, open: true }), [])
	const close = useCallback(
		() => setAsking((current) => (current ? { ...current, open: false } : current)),
		[]
	)
	const modal = (
		<AlertModal
			visible={asking?.open === true}
			title="Forget this?"
			message={asking ? `"${asking.memory.text}". ${name} won't bring it up again.` : undefined}
			buttons={[
				{
					text: 'Forget',
					style: 'destructive',
					onPress: () => {
						const id = asking?.memory.id
						if (!id) return
						flush()
						pending.current = { id, timer: setTimeout(flush, Durations.modalOut) }
					}
				},
				{ text: 'Keep', style: 'cancel' }
			]}
			onDismiss={close}
		/>
	)
	return { ask, modal }
}

const s = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingVertical: 6,
		paddingHorizontal: 6,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: 'transparent'
	},
	icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
	text: { flex: 1, gap: 2 }
})
