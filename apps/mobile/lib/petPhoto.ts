import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import {
	ATTRIBUTE_KEYS,
	optionLabel,
	PHOTO_MAX_BYTES,
	type AttributeKey,
	type PetAppearance,
	type PhotoMiss,
	type PhotoSwap
} from '@app/contract'
import { APP_NAME } from '@/lib/constants'
import { log } from '@/lib/logger'

// Your pet from a photo, on the phone (docs/application/features/v2-pet-from-photo-requirements.md):
// picking the photo, holding it while it is read, and the words the screens say about a read.
//
// The photo is never kept (R18): it is held here, in memory, from the pick until the person
// moves on to Name, and never written to the draft, the device or a log.

export type PhotoSource = 'camera' | 'library'

/** A photo picked to read: its file (for the thumbnail) and its bytes, as base64 (to send). */
export type PickedPhoto = { uri: string; base64: string }

export type PickResult =
	| { kind: 'picked'; photo: PickedPhoto }
	| { kind: 'cancelled' }
	| { kind: 'camera_denied' }
	| { kind: 'too_large' }
	| { kind: 'unreadable' }

/**
 * The modern picker (PHPicker for the library, so no permission is asked), a JPEG at 0.6 (a HEIC
 * becomes a JPEG; re-encoding drops the photo's metadata here too).
 */
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
	mediaTypes: ['images'],
	quality: 0.6,
	exif: false,
	preferredAssetRepresentationMode:
		ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible
}

/**
 * The long side a photo is shrunk to before it is sent (R24). The server reads it at 1024 px, so
 * this leaves it room, and a 24 or 48 MP photo becomes a few hundred KB: quick on mobile data
 * and far under the body limit a host puts on a request.
 */
export const UPLOAD_LONG_SIDE = 1536
const UPLOAD_JPEG_QUALITY = 0.7

/** Opens the camera or the library. The camera asks for permission the first time. */
export async function pickPetPhoto(source: PhotoSource): Promise<PickResult> {
	if (source === 'camera') {
		const permission = await ImagePicker.requestCameraPermissionsAsync()
		if (!permission.granted) return { kind: 'camera_denied' }
	}
	const result =
		source === 'camera'
			? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
			: await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS)
	const asset = result.canceled ? null : result.assets[0]
	if (!asset) return { kind: 'cancelled' }
	const base64 = await shrinkForUpload(asset)
	if (!base64) return { kind: 'unreadable' }
	// 4 base64 characters for every 3 bytes.
	if ((base64.length * 3) / 4 > PHOTO_MAX_BYTES) return { kind: 'too_large' }
	return { kind: 'picked', photo: { uri: asset.uri, base64 } }
}

/** The photo at `UPLOAD_LONG_SIDE` at most, as JPEG base64; null when it can't be opened. */
async function shrinkForUpload(asset: ImagePicker.ImagePickerAsset): Promise<string | null> {
	const context = ImageManipulator.manipulate(asset.uri)
	try {
		if (Math.max(asset.width, asset.height) > UPLOAD_LONG_SIDE) {
			context.resize(
				asset.width >= asset.height ? { width: UPLOAD_LONG_SIDE } : { height: UPLOAD_LONG_SIDE }
			)
		}
		const image = await context.renderAsync()
		try {
			const saved = await image.saveAsync({
				format: SaveFormat.JPEG,
				compress: UPLOAD_JPEG_QUALITY,
				base64: true
			})
			return saved.base64 ?? null
		} finally {
			image.release()
		}
	} catch (error) {
		log.warn('Could not shrink the photo to send', { error })
		return null
	} finally {
		context.release()
	}
}

// ── The photo being read, in memory only ────────────────────────────────────

/** What the photo screen reads and the builder compares against. */
export type PhotoSession = {
	photo: PickedPhoto
	/**
	 * The read, once it came back: shown again if the screen remounts (a photo is never sent
	 * twice, R20), and what `pet_photo_kept` counts the changes against.
	 */
	read: PetAppearance | null
	swapped: PhotoSwap[]
}

let session: PhotoSession | null = null

export function startPhotoSession(photo: PickedPhoto) {
	session = { photo, read: null, swapped: [] }
}

