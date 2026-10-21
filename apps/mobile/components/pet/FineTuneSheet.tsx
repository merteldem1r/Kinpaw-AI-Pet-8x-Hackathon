import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import {
	hasCustomTraits,
	presetById,
	TRAIT_DOTS,
	TRAITS,
	type PresetId,
	type Trait,
	type Traits
} from '@app/contract'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Text } from '@/components/ui/Text'
import { useTheme } from '@/contexts/ThemeContext'
import { useLatest } from '@/hooks/useLatest'
import { track } from '@/lib/analytics'
import { TRAIT_BAR_START, TraitBar } from './TraitBar'

/** A stored trait (1–10) as dots (1–5): a dot is two points. */
const toDots = (value: number) => Math.round(value / 2)

/**
 * The fine-tune sheet (docs/application/UI/kinpaw-screen-spec-v1.md,
 * "Fine-tune sheet"): six traits as five-segment bars, each in its own colour,
 * starting from the preset.
 * Every combination is allowed. Each change is kept at once (the parent writes
 * the draft); Done, a drag down or the backdrop all close and keep it.
 */
export function FineTuneSheet({
	open,
	onClose,
	name,
	preset,
	traits,
	onChange
}: {
	open: boolean
	onClose: () => void
	name: string
	preset: PresetId
	traits: Traits
	onChange: (traits: Traits) => void
}) {
	const { colors: c } = useTheme()
	// The traits as the sheet opened, so closing can say how many changed.
	const opened = useRef<Traits>(traits)
	// Read on opening, not followed: the traits change while it is open.
	const latest = useLatest({ traits, preset })

	useEffect(() => {
		if (open) {
			opened.current = latest.current.traits
			track('pet_finetune_opened', { preset: latest.current.preset })
		}
	}, [open, latest])

	function close() {
		track('pet_finetune_closed', {
			changed_count: TRAITS.filter((trait) => traits[trait] !== opened.current[trait]).length
		})
		onClose()
	}

	function setTrait(trait: Trait, dots: number) {
		onChange({ ...traits, [trait]: dots * 2 })
		track('pet_trait_changed', { trait, level: dots })
	}

	const from = presetById(preset).title
	return (
		<Sheet open={open} onClose={close}>
			<View style={s.body}>
				<View style={s.head}>
					<Text variant="h3" accessibilityRole="header">
						{`Fine-tune ${name}`}
					</Text>
					<Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">
						{hasCustomTraits(preset, traits) ? `Custom, from ${from}` : `Starting from ${from}`}
					</Text>
				</View>

				<View style={s.legend} importantForAccessibility="no-hide-descendants">
					<Text variant="caption" tone="tertiary">
						Less
					</Text>
					<Text variant="caption" tone="tertiary">
						More
					</Text>
				</View>

				<View>
					{TRAITS.map((trait, i) => (
						<View
							key={trait}
							style={
								i < TRAITS.length - 1 && {
									borderBottomWidth: StyleSheet.hairlineWidth,
									borderBottomColor: c.borderHairline
								}
							}
						>
							<TraitBar
								trait={trait}
								level={Math.min(TRAIT_DOTS, Math.max(1, toDots(traits[trait])))}
								onChange={(dots) => setTrait(trait, dots)}
							/>
						</View>
					))}
				</View>

				<Text variant="caption" tone="tertiary">
					{`These shape how ${name} talks and reacts. Any mix is fine.`}
				</Text>

				<Button label="Done" size="lg" fullWidth onPress={close} />
			</View>
		</Sheet>
	)
}

const s = StyleSheet.create({
	body: { paddingHorizontal: 24, gap: 18, paddingTop: 4 },
	head: { gap: 4 },
	legend: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginLeft: TRAIT_BAR_START,
		marginBottom: -10
	}
})
