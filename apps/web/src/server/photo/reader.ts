import type { PhotoAnswer } from './answer-schema'

// The photo reader behind one interface (v2-pet-from-photo-requirements.md, R6), as talking's
// reply provider: the routes ask for an answer and never know which model gave it. fal.ai with
// Gemini 2.5 Flash is the one in use (./fal.ts); the stub (./stub.ts) reads in tests, in CI and
// in development without a key.

/** A photo ready for the model: shrunk, re-encoded, with no metadata (./prepare-image.ts). */
export type PreparedPhoto = { base64: string; mime: 'image/jpeg' }

export type PhotoUsage = { inputTokens: number | null; outputTokens: number | null }

export const NO_PHOTO_USAGE: PhotoUsage = { inputTokens: null, outputTokens: null }

/**
 * - `unavailable`: the model couldn't be reached, timed out, was rate-limited or refused the key.
 * - `invalid`: it answered, but not in a shape we can draw.
 */
export type PhotoReadFailure = 'unavailable' | 'invalid'

export type PhotoReadResult =
	| { ok: true; answer: PhotoAnswer; usage: PhotoUsage; latencyMs: number }
	| {
			ok: false
			failure: PhotoReadFailure
			/** Why, for the logs: `timeout`, `http_429`, `not_json`… Never the photo or the answer. */
			detail: string
			usage: PhotoUsage
			latencyMs: number
	  }

export interface PhotoReader {
	/** Recorded in ai_usage, with the model. */
	readonly name: 'fal' | 'stub'
	readonly model: string
	/** Never throws: every failure is a result. */
	read(photo: PreparedPhoto): Promise<PhotoReadResult>
}
