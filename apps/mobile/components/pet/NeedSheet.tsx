import { StyleSheet, View } from 'react-native'
import { ArrowDown, ArrowUp, Info, type LucideIcon } from 'lucide-react-native'
import { isLow, type Need, type Needs } from '@app/contract'
import { NEED } from '@/components/pet/NeedPill'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { needInfo, type NeedLine } from '@/lib/needInfo'

const BAR = 8

const LINE_ICON: Record<NeedLine['kind'], LucideIcon> = {
	down: ArrowDown,
	up: ArrowUp,
	note: Info
}

/**
 * How one need works, opened by tapping its pill on Home (the spec, "Home" → "Need sheet"): its
 * level now, what it is, what lowers it and what raises it. Explain only (Mert, 2026-10-02): no
 * action here, the care tiles stay the one place to act. The level stays live while it is open.
 */
export function NeedSheet({
	need,
	open,
	needs,
	name,
	onClose
}: {
	/** The need to explain: the last one opened, kept while the sheet slides away. */
	need: Need | null
	open: boolean
	needs: Needs
	name: string
	onClose: () => void
}) {
	return (
		<Sheet open={open && need !== null} onClose={onClose}>
			{need ? (
				<NeedSheetBody need={need} value={needs[need]} name={name} onClose={onClose} />
			) : null}
		</Sheet>
	)
}

function NeedSheetBody({
	need,
	value,
	name,
	onClose
}: {
	need: Need
	value: number
	name: string
	onClose: () => void
}) {
	const { colors: c } = useTheme()
	const { icon: Icon } = NEED[need]
	const info = needInfo(need, name)
	const low = isLow(value)
	const tint = low ? c.errorText : c.brandInk
	const level = Math.min(100, Math.max(0, value))

	return (
		<View style={s.body}>
			<View
				style={s.head}
				accessible
				accessibilityRole="header"
				accessibilityLabel={`${info.title}, ${value} percent${low ? ', low' : ''}`}
			>
				<View style={s.titleRow}>
					<Icon size={22} color={tint} strokeWidth={1.9} />
					<Text variant="h3" style={s.title}>
						{info.title}
					</Text>
					<Text variant="label" style={{ color: tint }}>
						{low ? `${value}% · low` : `${value}%`}
					</Text>
				</View>
				<View style={[s.track, { backgroundColor: c.tintTrack }]}>
					<View style={[s.fill, { width: `${level}%`, backgroundColor: tint }]} />
				</View>
			</View>

			<Text variant="body" tone="secondary">
				{info.about}
			</Text>

			<View style={s.lines}>
				{info.lines.map((line) => {
					const LineIcon = LINE_ICON[line.kind]
					return (
						<View key={line.text} style={s.line}>
							<LineIcon
								size={16}
								strokeWidth={2}
								color={
									line.kind === 'up'
										? c.brandInk
										: line.kind === 'down'
											? c.errorText
											: c.textTertiary
								}
								style={s.lineIcon}
							/>
							<Text variant="bodySm" style={s.lineText}>
								{line.text}
							</Text>
						</View>
					)
				})}
			</View>

			<Button label="Got it" size="lg" fullWidth onPress={onClose} />
		</View>
	)
}

const s = StyleSheet.create({
	body: { paddingHorizontal: 24, gap: 18, paddingTop: 4 },
	head: { gap: 10 },
	titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	title: { flex: 1 },
	track: { height: BAR, borderRadius: BAR / 2, overflow: 'hidden' },
	fill: { height: BAR, borderRadius: BAR / 2 },
	lines: { gap: 12 },
	line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
	lineIcon: { marginTop: 2 },
	lineText: { flex: 1 }
})
