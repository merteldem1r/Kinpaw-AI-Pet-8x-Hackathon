import { endpoints } from '@app/contract'
import { createAppRoute } from '@/server/api/app-route'
import { photoConfig } from '@/server/photo/config'
import { clientIp } from '@/server/photo/hash'
import { photoReader } from '@/server/photo/provider'
import { readPetPhoto } from '@/server/photo/read-photo'
import { photoResponse, recordPhotoRead } from '@/server/photo/respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PATH = '/api/app/v1/pet/photo/read'

/**
 * POST /api/app/v1/pet/photo/read: a photo of someone's cat or dog, read into the catalog while
 * they create their pet, signed out (docs/application/features/v2-pet-from-photo-requirements.md).
 * Public on purpose: Create comes before sign-in, so the limits stand in for it (R19–R25), per
 * iPhone (its Keychain install id), per network and per day for the whole app. The photo is
 * never stored or logged.
 *
 * - 200 `read`: the appearance, its Plus options swapped for free ones (`swapped`), and the
 *   phone's tries `left`. Counted, and recorded first-party.
 * - 200 `no_pet` | `several` | `unclear`: the model found no single pet. Counted.
 * - 200 `limit_reached`: which limit (`device`, `network`, `app`); no model call.
 * - 400: not a photo we can read, or a body the contract refuses. Not counted.
 * - 413: a body over the photo limit, refused unread.
 * - 503 `photo_unavailable`: the model couldn't be reached or answered unusably. Not counted.
 * - 503 `not_configured`: no reader or no hash secret in production.
 */
export const POST = createAppRoute(endpoints.readPetPhoto, async ({ req, body }) => {
	const config = photoConfig()
	const result = await readPetPhoto(
		{ context: 'create', installId: body.install_id, ip: clientIp(req.headers), userId: null },
		body.image,
		{ reader: photoReader(config), config }
	)
	await recordPhotoRead(result, { userId: null, context: 'create', path: PATH })
	return { body: photoResponse(result) }
})
