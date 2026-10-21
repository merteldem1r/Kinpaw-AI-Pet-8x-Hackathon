import { endpoints } from '@app/contract'
import { ApiError } from '@/server/api/app-errors'
import { createAppRoute } from '@/server/api/app-route'
import { requireTimeZone } from '@/server/api/time-zone'
import { petStore } from '@/server/db/pets'
import { profileStore } from '@/server/db/profiles'
import { photoConfig } from '@/server/photo/config'
import { clientIp } from '@/server/photo/hash'
import { photoReader } from '@/server/photo/provider'
import { readPetPhoto } from '@/server/photo/read-photo'
import { photoResponse, recordPhotoRead } from '@/server/photo/respond'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PATH = '/api/app/v1/pet/photo/redo'

/**
 * POST /api/app/v1/pet/photo/redo: a new look for the caller's pet from a photo, for Kinpaw Plus,
 * once a day in the phone's time zone (docs/application/features/v2-pet-from-photo-requirements.md,
 * R26–R29). Nothing is saved here: the app shows the result in Change look, and PATCH
 * /api/app/v1/pet saves it. Plus is decided here from the profile, never from the app; a Plus
 * read keeps its Plus options.
 *
 * - 200 `read`, `no_pet`, `several`, `unclear`: as the creation read; counted against today.
 * - 200 `plus_required`: a free account (the app opens the paywall); no model call.
 * - 200 `limit_reached` (`today` or `app`): no model call.
 * - 400: a time zone this server doesn't know, not a photo, or a body the contract refuses.
 * - 404: no pet yet.
 * - 413, 503: as the creation read.
 */
export const POST = createAppRoute(endpoints.redoPetPhoto, async ({ req, user, body }) => {
	requireTimeZone(body.time_zone)
	if (!(await petStore.get(user.id))) {
		throw new ApiError('not_found', 'There is no pet to change yet.')
	}
	const config = photoConfig()
	const result = await readPetPhoto(
		{
			context: 'redo',
			ip: clientIp(req.headers),
			userId: user.id,
			timeZone: body.time_zone,
			plus: await profileStore.isPremium(user.id)
		},
		body.image,
		{ reader: photoReader(config), config }
	)
	await recordPhotoRead(result, { userId: user.id, context: 'redo', path: PATH })
	return { body: photoResponse(result) }
})
