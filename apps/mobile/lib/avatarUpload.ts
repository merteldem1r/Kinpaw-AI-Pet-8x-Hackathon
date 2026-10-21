import * as ImagePicker from 'expo-image-picker'
import { api } from '@/lib/api'
import { avatarContentType, AvatarError, checkAvatar } from '@/lib/avatar'
import { onDevHost } from '@/lib/env'

// Choosing and sending a profile photo (docs/application/features/profile-edit-requirements.md,
// R5–R8, R12). The phone never picks where the file goes: POST /api/app/v1/uploads signs a URL
// for a path under the person's own folder, the file goes straight to storage with it, and the
// returned path is what PATCH /api/app/v1/profile saves (docs/rules/mobile-data.md → Storage).

/** A photo picked in the library, not yet uploaded. */
export type PickedAvatar = { uri: string; mimeType: string | null; fileSize: number | null }

/**
 * The modern system picker (PHPicker), which opens fast: `allowsEditing` would switch iOS to the
 * old UIImagePickerController, which takes seconds to appear. So there is no crop step; the
 * avatar fills its circle from the centre (`contentFit="cover"`). Re-encoded at 0.6, which
 * drops the photo's metadata and keeps it well under the 5 MiB limit.
 */
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
	mediaTypes: ['images'],
	quality: 0.6,
	exif: false,
	preferredAssetRepresentationMode:
		ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible
}

/**
 * Opens the photo library. The system picker shares only the photo chosen, so no permission is
 * asked for. Null when the person cancels.
 */
export async function pickAvatar(): Promise<PickedAvatar | null> {
	const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS)
	const asset = result.canceled ? null : result.assets[0]
	if (!asset) return null
	return { uri: asset.uri, mimeType: asset.mimeType ?? null, fileSize: asset.fileSize ?? null }
}

/**
 * Uploads a picked photo and answers its storage path, for `avatar_path`. Throws an AvatarError
 * at `too_large` or `unsupported` before anything is sent, or at `upload`.
 */
export async function uploadAvatar(picked: PickedAvatar): Promise<string> {
	const size = picked.fileSize ?? (await sizeOf(picked.uri))
	const contentType = checkAvatar(avatarContentType(picked.mimeType, picked.uri), size)

	let upload
	try {
		;({ upload } = await api('createUpload', {
			body: { purpose: 'avatar', content_type: contentType, size_bytes: size }
		}))
	} catch (error) {
		throw new AvatarError('upload', kindOf(error), "Couldn't save your changes. Try again.")
	}

	// Storage's signed upload takes the file as a multipart part, the way supabase-js sends it.
	const body = new FormData()
	body.append('cacheControl', '3600')
	body.append('', {
		uri: picked.uri,
		name: upload.path.split('/').pop(),
		type: contentType
	} as unknown as Blob)

	let response: Response
	try {
		response = await fetch(onDevHost(upload.signed_url), {
			method: 'PUT',
			headers: { 'x-upsert': 'false' },
			body
		})
	} catch {
		throw new AvatarError('upload', 'unreachable', "Couldn't save your changes. Try again.")
	}
	if (!response.ok) {
		throw new AvatarError(
			'upload',
			`http_${response.status}`,
			"Couldn't save your changes. Try again."
		)
	}
	return upload.path
}

/** The file's size when the picker didn't say. */
async function sizeOf(uri: string): Promise<number> {
	try {
		return (await (await fetch(uri)).blob()).size
	} catch {
		throw new AvatarError('unsupported', 'unreadable', "That photo can't be used. Try another one.")
	}
}

function kindOf(error: unknown): string {
	return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
		? error.code
		: 'unknown'
}
