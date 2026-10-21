import sharp from 'sharp'
import { PHOTO_MAX_BYTES } from '@app/contract'
import type { PreparedPhoto } from './reader'

// The photo, made safe and small before the model sees it (v2-pet-from-photo-requirements.md, R7,
// R24): decoded only if it is a JPEG, PNG or WebP, turned upright, shrunk to 1024 px on its long
// side and re-encoded as a JPEG. Re-encoding keeps no metadata, so the place it was taken (GPS),
// the camera and the date never leave this function. Nothing is written anywhere.

/** Long side, px: enough to see a coat's colours and markings. */
export const PHOTO_LONG_SIDE = 1024
const JPEG_QUALITY = 80
/** Refuses a decompression bomb: about a 48-megapixel photo. */
const MAX_INPUT_PIXELS = 50_000_000
const FORMATS = new Set(['jpeg', 'png', 'webp'])

export type PrepareResult = { ok: true; photo: PreparedPhoto } | { ok: false; reason: string }

export async function preparePhoto(base64: string): Promise<PrepareResult> {
	const input = Buffer.from(base64, 'base64')
	if (input.length === 0) return { ok: false, reason: 'empty' }
	if (input.length > PHOTO_MAX_BYTES) return { ok: false, reason: 'too_large' }
	try {
		const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
		const { format } = await image.metadata()
		if (!format || !FORMATS.has(format)) return { ok: false, reason: 'format' }
		const output = await image
			.rotate()
			.resize({
				width: PHOTO_LONG_SIDE,
				height: PHOTO_LONG_SIDE,
				fit: 'inside',
				withoutEnlargement: true
			})
			.jpeg({ quality: JPEG_QUALITY })
			.toBuffer()
		return { ok: true, photo: { base64: output.toString('base64'), mime: 'image/jpeg' } }
	} catch {
		return { ok: false, reason: 'decode' }
	}
}
