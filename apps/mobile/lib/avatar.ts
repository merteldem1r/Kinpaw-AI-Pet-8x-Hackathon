import { AVATAR_CONTENT_TYPES, MAX_AVATAR_BYTES, type AvatarContentType } from '@app/contract'

// The pure half of the profile photo (docs/application/features/profile-edit-requirements.md):
// what the phone checks before an upload, and the cache key that keeps a photo cached across
// its hourly signed URLs. lib/avatarUpload.ts does the picking and the sending.

/** Where a save broke, as `profile_update_failed` reports it. */
export type AvatarFailureStage = 'too_large' | 'unsupported' | 'upload' | 'save'

/** A photo the phone refused, or an upload that failed, with the stage it failed at. */
export class AvatarError extends Error {
	readonly stage: AvatarFailureStage
	/** For `error_kind`: what went wrong, never the photo or its path. */
	readonly kind: string

	constructor(stage: AvatarFailureStage, kind: string, message: string) {
		super(message)
		this.name = 'AvatarError'
		this.stage = stage
		this.kind = kind
	}
}

const EXTENSION_TYPES: Record<string, AvatarContentType> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
	heic: 'image/heic'
}

function isAvatarContentType(type: string): type is AvatarContentType {
	return type in AVATAR_CONTENT_TYPES
}

/**
 * The content type to declare for a picked photo: the picker's own, else the file's extension.
 * Null when it is none the bucket accepts (JPEG, PNG, WebP, HEIC).
 */
export function avatarContentType(
	mimeType: string | null | undefined,
	uri: string
): AvatarContentType | null {
	const declared = mimeType?.toLowerCase().replace('image/jpg', 'image/jpeg')
	if (declared) return isAvatarContentType(declared) ? declared : null
	const extension = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(uri)?.[1]?.toLowerCase()
	return extension ? (EXTENSION_TYPES[extension] ?? null) : null
}

/** Refuses, before any upload, a photo the bucket would refuse: too large or of another type. */
export function checkAvatar(
	contentType: AvatarContentType | null,
	sizeBytes: number
): AvatarContentType {
	if (!contentType) {
		throw new AvatarError(
			'unsupported',
			'unsupported_type',
			"That photo can't be used. Try another one."
		)
	}
	if (sizeBytes > MAX_AVATAR_BYTES) {
		throw new AvatarError('too_large', 'too_large', 'That photo is too large. Try another one.')
	}
	return contentType
}

/**
 * The key a photo is cached under: its URL without the query. A signed URL changes every hour
 * (its token), the path doesn't, and a new photo is always a new path, so the same photo is
 * downloaded once and a new one never shows the old.
 */
export function avatarCacheKey(url: string | null): string | null {
	if (!url) return null
	return url.split(/[?#]/)[0] || null
}
