import {
	appearanceKey,
	endpoints,
	hasCustomTraits,
	matchLook,
	optionLabel,
	premiumOptionsIn,
	type PetAppearance
} from '@app/contract'
import { PET_EVENTS } from '@/lib/analytics/events'
import { recordUserEvent } from '@/lib/analytics/record'
import { ApiError, invalidInput } from '@/server/api/app-errors'
import { createAppRoute } from '@/server/api/app-route'
import { toWirePet } from '@/server/api/pet-wire'
import { introStore } from '@/server/db/intro'
import { petStore } from '@/server/db/pets'
import { profileStore } from '@/server/db/profiles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/app/v1/pet: the signed-in person's pet, or `{ pet: null }` before they save one. With a
 * pet, `intro_due` says whether "Tell me about you" is still open for it (v2-memory-requirements.md,
 * R18): the app opens the step after sign-in, or offers it once to a pet from before it.
 */
export const GET = createAppRoute(endpoints.getPet, async ({ user }) => {
	const pet = await petStore.get(user.id)
	if (!pet) return { body: { pet: null } }
	const due = await introStore.due(user.id)
	return { body: { pet: toWirePet(pet), ...(due !== null && { intro_due: due }) } }
})

/**
 * POST /api/app/v1/pet: save the pet made on the phone (docs/application/features/
 * m4-save-your-pet-requirements.md, R3). The owner is the verified caller; the contract refuses
 * any other field, and checks the catalog (a valid appearance, a look that is that appearance, a
 * 1–20 character name, traits 1–10).
 *
 * - 201: saved now; `pet_created` is recorded first-party.
 * - 200: a retry of the same save (same id), or the account already has a different pet, which
 *   wins (`existing: true`); nothing is written and nothing recorded.
 * - 400: an appearance with a Plus option (a Plus look is built from one) from an account that
 *   isn't premium. The server decides, from `profiles.plan_type`; the app never offers one
 *   during onboarding anyway. Also 400: a `look_id` that isn't exactly the appearance (the
 *   contract).
 * - 409: the id is someone else's pet.
 */
export const POST = createAppRoute(endpoints.createPet, async ({ user, body }) => {
	await refusePlusOptionsUnlessPremium(user.id, body.appearance)

	const result = await petStore.create(user.id, {
		id: body.id,
		appearance: body.appearance,
		look: body.look_id,
		name: body.name,
		preset: body.preset,
		traits: body.traits
	})
	if (result.outcome === 'conflict') {
		throw new ApiError('conflict', 'That pet belongs to someone else.')
	}

	if (result.outcome === 'created') {
		await recordUserEvent(user.id, PET_EVENTS.petCreated, {
			path: '/api/app/v1/pet',
			metadata: {
				species: body.appearance.species,
				look_id: body.look_id ?? 'custom',
				appearance_key: appearanceKey(body.appearance),
				preset: body.preset,
				custom_traits: hasCustomTraits(body.preset, body.traits)
			},
			dedupeForever: true
		})
	}

	return {
		body: { pet: toWirePet(result.row), existing: result.outcome === 'existing' },
		status: result.outcome === 'created' ? 201 : 200
	}
})

/**
 * PATCH /api/app/v1/pet: Change look, from the pet's details (docs/application/features/
 * m7-plus-profile-settings-requirements.md, R14). The appearance only; the needs, name and
 * personality are untouched.
 *
 * - 200: saved; `look_id` is the ready-made look the appearance now is exactly, or null.
 * - 400: a Plus option from an account that isn't premium (as on creation), or another species
 *   than the pet's from an account that isn't premium. A free pet keeps its species; a Plus
 *   member's can change, from a photo of another species (v2-pet-from-photo-requirements.md,
 *   R28). Decided here from the profile, never from the app.
 * - 404: no pet yet.
 */
export const PATCH = createAppRoute(endpoints.updatePet, async ({ user, body }) => {
	const current = await petStore.get(user.id)
	if (!current) throw new ApiError('not_found', 'There is no pet to change yet.')
	if (body.appearance.species !== current.species && !(await profileStore.isPremium(user.id))) {
		throw invalidInput({ path: 'appearance.species', message: 'A pet keeps its species.' })
	}
	await refusePlusOptionsUnlessPremium(user.id, body.appearance)

	const row = await petStore.updateAppearance(
		user.id,
		body.appearance,
		matchLook(body.appearance)?.id ?? null
	)
	if (!row) throw new ApiError('not_found', 'There is no pet to change yet.')
	return { body: { pet: toWirePet(row) } }
})

/**
 * A Plus option (and so a Plus look) needs a premium account. The server decides, from
 * `profiles.plan_type`; the app only offers what it shows as unlocked.
 */
async function refusePlusOptionsUnlessPremium(userId: string, appearance: PetAppearance) {
	const plus = premiumOptionsIn(appearance)
	if (plus.length === 0 || (await profileStore.isPremium(userId))) return
	throw invalidInput(
		...plus.map(({ key, id }) => ({
			path: `appearance.${key}`,
			message: `${optionLabel(key, id, appearance.species)} comes with Kinpaw Plus.`
		}))
	)
}
