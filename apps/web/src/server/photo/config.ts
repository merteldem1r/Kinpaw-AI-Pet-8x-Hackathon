// The photo read's settings (docs/application/features/v2-pet-from-photo-requirements.md), from
// the environment, read once per call so a test can set them. All server-only; Mert sets them in
// apps/web/.env.local (apps/web/.env.example says what each is for).

/** Gemini 2.5 Flash through fal's OpenRouter vision endpoint, unless PHOTO_MODEL says otherwise. */
export const DEFAULT_PHOTO_MODEL = 'google/gemini-2.5-flash'
/** Reads a day for the whole app (R22): about $0.30 at Gemini Flash's price. */
const DEFAULT_PHOTO_DAILY_CAP = 300

export type PhotoConfig = {
	/** fal.ai's key; null means the stub reads (development, tests) or nothing does (production). */
	falKey: string | null
	model: string
	/** Keys the install id and IP hashes (R23); null closes the routes in production. */
	hashSecret: string | null
	dailyCap: number
}

export function photoConfig(): PhotoConfig {
	const cap = Number.parseInt(process.env.PHOTO_DAILY_CAP?.trim() ?? '', 10)
	return {
		falKey: process.env.FAL_KEY?.trim() || null,
		model: process.env.PHOTO_MODEL?.trim() || DEFAULT_PHOTO_MODEL,
		hashSecret: process.env.PHOTO_HASH_SECRET?.trim() || null,
		dailyCap: Number.isInteger(cap) && cap > 0 ? cap : DEFAULT_PHOTO_DAILY_CAP
	}
}
