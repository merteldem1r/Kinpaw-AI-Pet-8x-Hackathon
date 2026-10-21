/**
 * The pet draft: the pet being made before there is an account
 * (docs/application/UI/kinpaw-screen-spec-v1.md, "Pet created before sign-in").
 *
 * It lives on the phone from the Look step on, so closing the app mid-way and
 * coming back resumes where the person left. M4 sends it to the API after
 * sign-in and clears it once the save succeeds; nothing else clears a valid
 * draft, because until then it is the only copy of the pet.
 *
 * Read once before first paint (like the theme preference), validated on read:
 * a draft this build can't read is dropped, never a crash.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { z } from 'zod'
import {
	appearanceSchema,
	DEFAULT_LOOK,
	DEFAULT_PRESET,
	lookById,
	lookIdSchema,
	matchLook,
	PET_NAME_MAX,
	presetIdSchema,
	presetTraits,
	speciesSchema,
	traitsSchema,
	type LookId,
	type PetAppearance
} from '@app/contract'
import { newId } from '@/lib/ids'
import { log } from '@/lib/logger'

const KEY = 'kinpaw:petDraft:v1'

/**
 * The Create steps; `step` is the one the person was last on. Start leads to Make your own
 * (`build`), or to a photo, which leads to Name or to the builder; then Name, Personality and
 * Meet. The photo screen is never a step to resume on: the photo isn't kept (v2 pet from a
 * photo, R18), so a relaunch there starts again at Start.
 */
const DRAFT_STEPS = ['start', 'build', 'name', 'personality', 'meet'] as const
export type DraftStep = (typeof DRAFT_STEPS)[number]

/** The ways a pet is made: built by hand, or read from a photo (and maybe adjusted). */
const DRAFT_PATHS = ['build', 'photo'] as const
export type DraftPath = (typeof DRAFT_PATHS)[number]

const petDraftObject = z
	.object({
		/**
		 * The pet's id, made here so a retried save finds its row (POST /api/app/v1/pet). A draft
		 * from before ids existed gets one on read, rather than being dropped.
		 */
		id: z.uuid().catch(() => newId()),
		species: speciesSchema,
		/**
		 * How the pet looks, per species, so switching back finds the pet the person left. The
		 * ready-made look, if any, is derived from it (`draftLookId`), never stored beside it.
		 */
		appearances: z.object({ cat: appearanceSchema, dog: appearanceSchema }),
		/** As typed; trimmed and checked when the Name step continues. */
		name: z.string().max(PET_NAME_MAX * 2),
		preset: presetIdSchema,
		traits: traitsSchema,
		/**
		 * Choose a friend (`look`) was removed on 2026-10-04: a draft paused there resumes in Make
		 * your own, on the friend it had picked.
		 */
		step: z.preprocess((step) => (step === 'look' ? 'build' : step), z.enum(DRAFT_STEPS)),
		/**
		 * How the pet was made. A ready-made friend (`choose`, before 2026-10-04) or a draft from
		 * before paths existed reads as built.
		 */
		path: z.enum(DRAFT_PATHS).catch('build')
	})
	.refine(
		(draft) => draft.appearances.cat.species === 'cat' && draft.appearances.dog.species === 'dog',
		{ message: 'an appearance stored under the wrong species' }
	)

/**
 * A draft from before the pet builder stored a ready-made look per species (`looks`). It becomes
 * those looks' appearances, so a person mid-Create keeps their pet.
 */
const lookDraft = z.object({ looks: z.object({ cat: lookIdSchema, dog: lookIdSchema }) })

const petDraftSchema = z.preprocess((value) => {
	const old = lookDraft.safeParse(value)
	if (!old.success || (value as { appearances?: unknown }).appearances) return value
	const { looks, ...rest } = value as Record<string, unknown> & { looks: unknown }
	return {
		...rest,
		appearances: {
			cat: lookById(old.data.looks.cat).appearance,
			dog: lookById(old.data.looks.dog).appearance
		}
	}
}, petDraftObject)

export type PetDraft = z.infer<typeof petDraftObject>

/** A new draft, as Create · Look first shows it. */
export function newPetDraft(): PetDraft {
	return {
		id: newId(),
		species: 'cat',
		appearances: {
			cat: lookById(DEFAULT_LOOK.cat).appearance,
			dog: lookById(DEFAULT_LOOK.dog).appearance
		},
		name: '',
		preset: DEFAULT_PRESET,
		traits: presetTraits(DEFAULT_PRESET),
		step: 'start',
		path: 'build'
	}
}

/** How the pet looks, for the species currently chosen. */
export function draftAppearance(draft: PetDraft): PetAppearance {
	return draft.appearances[draft.species]
}

/** The ready-made look the pet is exactly, or null for a pet built or customized. */
export function draftLookId(draft: PetDraft): LookId | null {
	return matchLook(draftAppearance(draft))?.id ?? null
}

let cached: PetDraft | null = null
let loaded = false

/** The draft read this launch, or null when there is none. */
export function cachedPetDraft(): PetDraft | null {
	return cached
}

/** Read the stored draft once per launch. Never throws. */
export async function loadPetDraft(): Promise<PetDraft | null> {
	if (loaded) return cached
	try {
		const raw = await AsyncStorage.getItem(KEY)
		cached = raw ? parseDraft(raw) : null
	} catch (error) {
		log.warn('Could not read the pet draft', { error })
		cached = null
	}
	loaded = true
	return cached
}

function parseDraft(raw: string): PetDraft | null {
	let json: unknown
	try {
		json = JSON.parse(raw)
	} catch {
		log.warn('Dropped a pet draft that is not JSON')
		return null
	}
	const parsed = petDraftSchema.safeParse(json)
	if (!parsed.success) {
		log.warn('Dropped a pet draft this build cannot read', {
			issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
		})
		return null
	}
	return parsed.data
}

/** Persist the draft. A failed write still holds in memory for this launch. */
export async function savePetDraft(draft: PetDraft): Promise<void> {
	cached = draft
	loaded = true
	try {
		await AsyncStorage.setItem(KEY, JSON.stringify(draft))
	} catch (error) {
		log.warn('Could not save the pet draft', { error })
	}
}

/** Forget the draft. Only after the pet is saved to the account (M4). */
export async function clearPetDraft(): Promise<void> {
	cached = null
	loaded = true
	try {
		await AsyncStorage.removeItem(KEY)
	} catch (error) {
		log.warn('Could not clear the pet draft', { error })
	}
}
