import type { PhotoReadResponse } from '@app/contract'
import { PHOTO_EVENTS } from '@/lib/analytics/events'
import { recordUserEvent } from '@/lib/analytics/record'
import { ApiError } from '@/server/api/app-errors'
import type { PhotoFlowResult } from './read-photo'

// What both photo routes answer for a read's result (v2-pet-from-photo-requirements.md, R12,
// R17), and the first-party event for a counted one. Our own failures are errors that use no
// try; the limits and what the model found are answers the app shows.

/** The response for a flow result; throws the ApiError for the ones that are errors. */
export function photoResponse(result: PhotoFlowResult): PhotoReadResponse {
	switch (result.kind) {
		case 'not_configured':
			throw new ApiError('not_configured', "Reading photos isn't available right now.")
		case 'bad_image':
			throw new ApiError('invalid_request', "That file isn't a photo I can read. Try another.", {
				issues: [{ path: 'image', message: 'Send a JPEG, PNG or WebP photo.' }]
			})
		case 'failed':
			throw new ApiError('photo_unavailable', "I couldn't look at that just now. Try again?", {
				cause: new Error(`the photo reader failed: ${result.failure}`)
			})
		case 'plus_required':
			return { outcome: 'plus_required' }
		case 'limit':
			return { outcome: 'limit_reached', limit: result.limit, left: result.left }
		case 'answered':
			return result.answer.outcome === 'read'
				? {
						outcome: 'read',
						appearance: result.answer.appearance,
						swapped: result.answer.swapped,
						left: result.left
					}
				: { outcome: result.answer.outcome, left: result.left }
	}
}

/**
 * A counted read, recorded first-party (every one: `dedupeDaily: false`, bounded by the limits).
 * Signed out, the read's own random id stands in as the session id. Never the photo, the model's
 * words or a hash.
 */
export async function recordPhotoRead(
	result: PhotoFlowResult,
	{ userId, context, path }: { userId: string | null; context: 'create' | 'redo'; path: string }
): Promise<void> {
	if (result.kind !== 'answered') return
	await recordUserEvent(userId, PHOTO_EVENTS.petPhotoRead, {
		path,
		metadata: {
			context,
			result: result.answer.outcome,
			swapped_count: result.answer.outcome === 'read' ? result.answer.swapped.length : 0
		},
		...(userId ? {} : { sessionId: result.readId }),
		dedupeDaily: false
	})
}
