import { z } from 'zod'
import {
	ACCENT_IDS,
	appearanceSchema,
	ATTRIBUTE_KEYS,
	BODY_IDS,
	CAT_EAR_IDS,
	DEFAULT_EARS,
	DOG_EAR_IDS,
	EYE_IDS,
	FUR_IDS,
	PATTERN_IDS,
	PHOTO_MISSES,
	speciesSchema,
	TAIL_IDS,
	TRIM_IDS,
	WHITE_IDS,
	type EyeId,
	type PetAppearance,
	type PhotoMiss,
	type Species
} from '@app/contract'

// The model's answer (v2-pet-from-photo-requirements.md, R9–R10), checked here before anything
// is drawn: every attribute must be one of the catalog's ids or "unseen". The lists are the
// catalog's own, so a new option is accepted the day it is added. An answer that names anything
// else, or isn't JSON, is refused whole (the reader tries once more).

/** What the model says for a part of the pet the photo doesn't show. */
export const UNSEEN = 'unseen'

/** The attributes the model picks, in the catalog's order. */
export const PHOTO_ANSWER_ATTRIBUTES = ATTRIBUTE_KEYS

const pick = <T extends string>(ids: readonly T[]) => z.enum([...ids, UNSEEN]).nullable()

const answerSchema = z.object({
	verdict: z.enum(['ok', ...PHOTO_MISSES]),
	/** For reading the answer, never stored or logged. */
	seen: z.string().nullish(),
	species: speciesSchema.nullable(),
	fur: pick(FUR_IDS),
	pattern: pick(PATTERN_IDS),
	accent: pick(ACCENT_IDS),
	white: pick(WHITE_IDS),
	trim: pick(TRIM_IDS),
	eyes: pick(EYE_IDS),
	ears: pick([...CAT_EAR_IDS, ...DOG_EAR_IDS]),
	body: pick(BODY_IDS),
	tail: pick(TAIL_IDS)
})
type RawAnswer = z.infer<typeof answerSchema>

/** A checked answer: a drawable pet, or what was in the photo instead. */
export type PhotoAnswer = { verdict: 'ok'; appearance: PetAppearance } | { verdict: PhotoMiss }

/** What an unseen part becomes (R10): the plainest choice, so it is easy to spot and change. */
const UNSEEN_DEFAULTS = {
	pattern: 'solid',
	accent: 'auto',
	white: 'none',
	trim: 'white',
	body: 'round',
	tail: 'long'
} as const
const DEFAULT_EYES: Record<Species, EyeId> = { cat: 'green', dog: 'brown' }

/**
 * The answer as the model wrote it, checked: null when it isn't JSON or names something the
 * catalog doesn't have. A pet the model says is there but whose species or main colour it
 * couldn't see is `unclear`: there is nothing to draw from.
 */
export function parsePhotoAnswer(text: string): PhotoAnswer | null {
	const raw = answerSchema.safeParse(jsonIn(text))
	if (!raw.success) return null
	const answer = raw.data
	if (answer.verdict !== 'ok') return { verdict: answer.verdict }
	if (!answer.species || !answer.fur || answer.fur === UNSEEN) return { verdict: 'unclear' }
	const appearance = appearanceFrom(answer, answer.species, answer.fur)
	return appearance ? { verdict: 'ok', appearance } : null
}

function appearanceFrom(
	answer: RawAnswer,
	species: Species,
	fur: (typeof FUR_IDS)[number]
): PetAppearance | null {
	const seen = <K extends keyof RawAnswer>(key: K) => {
		const value = answer[key]
		return value === null || value === UNSEEN ? undefined : value
	}
	const pattern = seen('pattern') ?? UNSEEN_DEFAULTS.pattern
	const ears = seen('ears')
	const earsFit =
		ears !== undefined && (species === 'cat' ? CAT_EAR_IDS : DOG_EAR_IDS).some((id) => id === ears)
	const parsed = appearanceSchema.safeParse({
		species,
		fur,
		pattern,
		// A solid coat has no markings, so their colour is the plain default.
		accent: pattern === 'solid' ? 'auto' : (seen('accent') ?? UNSEEN_DEFAULTS.accent),
		white: seen('white') ?? UNSEEN_DEFAULTS.white,
		trim: seen('trim') ?? UNSEEN_DEFAULTS.trim,
		eyes: seen('eyes') ?? DEFAULT_EYES[species],
		ears: earsFit ? ears : DEFAULT_EARS[species],
		body: seen('body') ?? UNSEEN_DEFAULTS.body,
		tail: seen('tail') ?? UNSEEN_DEFAULTS.tail
	})
	return parsed.success ? parsed.data : null
}

/** The JSON object in the model's text: it sometimes wraps it in a ```json fence. */
function jsonIn(text: string): unknown {
	const start = text.indexOf('{')
	const end = text.lastIndexOf('}')
	if (start === -1 || end <= start) return null
	try {
		return JSON.parse(text.slice(start, end + 1))
	} catch {
		return null
	}
}
