/**
 * Create · Make your own (docs/application/UI/kinpaw-screen-spec-v1.md; features/
 * m4b-pet-builder-requirements.md, R8–R9): the pet large on a night stage, six
 * attribute tabs, one row of choices, and Surprise me. Every change
 * shows at once and the pet looks happy for a moment. Opened blank (a random
 * free pet) from Start, or on the pet read from a photo ("Adjust the look", v2-pet-from-photo-
 * requirements.md, R14), with the photo small on the stage to compare.
 */
import { useState } from 'react'
import { useLocalSearchParams } from 'expo-router'
import {
	randomAppearance,
	withAttribute,
	type AttributeKey,
	type AttributeOption
} from '@app/contract'
import { useMountEffect } from '@/hooks/useMountEffect'
import { OnboardingShell } from '@/components/onboarding/Shell'
import { PetBuilder } from '@/components/pet/PetBuilder'
import { Text } from '@/components/ui/Text'
import { usePetDraft } from '@/contexts/PetDraftContext'
import { track } from '@/lib/analytics'
import { APP_NAME } from '@/lib/constants'
import { goBackTo, goToStep } from '@/lib/createFlow'
import { haptic } from '@/lib/haptics'
import { draftAppearance, newPetDraft } from '@/lib/petDraft'
import { changedCount, endPhotoSession, photoSession } from '@/lib/petPhoto'

const STEP_INDEX = 0
const STEP_COUNT = 3
const FROM_PHOTO_NOTE = "Made from your photo. Change anything that's off."

type BuildFrom = 'start' | 'photo'

export default function BuildScreen() {
	const params = useLocalSearchParams<{ from?: string }>()
	const from: BuildFrom = params.from === 'photo' ? 'photo' : 'start'
	// What a pick says ("Tortie is a Plus option…"), above Continue where it is always in view.
	const [status, setStatus] = useState<string | null>(from === 'photo' ? FROM_PHOTO_NOTE : null)
	const { draft } = usePetDraft()

	function proceed() {
		// The photo is let go on the way to Name (R18); what changed after the read is counted.
		const read = photoSession()?.read
		if (from === 'photo' && read && draft) {
			track('pet_photo_kept', {
				context: 'create',
				changed_count: changedCount(read, draftAppearance(draft))
			})
		}
		endPhotoSession()
		goToStep('name')
	}

	return (
		<OnboardingShell
			step={STEP_INDEX}
			total={STEP_COUNT}
			onBack={() => goBackTo('start')}
			cta={{ label: 'Continue', onPress: proceed, note: status }}
		>
			<Text variant="question" accessibilityRole="header">
				Make your own
			</Text>
			<BuildPanel from={from} setStatus={setStatus} />
		</OnboardingShell>
	)
}

/**
 * The part that reads the draft. Apart from the screen, so a tap redraws the pet and its
 * options, not the shell, header and Continue around them.
 */
function BuildPanel({
	from,
	setStatus
}: {
	from: BuildFrom
	setStatus: (status: string | null) => void
}) {
	const { draft: stored, start, update } = usePetDraft()
	const draft = stored ?? newPetDraft()
	const species = draft.species
	const appearance = draftAppearance(draft)

	useMountEffect(() => {
		// Opened without a draft (a deep link): start one, so the step has somewhere to write.
		const current = stored ?? start()
		// From Start, a pet that wasn't being built starts blank: a random free pet. Back from
		// Name, a relaunch, or a photo's pet keep the pet that is there.
		const blank = from === 'start' && current.path !== 'build'
		update({
			step: 'build',
			path: from === 'photo' ? 'photo' : 'build',
			...(blank
				? {
						appearances: {
							...current.appearances,
							[current.species]: randomAppearance(current.species)
						}
					}
				: {})
		})
		track('onboarding_step_viewed', { step: 'build', index: STEP_INDEX })
		track('pet_builder_viewed', { from, species: current.species })
	})

	/** During onboarding a Plus option only explains: no paywall before the first conversation. */
	function pick(option: AttributeOption, key: AttributeKey): boolean {
		if (option.premium) {
			haptic.warning()
			setStatus(`${option.label} is a Plus option. It comes with ${APP_NAME} Plus.`)
			track('pet_option_locked_tapped', {
				attribute: key,
				option: option.id,
				during_onboarding: true
			})
			return false
		}
		setStatus(null)
		update({
			appearances: { ...draft.appearances, [species]: withAttribute(appearance, key, option.id) }
		})
		track('pet_attribute_changed', { attribute: key, option: option.id })
		return true
	}

	function surprise() {
		setStatus(null)
		update({ appearances: { ...draft.appearances, [species]: randomAppearance(species) } })
		track('pet_surprise_tapped', { species })
	}

	return (
		<PetBuilder
			appearance={appearance}
			onPick={pick}
			onSurprise={surprise}
			onTabChange={() => setStatus(null)}
			photoUri={from === 'photo' ? photoSession()?.photo.uri : undefined}
		/>
	)
}
