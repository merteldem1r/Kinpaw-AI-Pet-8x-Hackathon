/**
 * Create · Personality — step 3 of 3: one tap on a preset is enough
 * (docs/application/UI/kinpaw-screen-spec-v1.md, "Create · Personality").
 * Choosing a preset sets all six traits from it; the optional fine-tune sheet
 * adjusts them one by one, and picking a preset again resets them.
 *
 * Fine-tuned traits are their own choice: the presets all go unselected (the
 * one it started from says "Your base"), and the fine-tune row becomes the
 * selected "Your own mix" card.
 *
 * The personality also picks the pet's voice (v2 voice): tapping one, even the one already
 * chosen, has the pet say a short line in it, from a clip shipped in the app.
 */
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { ChevronRight, SlidersHorizontal } from 'lucide-react-native'
import { hasCustomTraits, PRESETS, presetTraits, type PresetId } from '@app/contract'
import { useMountEffect } from '@/hooks/useMountEffect'
import { PressableScale } from '@/components/motion/PressableScale'
import { OnboardingShell } from '@/components/onboarding/Shell'
import { FineTuneSheet } from '@/components/pet/FineTuneSheet'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { SelectionRow } from '@/components/ui/SelectionRow'
import { Text } from '@/components/ui/Text'
import { usePetDraft } from '@/contexts/PetDraftContext'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { goBackTo, goToStep } from '@/lib/createFlow'
import { newPetDraft } from '@/lib/petDraft'
import { SpeakingBars } from '@/components/voice/SpeakingBars'
import { playVoiceSample, stopVoice, useVoiceSpeaking } from '@/lib/petVoice'

const presetTitle = (id: PresetId) => PRESETS.find((preset) => preset.id === id)?.title ?? id

const STEP_INDEX = 2
const STEP_COUNT = 3

export default function PersonalityScreen() {
	const { draft: stored, update } = usePetDraft()
	const draft = stored ?? newPetDraft()
	const name = draft.name.trim() || 'your pet'
	const [fineTuning, setFineTuning] = useState(false)
	const custom = hasCustomTraits(draft.preset, draft.traits)
	const { colors: c, radii } = useTheme()
	// Which personality's line is playing, for its row to show it.
	const speaking = useVoiceSpeaking()

	useMountEffect(() => {
		update({ step: 'personality' })
		track('onboarding_step_viewed', { step: 'personality', index: STEP_INDEX })
		// Leaving quiets a line still playing (Meet says its own).
		return () => stopVoice()
	})

	function choose(preset: PresetId) {
		void playVoiceSample('personality', draft.species, preset, { asked: true })
		// The same preset again resets fine-tuned traits too.
		if (preset === draft.preset && !custom) return
		update({ preset, traits: presetTraits(preset) })
		track('pet_preset_selected', { preset })
	}

	return (
		<OnboardingShell
			step={STEP_INDEX}
			total={STEP_COUNT}
			onBack={() => goBackTo('name')}
			cta={{ label: `Meet ${name}`, onPress: () => goToStep('meet') }}
		>
			<View style={s.titles}>
				<Eyebrow>{`Step ${STEP_INDEX + 1} of ${STEP_COUNT}`}</Eyebrow>
				<Text variant="question" accessibilityRole="header">
					{`What's ${name} like?`}
				</Text>
				<Text variant="body" tone="secondary">
					Pick a starting point. You can fine-tune it.
				</Text>
				<Text variant="bodySm" tone="tertiary">
					{`It shapes ${name}'s voice too. Tap one to hear it.`}
				</Text>
			</View>

			<View style={s.options} accessibilityRole="radiogroup">
				{PRESETS.map((preset) => {
					const base = custom && draft.preset === preset.id
					const talking = speaking === `personality:${preset.id}`
					return (
						<SelectionRow
							key={preset.id}
							title={preset.title}
							subtitle={preset.description}
							selected={!custom && draft.preset === preset.id}
							trailing={
								talking ? (
									<SpeakingBars name={name} />
								) : base ? (
									<Text variant="caption" tone="tertiary">
										Your base
									</Text>
								) : undefined
							}
							accessibilityLabel={base ? `${preset.title}, your base` : preset.title}
							onPress={() => choose(preset.id)}
						/>
					)
				})}
			</View>

			{custom ? (
				<SelectionRow
					title="Your own mix"
					subtitle={`Fine-tuned from ${presetTitle(draft.preset)}. Tap to adjust.`}
					selected
					leading={<SlidersHorizontal size={20} color={c.brandInk} strokeWidth={2} />}
					accessibilityLabel="Your own mix, fine-tuned traits"
					onPress={() => setFineTuning(true)}
				/>
			) : (
				<PressableScale
					onPress={() => setFineTuning(true)}
					scaleTo="card"
					haptic="select"
					accessibilityRole="button"
					accessibilityLabel="Fine-tune traits, optional"
					style={[
						s.fineTune,
						{ borderRadius: radii.card, backgroundColor: c.surface, borderColor: c.borderSoft }
					]}
				>
					<SlidersHorizontal size={20} color={c.brandInk} strokeWidth={2} />
					<Text variant="label" tone="brand" style={s.fineTuneLabel}>
						Fine-tune traits
					</Text>
					<Text variant="caption" tone="tertiary">
						Optional
					</Text>
					<ChevronRight size={18} color={c.textTertiary} strokeWidth={2} />
				</PressableScale>
			)}

			<FineTuneSheet
				open={fineTuning}
				onClose={() => setFineTuning(false)}
				name={draft.name.trim() || 'your pet'}
				preset={draft.preset}
				traits={draft.traits}
				onChange={(traits) => update({ traits })}
			/>
		</OnboardingShell>
	)
}

const s = StyleSheet.create({
	titles: { gap: 10 },
	options: { gap: 10 },
	fineTune: {
		height: 56,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingHorizontal: 18,
		borderWidth: StyleSheet.hairlineWidth
	},
	fineTuneLabel: { flex: 1 }
})