export function photoSession(): PhotoSession | null {
	return session
}

export function rememberRead(appearance: PetAppearance, swapped: PhotoSwap[]) {
	if (session) session = { ...session, read: appearance, swapped }
}

/** Forget the photo: on to Name, or back to Start (R18). */
export function endPhotoSession() {
	session = null
}

/** How many attributes differ between the pet as read and the pet as kept. */
export function changedCount(read: PetAppearance, kept: PetAppearance): number {
	if (read.species !== kept.species) return ATTRIBUTE_KEYS.length + 1
	return ATTRIBUTE_KEYS.filter((key) => read[key] !== kept[key]).length
}

// ── What the screens say ────────────────────────────────────────────────────

/** The pet's line when the photo has no single pet in it (R15). */
export const MISS_LINE: Record<PhotoMiss, string> = {
	no_pet: "Hmm, I can't spot a cat or dog in that one. A clearer photo of their face?",
	several: 'I see more than one friend there! A photo of just one?',
	unclear: "That one's a bit blurry. Another try?"
}

/** No tries left on this phone (R16). */
export const OUT_OF_TRIES_LINE =
	"That was our last photo together. Let's make your pet by hand, I'll help!"

/** The network's or the app's day is full: not the person's doing. */
export const RESTING_LINE =
	"I've looked at so many photos today, my eyes need a rest! Let's make your pet by hand for now."

/** Our side failed: no try was used (R17). */
export const FAILED_LINE = "I couldn't look at that just now. Try again?"

const KIND: Partial<Record<AttributeKey, string>> = {
	pattern: 'pattern',
	white: 'marking',
	eyes: 'eye colour',
	ears: 'ear shape',
	body: 'body'
}

/**
 * The note under the reveal when Plus options were swapped for free ones (R14, G1): "Your pet has
 * Tortie, a Plus pattern. We used Tabby for now; you can switch with Kinpaw Plus later in Change
 * look." Null when nothing was swapped.
 */
export function swapNote(swapped: readonly PhotoSwap[], species: PetAppearance['species']) {
	const [first, ...rest] = swapped
	if (!first) return null
	const from = (swap: PhotoSwap) => optionLabel(swap.key, swap.from, species)
	const to = (swap: PhotoSwap) => optionLabel(swap.key, swap.to, species)
	const later = `you can switch with ${APP_NAME} Plus later in Change look.`
	if (rest.length === 0) {
		const kind = KIND[first.key] ?? 'option'
		return `Your pet has ${from(first)}, a Plus ${kind}. We used ${to(first)} for now; ${later}`
	}
	const all = swapped.map(from)
	const used = swapped.map(to)
	return `${joinAnd(all)} are Plus options. We used ${joinAnd(used)} for now; ${later}`
}

function joinAnd(words: string[]): string {
	return words.length < 2
		? (words[0] ?? '')
		: `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
}

/** The chips under the reveal: what was seen, in the builder's words (R14). */
export function seenChips(a: PetAppearance): { label: string; key: AttributeKey }[] {
	const chips: { label: string; key: AttributeKey }[] = [
		{ key: 'fur', label: optionLabel('fur', a.fur, a.species) },
		{ key: 'pattern', label: optionLabel('pattern', a.pattern, a.species) }
	]
	if (a.white !== 'none')
		chips.push({ key: 'white', label: optionLabel('white', a.white, a.species) })
	chips.push({ key: 'eyes', label: `${optionLabel('eyes', a.eyes, a.species)} eyes` })
	chips.push({ key: 'ears', label: `${optionLabel('ears', a.ears, a.species)} ears` })
	return chips
}

// ── Redo from a photo (Plus, Change look) ───────────────────────────────────

/** The coat and eyes a photo can give a pet of another species (R28, "Keep {name} a cat"). */
const COAT_KEYS = ['fur', 'pattern', 'accent', 'white', 'trim', 'eyes'] as const

/**
 * The pet keeping its species, ears, body and tail, with the colours and markings read from a
 * photo of the other species.
 */
export function withCoatOf(pet: PetAppearance, read: PetAppearance): PetAppearance {
	const coat = Object.fromEntries(COAT_KEYS.map((key) => [key, read[key]]))
	return { ...pet, ...coat }
}
