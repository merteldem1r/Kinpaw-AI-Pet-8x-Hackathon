import { z } from 'zod'
import {
	appearanceSchema,
	ATTRIBUTE_KEYS,
	usesPremium,
	type AttributeKey,
	type PetAppearance
} from './appearance'
import { timeZoneSchema } from './needs'

// Your pet from a photo (docs/application/features/v2-pet-from-photo-requirements.md): the app
// sends one photo, the server's AI reads it into the catalog, and the answer is an appearance
// any PetArt can draw. The photo is never stored; only the counts of reads are, for the limits.

/**
 * The largest photo the app may send, before base64 (R24). The app shrinks every photo to a few
 * hundred KB first, so this is a ceiling, not a target. 3 MB keeps the body under
 * `HOST_MAX_BODY_BYTES` (see below).
 */
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024
/** The same, as base64 text: 4 characters for every 3 bytes. */
export const PHOTO_MAX_BASE64_LENGTH = Math.ceil(PHOTO_MAX_BYTES / 3) * 4
/** The request body's largest size: the photo plus room for the other fields. */
export const PHOTO_MAX_BODY_BYTES = PHOTO_MAX_BASE64_LENGTH + 4 * 1024
/**
 * The largest request body Vercel Functions accept (4.5 MB). Larger bodies are refused by the
 * host with its own non-JSON 413, before our route can answer, so the photo body must stay under it.
 */
export const HOST_MAX_BODY_BYTES = 4.5 * 1000 * 1000

/** Reads per iPhone while signed out, ever (R19). */
export const PHOTO_TRIES_SIGNED_OUT = 2
/** Redos a Plus account gets per local day (R26). */
export const PHOTO_REDOS_PER_DAY = 1

/** A JPEG, PNG or WebP, as base64 without a `data:` prefix. The server decodes and checks it. */
export const photoImageSchema = z.string().min(1).max(PHOTO_MAX_BASE64_LENGTH)

export const readPetPhotoBody = z
	.object({
		/** Made once on the phone and kept in the Keychain (R19). */
		install_id: z.uuid(),
		image: photoImageSchema
	})
	.strict()
export type ReadPetPhotoBody = z.infer<typeof readPetPhotoBody>

export const redoPetPhotoBody = z
	.object({
		image: photoImageSchema,
		/** The day a redo counts against is the phone's, as talking's (R26). */
		time_zone: timeZoneSchema
	})
	.strict()
export type RedoPetPhotoBody = z.infer<typeof redoPetPhotoBody>

/** One Plus option the read found, replaced by the nearest free one (R11). */
export const photoSwapSchema = z.object({
	key: z.enum(ATTRIBUTE_KEYS),
	from: z.string(),
	to: z.string()
})
export type PhotoSwap = z.infer<typeof photoSwapSchema>

/** What the model saw when it found no single pet: nothing, several, or a photo too unclear. */
export const PHOTO_MISSES = ['no_pet', 'several', 'unclear'] as const
export type PhotoMiss = (typeof PHOTO_MISSES)[number]

/** Why no read was made: the phone's tries, the network's or the app's day, or Plus today. */
export const PHOTO_LIMITS = ['device', 'network', 'app', 'today'] as const
export type PhotoLimit = (typeof PHOTO_LIMITS)[number]

/** Reads left after this one: the phone's tries (create) or today's redos (redo). */
const leftSchema = z.number().int().min(0)

/**
 * The answer. `read`, `no_pet`, `several` and `unclear` used a read; `limit_reached` and
 * `plus_required` did not (no model call). Our own failures are errors, not outcomes (R17).
 */
export const photoReadResponse = z.discriminatedUnion('outcome', [
	z.object({
		outcome: z.literal('read'),
		appearance: appearanceSchema,
		/** Empty for a Plus redo, which keeps every option. */
		swapped: z.array(photoSwapSchema),
		left: leftSchema
	}),
	z.object({ outcome: z.enum(PHOTO_MISSES), left: leftSchema }),
	z.object({ outcome: z.literal('limit_reached'), limit: z.enum(PHOTO_LIMITS), left: leftSchema }),
	/** A redo from an account that isn't Plus: the app opens the paywall. */
	z.object({ outcome: z.literal('plus_required') })
])
export type PhotoReadResponse = z.infer<typeof photoReadResponse>

// ── The nearest free option (R11) ────────────────────────────────────────────

type Swap = {
	key: AttributeKey
	from: string
	to: string
	/** What else changes with it, from the pet as read, so the free coat keeps its look. */
	alongside?: (a: PetAppearance) => Partial<PetAppearance>
}

/**
 * A calico (or any patched coat) without its Plus pattern. Its second colour becomes the coat on
 * a white cat, so a white-and-ginger calico stays white and ginger, not plain white (seen on a
 * real calico, 2026-10-04); its patchy white stays as white markings.
 */
function patchesWithoutPlus(a: PetAppearance): Partial<PetAppearance> {
	const secondColour = a.accent !== 'auto' && a.accent !== 'snow' ? a.accent : null
	return {
		...(a.fur === 'snow' && secondColour ? { fur: secondColour } : {}),
		...(a.white === 'none' ? { white: 'bicolour' } : {})
	}
}

/**
 * Each Plus option, and the free one a free account gets instead. Read top to bottom; a test
 * checks every Plus option in the catalog is here, so a new one can't ship without its swap.
 */
export const FREE_NEAREST: readonly Swap[] = [
	// Calico patches: a plain coat in the patches' colour, with white bicolour markings.
	{ key: 'pattern', from: 'patches', to: 'solid', alongside: patchesWithoutPlus },
	{ key: 'pattern', from: 'spots', to: 'solid' },
	// Tortoiseshell: still two colours, mottled.
	{
		key: 'pattern',
		from: 'tortie',
		to: 'tabby',
		alongside: (a) => (a.accent === 'auto' ? { accent: 'ginger' } : {})
	},
	// Siamese points: no free pattern darkens the face and paws; the coat colour is kept.
	{ key: 'pattern', from: 'points', to: 'solid' },
	{ key: 'pattern', from: 'brindle', to: 'stripes' },
	{ key: 'white', from: 'van', to: 'bicolour' },
	{ key: 'eyes', from: 'ice', to: 'blue' },
	{ key: 'eyes', from: 'odd', to: 'blue' },
	{ key: 'ears', from: 'tufted', to: 'pointy' },
	{ key: 'ears', from: 'lynx', to: 'pointy' },
	{ key: 'body', from: 'buff', to: 'chonky' }
]

/**
 * The appearance with every Plus option replaced by its nearest free one, and the list of
 * replacements for the app's note. A free appearance comes back unchanged with an empty list.
 */
export function freeVersionOf(a: PetAppearance): {
	appearance: PetAppearance
	swapped: PhotoSwap[]
} {
	let next: Record<string, string> = { ...a }
	const swapped: PhotoSwap[] = []
	for (const swap of FREE_NEAREST) {
		if (a[swap.key] !== swap.from) continue
		next = { ...next, ...swap.alongside?.(a), [swap.key]: swap.to }
		swapped.push({ key: swap.key, from: swap.from, to: swap.to })
	}
	const appearance = appearanceSchema.parse(next)
	if (usesPremium(appearance)) {
		// Only when FREE_NEAREST maps a Plus option to another Plus option; its test prevents that.
		throw new Error('freeVersionOf left a Plus option in place')
	}
	return { appearance, swapped }
}
