import { StyleSheet, View } from 'react-native'
import {
	Compass,
	Feather,
	Handshake,
	Heart,
	Volleyball,
	Zap,
	type LucideIcon
} from 'lucide-react-native'
import { art, withAlpha } from '@app/brand'
import { TRAIT_DOTS, TRAIT_LABEL, type Trait } from '@app/contract'
import { PressableScale } from '@/components/motion/PressableScale'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { haptic } from '@/lib/haptics'

const ICON = 28
const GAP = 10
const NAME = 96
const SEGMENT = 8
/** An editable row's height: each segment is a full-height tap target. */
const EDIT_ROW = 48

/** Where the bar starts, from the row's left edge: a legend above the bars lines up with it. */
export const TRAIT_BAR_START = ICON + GAP + NAME + GAP

/** Each trait's icon; its colour is `art.traits`. */
const TRAIT_ICONS: Record<Trait, LucideIcon> = {
	affection: Heart,
	playfulness: Volleyball,
	energy: Zap,
	curiosity: Compass,
	loyalty: Handshake,
	independence: Feather
}

/**
 * One personality trait (docs/application/UI/kinpaw-screen-spec-v1.md, "Pet
 * details" and "Fine-tune sheet"): its icon on a disc tinted in the trait's own
 * colour, its name, then five segments across the rest of the row, filled to
 * the level in that colour over the same colour at 14%.
 *
 * Read-only without `onChange`. With it, each segment is a full-height target
 * that sets the level (`select` haptic), and VoiceOver can step it: "Affection,
 * level 3 of 5".
 */
export function TraitBar({
	trait,
	level,
	onChange
}: {
	trait: Trait
	/** 1–5, as shown. */
	level: number
	onChange?: (level: number) => void
}) {
	const { colors: c } = useTheme()
	const Icon = TRAIT_ICONS[trait]
	const color = art.traits[trait]
	const label = TRAIT_LABEL[trait]

	function set(next: number) {
		if (!onChange) return
		const clamped = Math.min(TRAIT_DOTS, Math.max(1, next))
		if (clamped === level) return
		haptic.select()
		onChange(clamped)
	}

	return (
		<View
			style={[s.row, onChange && s.editRow]}
			accessible
			accessibilityRole={onChange ? 'adjustable' : undefined}
			accessibilityLabel={onChange ? label : `${label}, ${level} of ${TRAIT_DOTS}`}
			accessibilityValue={onChange ? { text: `level ${level} of ${TRAIT_DOTS}` } : undefined}
			accessibilityActions={onChange ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
			onAccessibilityAction={(e) =>
				set(level + (e.nativeEvent.actionName === 'increment' ? 1 : -1))
			}
		>
			<View style={[s.icon, { backgroundColor: withAlpha(color, 0.16) }]}>
				<Icon size={15} color={color} strokeWidth={2.2} />
			</View>
			<Text variant="bodySm" style={[s.name, { color: c.textPrimary }]} numberOfLines={1}>
				{label}
			</Text>
			<View style={s.segments}>
				{Array.from({ length: TRAIT_DOTS }, (_, i) => {
					const segment = (
						<View
							style={[s.segment, { backgroundColor: i < level ? color : withAlpha(color, 0.14) }]}
						/>
					)
					return onChange ? (
						<PressableScale
							key={i}
							haptic={false}
							scaleTo={0.92}
							onPress={() => set(i + 1)}
							style={s.target}
							importantForAccessibility="no"
						>
							{segment}
						</PressableScale>
					) : (
						<View key={i} style={s.cell}>
							{segment}
						</View>
					)
				})}
			</View>
		</View>
	)
}

const s = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center', gap: GAP },
	editRow: { height: EDIT_ROW },
	icon: {
		width: ICON,
		height: ICON,
		borderRadius: ICON / 2,
		alignItems: 'center',
		justifyContent: 'center'
	},
	name: { width: NAME },
	segments: { flex: 1, flexDirection: 'row', gap: 4, alignSelf: 'stretch', alignItems: 'center' },
	cell: { flex: 1 },
	target: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
	segment: { height: SEGMENT, borderRadius: SEGMENT / 2 }
})
