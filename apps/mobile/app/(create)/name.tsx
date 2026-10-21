/**
 * Create · Name — step 2 of 3: the pet you just chose, a name field and three
 * name ideas from its fur (docs/application/UI/kinpaw-screen-spec-v1.md,
 * "Create · Name"). Tapping an idea fills the field, and the pet likes its name.
 */
import { useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Dices } from 'lucide-react-native'
import { nameIdeas, optionLabel, PET_NAME_MAX, petNameSchema } from '@app/contract'
import { useMountEffect } from '@/hooks/useMountEffect'
import { PressableScale } from '@/components/motion/PressableScale'
import { OnboardingShell } from '@/components/onboarding/Shell'
import { PetArt } from '@/components/pet/PetArt'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { IconButton } from '@/components/ui/IconButton'
import { Glow } from '@/components/ui/Marks'
import { Text } from '@/components/ui/Text'
import TextInputField from '@/components/ui/TextInputField'
import { usePetDraft } from '@/contexts/PetDraftContext'
import { useTheme } from '@/contexts/ThemeContext'
import { track } from '@/lib/analytics'
import { goBackTo, goToStep } from '@/lib/createFlow'
import { haptic } from '@/lib/haptics'
import { draftAppearance, newPetDraft } from '@/lib/petDraft'

const STEP_INDEX = 1
const STEP_COUNT = 3
const PET_SIZE = 200
const IDEA_COUNT = 3
/** How long the pet looks happy after an idea is picked, ms. */
const FLASH_MS = 700

export default function NameScreen() {
	const { draft: stored, update } = usePetDraft()
	const draft = stored ?? newPetDraft()
	const appearance = draftAppearance(draft)
	const [name, setName] = useState(draft.name)
	const [ideas, setIdeas] = useState(() => nameIdeas(appearance, IDEA_COUNT))
	// The idea the field holds, until the person types over it.
	const [picked, setPicked] = useState<string | null>(null)
	const [happy, setHappy] = useState(false)
	const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const valid = petNameSchema.safeParse(name)

	useMountEffect(() => {
		update({ step: 'name' })
		track('onboarding_step_viewed', { step: 'name', index: STEP_INDEX })
		return () => {
			if (flashTimer.current) clearTimeout(flashTimer.current)
		}
	})

	function changeName(next: string) {
		setName(next)
		if (next !== picked) setPicked(null)
		update({ name: next })
	}

	function pickIdea(idea: string) {
		haptic.select()
		setName(idea)
		setPicked(idea)
		update({ name: idea })
		setHappy(true)
		if (flashTimer.current) clearTimeout(flashTimer.current)
		flashTimer.current = setTimeout(() => setHappy(false), FLASH_MS)
		track('pet_name_idea_tapped', { fur: appearance.fur })
	}

	function moreIdeas() {
		// A different three when the fur has them (each fur has five).
		let next = nameIdeas(appearance, IDEA_COUNT)
		for (let tries = 0; tries < 5 && next.join() === ideas.join(); tries++) {
			next = nameIdeas(appearance, IDEA_COUNT)
		}
		setIdeas(next)
	}

	function proceed() {
		if (!valid.success) return
		update({ name: valid.data })
		track('pet_name_submitted', {
			name_length: valid.data.length,
			from_idea: picked !== null && picked === valid.data
		})
		goToStep('personality')
	}

	const fur = optionLabel('fur', appearance.fur, appearance.species).toLowerCase()

	return (
		<OnboardingShell
			step={STEP_INDEX}
			total={STEP_COUNT}
			onBack={() => goBackTo('build')}
			cta={{
				label: 'Continue',
				onPress: proceed,
				refusal: valid.success ? null : 'Give them a name first.'
			}}
		>
			<View style={s.titles}>
				<Eyebrow>{`Step ${STEP_INDEX + 1} of ${STEP_COUNT}`}</Eyebrow>
				<Text variant="question" accessibilityRole="header">
					What&apos;s their name?
				</Text>
			</View>

			<View style={s.stage}>
				<Glow size={PET_SIZE * 1.5} strength={0.8} style={s.glow} />
				<PetArt appearance={appearance} mood={happy ? 'happy' : 'content'} size={PET_SIZE} />
			</View>

			<TextInputField
				label="Name"
				value={name}
				onChangeText={changeName}
				placeholder="Mochi"
				accessibilityLabel="Your pet's name"
				autoCapitalize="words"
				autoCorrect={false}
				maxLength={PET_NAME_MAX}
				returnKeyType="next"
				onSubmitEditing={proceed}
				autoFocus
				trailing={
					<Text
						variant="caption"
						tone="tertiary"
						accessibilityLabel={`${name.length} of ${PET_NAME_MAX} characters`}
					>
						{`${name.length}/${PET_NAME_MAX}`}
					</Text>
				}
			/>

			<View style={s.ideas}>
				<Text variant="caption" tone="secondary">
					{`Ideas for a ${fur} ${appearance.species}`}
				</Text>
				<View style={s.ideaRow}>
					<View style={s.chips} accessibilityRole="radiogroup" accessibilityLabel="Name ideas">
						{ideas.map((idea) => (
							<IdeaChip
								key={idea}
								idea={idea}
								selected={picked === idea}
								onPress={() => pickIdea(idea)}
							/>
						))}
					</View>
					<IconButton
						icon={(color) => <Dices size={20} color={color} strokeWidth={2} />}
						onPress={moreIdeas}
						accessibilityLabel="More name ideas"
						size={44}
						haptic="select"
					/>
				</View>
			</View>
		</OnboardingShell>
	)
}

function IdeaChip({
	idea,
	selected,
	onPress
}: {
	idea: string
	selected: boolean
	onPress: () => void
}) {
	const { colors: c } = useTheme()
	return (
		<PressableScale
			onPress={onPress}
			haptic={false}
			accessibilityRole="radio"
			accessibilityLabel={idea}
			accessibilityState={{ selected }}
			style={[
				s.chip,
				{
					backgroundColor: selected ? c.brandDim : c.surface2,
					borderColor: selected ? c.brandInk : c.borderSoft,
					borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth
				}
			]}
		>
			<Text
				variant="label"
				numberOfLines={1}
				maxFontSizeMultiplier={1.3}
				style={{ color: selected ? c.brandInk : c.textPrimary }}
			>
				{idea}
			</Text>
		</PressableScale>
	)
}

const s = StyleSheet.create({
	titles: { gap: 10 },
	stage: { alignItems: 'center', justifyContent: 'center' },
	glow: { position: 'absolute' },
	ideas: { gap: 10 },
	ideaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	chip: { height: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center' }
})
