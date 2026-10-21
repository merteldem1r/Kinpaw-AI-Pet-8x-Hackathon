import { z } from 'zod'
import { appearanceKey, appearanceSchema, lookById, lookIdSchema } from './appearance'
import { actionSchema, storedNeedsSchema, timeZoneSchema } from './needs'

// The pet catalog beyond its looks (those are ./appearance.ts): names, the six
// personality traits and the presets. The app uses it to create a pet (M3); the
// server validates a saved pet against the same lists (M4). Ids are stable: they
// are stored, sent and tracked, so a preset is renamed by its `title`, never its
// id (docs/application/UI/kinpaw-screen-spec-v1.md, "Create · Personality").

/** A pet's name: 1–20 characters once trimmed (Create · Name). */
export const PET_NAME_MAX = 20
export const petNameSchema = z.string().trim().min(1).max(PET_NAME_MAX)

export const TRAITS = [
	'affection',
	'playfulness',
	'energy',
	'curiosity',
	'loyalty',
	'independence'
] as const
export const traitSchema = z.enum(TRAITS)
export type Trait = z.infer<typeof traitSchema>

/** A trait is stored 1–10; the app shows it as 1–5 dots (stored = dots × 2). */
export const TRAIT_MIN = 1
export const TRAIT_MAX = 10
export const traitsSchema = z.object(
	Object.fromEntries(
		TRAITS.map((trait) => [trait, z.number().int().min(TRAIT_MIN).max(TRAIT_MAX)])
	) as Record<Trait, z.ZodNumber>
)
export type Traits = Record<Trait, number>

export const PRESET_IDS = ['cuddly', 'curious', 'cool', 'loyal'] as const
export const presetIdSchema = z.enum(PRESET_IDS)
export type PresetId = z.infer<typeof presetIdSchema>

export type Preset = {
	id: PresetId
	title: string
	description: string
	/** As shown, 1–5 dots. */
	dots: Record<Trait, number>
}

export const PRESETS: readonly Preset[] = [
	{
		id: 'cuddly',
		title: 'Cuddly homebody',
		description: 'Loves laps, naps and you.',
		dots: { affection: 5, playfulness: 2, energy: 2, curiosity: 3, loyalty: 4, independence: 2 }
	},
	{
		id: 'curious',
		title: 'Curious rascal',
		description: 'Into everything. Asks a lot of questions.',
		dots: { affection: 3, playfulness: 4, energy: 4, curiosity: 5, loyalty: 3, independence: 3 }
	},
	{
		id: 'cool',
		title: 'Cool and independent',
		description: 'Loves you, on its own terms.',
		dots: { affection: 3, playfulness: 2, energy: 3, curiosity: 3, loyalty: 2, independence: 5 }
	},
	{
		id: 'loyal',
		title: 'Loyal shadow',
		description: 'Follows you from room to room.',
		dots: { affection: 4, playfulness: 3, energy: 3, curiosity: 2, loyalty: 5, independence: 1 }
	}
]

export const DEFAULT_PRESET: PresetId = 'cuddly'

export function presetById(id: PresetId): Preset {
	const preset = PRESETS.find((candidate) => candidate.id === id)
	if (!preset) throw new Error(`Unknown preset: ${id}`)
	return preset
}

/** A preset's traits as stored (1–10). */
export function presetTraits(id: PresetId): Traits {
	const { dots } = presetById(id)
	return Object.fromEntries(TRAITS.map((trait) => [trait, dots[trait] * 2])) as Traits
}

/** Whether the traits were fine-tuned away from their preset ("Custom" on Meet). */
export function hasCustomTraits(preset: PresetId, traits: Traits): boolean {
	const base = presetTraits(preset)
	return TRAITS.some((trait) => traits[trait] !== base[trait])
}

/** How many dots the fine-tune sheet shows per trait; a dot is two stored points. */
export const TRAIT_DOTS = 5

export const TRAIT_LABEL: Record<Trait, string> = {
	affection: 'Affection',
	playfulness: 'Playfulness',
	energy: 'Energy',
	curiosity: 'Curiosity',
	loyalty: 'Loyalty',
	independence: 'Independence'
}

// ── GET and POST /api/app/v1/pet ─────────────────────────────────────────────

/**
 * A saved pet, as the app reads it. Its owner is never sent: it is always the caller.
 * `appearance` is how it looks (species included); `look_id` is the ready-made look it is
 * exactly, or null for a pet built or customized.
 */
export const petSchema = z.object({
	id: z.uuid(),
	appearance: appearanceSchema,
	look_id: lookIdSchema.nullable(),
	name: z.string(),
	preset: presetIdSchema,
	traits: traitsSchema,
	/**
	 * The four needs as the server stored them, and when (M5). Not decayed: the app applies
	 * `decayNeeds` from `updated_at` to show them, the same function the server runs.
	 */
	needs: storedNeedsSchema,
	created_at: z.iso.datetime()
})
export type Pet = z.infer<typeof petSchema>

/**
 * GET: the caller's pet, or null when they have none yet. `intro_due` (v2,
 * v2-memory-requirements.md R18): whether "Tell me about you" is still open for this pet. Absent
 * with no pet, and ignored by builds from before the intro.
 */
export const petResponse = z.object({
	pet: petSchema.nullable(),
	intro_due: z.boolean().optional()
})

/**
 * POST: save the pet made on the phone. `id` is generated there, so a retry finds its row.
 * Only these fields: the owner is the verified caller, never a field. A `look_id` must be
 * exactly the appearance sent (a customized look sends null). Whether the appearance needs Plus,
 * and whether the account has it, is the server's to decide.
 */
export const createPetBody = z
	.object({
		id: z.uuid(),
		appearance: appearanceSchema,
		look_id: lookIdSchema.nullable(),
		name: petNameSchema,
		preset: presetIdSchema,
		traits: traitsSchema
	})
	.strict()
	.refine(
		(body) =>
			body.look_id === null ||
			appearanceKey(lookById(body.look_id).appearance) === appearanceKey(body.appearance),
		{ message: 'That look is not this appearance', path: ['look_id'] }
	)
export type CreatePetBody = z.infer<typeof createPetBody>

/**
 * The pet as it now is. `existing` is true when the account already had a different pet: it
 * wins, nothing was written, and the app drops the one it sent.
 */
export const createPetResponse = z.object({ pet: petSchema, existing: z.boolean() })

// ── PATCH /api/app/v1/pet ────────────────────────────────────────────────────

/**
 * Change look (M7, m7-plus-profile-settings-requirements.md, R14): the pet's new appearance,
 * and nothing else. The species stays the pet's own (the server refuses another one); which
 * ready-made look it now is, if any, is the server's to work out (`matchLook`), and whether a
 * Plus option needs Plus is the server's to decide, as on creation.
 */
export const updatePetBody = z.object({ appearance: appearanceSchema }).strict()
export type UpdatePetBody = z.infer<typeof updatePetBody>

/** The pet as it now is. */
export const updatePetResponse = z.object({ pet: petSchema })

// ── POST /api/app/v1/pet/actions ─────────────────────────────────────────────

/**
 * Feed, Play or Pet. `time_zone` is the phone's IANA zone, so the server's decay uses the same
 * night window the app shows; the server checks it is a real zone. Nothing else: the needs are
 * the server's to compute, never the app's to send.
 */
export const petActionBody = z.object({ action: actionSchema, time_zone: timeZoneSchema }).strict()
export type PetActionBody = z.infer<typeof petActionBody>

/** The pet after the action, and whether any need changed ("can't help" changes nothing). */
export const petActionResponse = z.object({ pet: petSchema, changed: z.boolean() })
