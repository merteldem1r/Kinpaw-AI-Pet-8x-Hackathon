/**
 * Create · Start (docs/application/UI/kinpaw-screen-spec-v1.md): step 1 opens on
 * a choice: a pet drawn from a photo of your own (v2-pet-from-photo-requirements.md, R1–R3),
 * or one you make yourself. Cat / Dog swaps the art on both cards and carries into Make your
 * own; a photo decides its own species. Choose a friend was removed on 2026-10-04.
 */
import { memo, useCallback, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import type { Species } from '@app/contract'
import { useMountEffect } from '@/hooks/useMountEffect'
import { BuiltStage } from '@/components/onboarding/BuiltStage'
import { PathCard, SHEEN_OFFSET_MS } from '@/components/onboarding/PathCard'
import { OnboardingShell } from '@/components/onboarding/Shell'
import { PhotoPathStage } from '@/components/pet/PhotoPathStage'
import { PhotoSheet } from '@/components/pet/PhotoSheet'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Text } from '@/components/ui/Text'
import { TextLink } from '@/components/ui/TextLink'
import { usePetDraft, usePetDraftActions } from '@/contexts/PetDraftContext'
import { track } from '@/lib/analytics'
import { goBackTo } from '@/lib/createFlow'
import { photoTriesLeft, resetPhotoTriesForDev } from '@/lib/installId'
import { newPetDraft } from '@/lib/petDraft'
import { startPhotoSession, type PickedPhoto } from '@/lib/petPhoto'

const STEP_INDEX = 0
const STEP_COUNT = 3

export default function StartScreen() {
	const { draft: stored, start, update } = usePetDraft()
	const species = (stored ?? newPetDraft()).species

	useMountEffect(() => {
		// Opened without a draft (a deep link): start one, so the steps have somewhere to write.
		if (!stored) start()
		update({ step: 'start' })
		track('onboarding_step_viewed', { step: 'start', index: STEP_INDEX })
	})

	return <StartBody species={species} />
}

/**
 * The screen, apart from the draft: it redraws when the species changes, not on every change to
 * the draft (Start stays mounted under Make your own, whose every tap changes the draft).
 */
const StartBody = memo(function StartBody({ species }: { species: Species }) {
	const { update } = usePetDraftActions()

	function chooseSpecies(next: Species) {
		if (next === species) return
		update({ species: next })
		track('pet_species_selected', { species: next })
	}

	// The phone's photo tries, as last told by the server: re-read each time Start shows.
	const [triesLeft, setTriesLeft] = useState<number | null>(null)
	const [sheetOpen, setSheetOpen] = useState(false)
	useFocusEffect(
		useCallback(() => {
			void photoTriesLeft().then(setTriesLeft)
		}, [])
	)
	const usedUp = triesLeft === 0

	function fromPhoto() {
		track('pet_create_path_selected', { path: 'photo', species })
		if (usedUp) router.push({ pathname: '/photo', params: { tries: 'none' } })
		else setSheetOpen(true)
	}

	function photoPicked(photo: PickedPhoto) {
		setSheetOpen(false)
		startPhotoSession(photo)
		router.push('/photo')
	}

	function makeYourOwn() {
		track('pet_create_path_selected', { path: 'build', species })
		router.push({ pathname: '/build', params: { from: 'start' } })
	}

	return (
		<OnboardingShell step={STEP_INDEX} total={STEP_COUNT} onBack={() => goBackTo(null)}>
			<View style={s.titles}>
				<Eyebrow>{`Step ${STEP_INDEX + 1} of ${STEP_COUNT}`}</Eyebrow>
				<Text variant="question" accessibilityRole="header">
					Who&apos;s coming home with you?
				</Text>
			</View>

			<SegmentedControl<Species>
				accessibilityLabel="Cat or dog"
				value={species}
				onChange={chooseSpecies}
				segments={[
					{ value: 'cat', label: 'Cat' },
					{ value: 'dog', label: 'Dog' }
				]}
			/>

			<PathCard
				title="From a photo"
				line={usedUp ? 'No photo tries left on this phone.' : "Show us your pet. We'll draw it."}
				onPress={fromPhoto}
				featured
				orbit
				badge="Your real pet"
				stage={<PhotoPathStage species={species} />}
			/>
			<PathCard
				title="Make your own"
				line="Pick the fur, eyes, ears and tail."
				onPress={makeYourOwn}
				featured
				sheenDelay={SHEEN_OFFSET_MS}
				badge="One of a kind"
				stage={<BuiltStage species={species} />}
			/>
			{/* DEV ONLY, TEMPORARY (2026-10-06): give this phone its photo tries back. Delete with
			    resetPhotoTriesForDev (lib/installId.ts). */}
			{__DEV__ ? (
				<TextLink
					label="Dev: reset photo tries"
					tone="tertiary"
					onPress={() =>
						void resetPhotoTriesForDev().then(() => photoTriesLeft().then(setTriesLeft))
					}
				/>
			) : null}
			<PhotoSheet
				open={sheetOpen}
				onClose={() => setSheetOpen(false)}
				context="create"
				triesLeft={triesLeft ?? undefined}
				onPicked={photoPicked}
			/>
		</OnboardingShell>
	)
})

const s = StyleSheet.create({
	titles: { gap: 10 }
})
