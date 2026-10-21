// The photo before the model sees it (v2-pet-from-photo-requirements.md, R7, R24): shrunk,
// upright, a JPEG, with no metadata left (the GPS position above all), and anything that isn't
// a JPEG, PNG or WebP refused.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { PHOTO_MAX_BYTES } from '@app/contract'
import { PHOTO_LONG_SIDE, preparePhoto } from './prepare-image'

const photo = (width: number, height: number) =>
	sharp({ create: { width, height, channels: 3, background: { r: 120, g: 90, b: 60 } } })

test('a large photo is shrunk to the long side, kept in proportion, as a JPEG', async () => {
	const input = await photo(3000, 2000).jpeg().toBuffer()
	const result = await preparePhoto(input.toString('base64'))
	assert.equal(result.ok, true)
	if (!result.ok) return
	assert.equal(result.photo.mime, 'image/jpeg')
	const meta = await sharp(Buffer.from(result.photo.base64, 'base64')).metadata()
	assert.equal(meta.format, 'jpeg')
	assert.equal(meta.width, PHOTO_LONG_SIDE)
	assert.equal(meta.height, Math.round((PHOTO_LONG_SIDE * 2000) / 3000))
})

test('a small photo is never enlarged', async () => {
	const input = await photo(400, 300).png().toBuffer()
	const result = await preparePhoto(input.toString('base64'))
	assert.equal(result.ok, true)
	if (!result.ok) return
	const meta = await sharp(Buffer.from(result.photo.base64, 'base64')).metadata()
	assert.equal(meta.width, 400)
})

test('the photo leaves with no metadata: no EXIF (GPS, camera, date), no ICC, no XMP', async () => {
	const input = await photo(800, 600)
		.withExif({
			IFD0: { Make: 'TestCam', Model: 'Kinpaw 1' },
			IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '41/1 0/1 0/1' }
		})
		.jpeg()
		.toBuffer()
	assert.ok((await sharp(input).metadata()).exif, 'the test photo has EXIF to strip')
	const result = await preparePhoto(input.toString('base64'))
	assert.equal(result.ok, true)
	if (!result.ok) return
	const output = Buffer.from(result.photo.base64, 'base64')
	const meta = await sharp(output).metadata()
	assert.equal(meta.exif, undefined)
	assert.equal(meta.icc, undefined)
	assert.equal(meta.xmp, undefined)
	assert.equal(output.includes(Buffer.from('TestCam')), false)
})

test('a sideways photo is turned upright from its EXIF orientation', async () => {
	const input = await photo(800, 400).withMetadata({ orientation: 6 }).jpeg().toBuffer()
	const result = await preparePhoto(input.toString('base64'))
	assert.equal(result.ok, true)
	if (!result.ok) return
	const meta = await sharp(Buffer.from(result.photo.base64, 'base64')).metadata()
	assert.equal(meta.width, 400)
	assert.equal(meta.height, 800)
})

test('anything that is not a JPEG, PNG or WebP is refused, as is an empty or oversized body', async () => {
	const text = Buffer.from('not a photo at all').toString('base64')
	assert.deepEqual(await preparePhoto(text), { ok: false, reason: 'decode' })
	const gif = await photo(10, 10).gif().toBuffer()
	assert.deepEqual(await preparePhoto(gif.toString('base64')), { ok: false, reason: 'format' })
	assert.deepEqual(await preparePhoto(''), { ok: false, reason: 'empty' })
	const huge = Buffer.alloc(PHOTO_MAX_BYTES + 1).toString('base64')
	assert.deepEqual(await preparePhoto(huge), { ok: false, reason: 'too_large' })
})
