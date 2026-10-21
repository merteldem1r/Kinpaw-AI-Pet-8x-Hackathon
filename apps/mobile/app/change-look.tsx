/**
 * Change look (M7, docs/application/features/m7-plus-profile-settings-requirements.md,
 * R14–R15): the builder on the pet's own appearance, opened from its details page. A free
 * account's Plus option opens Kinpaw Plus (unlike onboarding, where it only explains); a Plus
 * member picks it like any other. Saving sends the appearance to PATCH /api/app/v1/pet, which
 * decides again, from the plan, whether it may.
 *
 * Above the builder, "Redo from a photo" (v2-pet-from-photo-requirements.md, R26–R29): Plus, once
 * a day. The look read from the photo lands in the editor unsaved, with the photo small on the
 * stage; only a photo can change the species, and only for Plus (the server checks).
 */
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
	appearanceKey,
	matchLook,
	randomAppearance,
	usesPremium,
	withAttribute,
	type AttributeKey,
	type AttributeOption,
	type Pet,
	type PetAppearance
} from '@app/contract'
import { PetBuilder } from '@/components/pet/PetBuilder'
import { RedoFromPhoto } from '@/components/pet/RedoFromPhoto'
import { QueryErrorState } from '@/components/QueryError'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Screen } from '@/components/ui/Screen'
import { Skeleton } from '@/components/ui/Skeleton'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/contexts/ToastContext'
import { PET_QUERY_KEY, usePet } from '@/hooks/usePet'
import { useMountEffect } from '@/hooks/useMountEffect'
import { usePlus } from '@/hooks/usePlus'
import { track } from '@/lib/analytics'
import { api, errorMessage } from '@/lib/api'
import { APP_NAME } from '@/lib/constants'
import { haptic } from '@/lib/haptics'
import { openPaywall } from '@/lib/openPaywall'
import { changedCount } from '@/lib/petPhoto'

export default function ChangeLookScreen() {
	const petQuery = usePet()
	const pet = petQuery.data

	return (
		<Screen header={<PageHeader title={pet ? `${pet.name}'s look` : 'Change look'} />} gap={16}>
			{pet ? (
				<Editor pet={pet} />
			) : petQuery.isError ? (
				<QueryErrorState
					error={petQuery.error}
					title="Couldn't load your pet"
					onRetry={() => petQuery.refetch()}
				/>
			) : (
				<Skeleton width="100%" height={280} />
			)}
		</Screen>
	)
}

function Editor({ pet }: { pet: Pet }) {
	const plus = usePlus()
	const queryClient = useQueryClient()
	const { showToast } = useToast()
	const { layout } = useTheme()
	// The look being made; starts as the pet's own. Its species changes only by a photo (Plus).
	const [appearance, setAppearance] = useState<PetAppearance>(pet.appearance)
	const species = appearance.species
	const [status, setStatus] = useState<string | null>(null)
	// The photo the look was read from, and the pet as read, until saved or undone.
	const [photo, setPhoto] = useState<{ uri: string; read: PetAppearance } | null>(null)
	const changed = appearanceKey(appearance) !== appearanceKey(pet.appearance)

	useMountEffect(() => {
		track('pet_look_change_opened', { species })
	})

	const save = useMutation({
		mutationFn: (next: PetAppearance) => api('updatePet', { body: { appearance: next } }),
		onSuccess: ({ pet: saved }) => {
			queryClient.setQueryData(PET_QUERY_KEY, saved)
			haptic.success()
			track('pet_look_changed', {
				species,
				preset_id: saved.look_id ?? 'custom',
				appearance_key: appearanceKey(saved.appearance),
				plus: usesPremium(saved.appearance)
			})
			if (photo) {
				track('pet_photo_kept', {
					context: 'redo',
					changed_count: changedCount(photo.read, saved.appearance)
				})
			}
			showToast(`${pet.name} has a new look`, 'success')
			router.back()
		},
		onError: (error) => {
			haptic.warning()
			setStatus(errorMessage(error))
		}
	})

	/** A free account's Plus option opens Kinpaw Plus; anything else is applied at once. */
	function pick(option: AttributeOption, key: AttributeKey): boolean {
		if (option.premium) {
			haptic.warning()
			setStatus(`${option.label} comes with ${APP_NAME} Plus.`)
			track('pet_option_locked_tapped', {
				attribute: key,
				option: option.id,
				during_onboarding: false
			})
			openPaywall('locked_look')
			return false
		}
		setStatus(null)
		setAppearance((current) => withAttribute(current, key, option.id))
		track('pet_attribute_changed', { attribute: key, option: option.id })
		return true
	}

	function surprise() {
		setStatus(null)
		setAppearance(randomAppearance(species, { includePremium: plus }))
		track('pet_surprise_tapped', { species })
	}

	const look = matchLook(appearance)
	return (
		<>
			<RedoFromPhoto
				petName={pet.name}
				species={species}
				plus={plus}
				current={appearance}
				onStatus={setStatus}
				onApply={(next, uri, read) => {
					haptic.success()
					setAppearance(next)
					setPhoto({ uri, read })
					setStatus("Made from your photo. Change anything that's off, then save.")
				}}
			/>
			<PetBuilder
				appearance={appearance}
				status={status ?? (changed ? (look ? `This is the ${look.name} look.` : null) : null)}
				unlocked={plus}
				onPick={pick}
				onSurprise={surprise}
				onTabChange={() => setStatus(null)}
				photoUri={photo?.uri}
			/>
			<View style={[s.actions, { paddingHorizontal: layout.gutter / 2 }]}>
				<Button
					label={save.isPending ? 'Saving…' : `Save ${pet.name}'s look`}
					size="lg"
					fullWidth
					loading={save.isPending}
					disabled={!changed}
					onPress={() => save.mutate(appearance)}
				/>
				{changed ? (
					<Button
						label="Undo changes"
						variant="ghost"
						size="sm"
						disabled={save.isPending}
						onPress={() => {
							setStatus(null)
							setPhoto(null)
							setAppearance(pet.appearance)
						}}
					/>
				) : null}
			</View>
		</>
	)
}

const s = StyleSheet.create({
	actions: { gap: 6, alignItems: 'center' }
})
