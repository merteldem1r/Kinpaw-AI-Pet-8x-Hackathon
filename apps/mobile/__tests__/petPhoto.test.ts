import { freeVersionOf, lookById, PHOTO_MAX_BYTES } from '@app/contract'

// Your pet from a photo, on the phone (v2-pet-from-photo-requirements.md, R5, R14, R18): the
// note for swapped Plus options, the chips for what was seen, the count of changes made after a
// read, and the picker's shrink and size check. The photo itself is never kept anywhere but
// memory.

jest.mock('@/lib/logger', () => ({ log: { warn: jest.fn(), error: jest.fn() } }))

const mockLibrary = jest.fn()
const mockCamera = jest.fn()
const mockCameraPermission = jest.fn()
jest.mock('expo-image-picker', () => ({
	launchImageLibraryAsync: (...args: unknown[]) => mockLibrary(...args),
	launchCameraAsync: (...args: unknown[]) => mockCamera(...args),
	requestCameraPermissionsAsync: (...args: unknown[]) => mockCameraPermission(...args),
	UIImagePickerPreferredAssetRepresentationMode: { Compatible: 'compatible' }
}))

// The shrink before sending: `manipulate(uri)` gives a context; resize, render, save as base64.
const mockResize = jest.fn()
const mockRender = jest.fn()
const mockSave = jest.fn()
const mockRelease = jest.fn()
jest.mock('expo-image-manipulator', () => ({
	SaveFormat: { JPEG: 'jpeg' },
	ImageManipulator: {
		manipulate: () => ({
			resize: (...args: unknown[]) => mockResize(...args),
			renderAsync: () => mockRender(),
			release: () => mockRelease()
		})
	}
}))

const photo = jest.requireActual<typeof import('@/lib/petPhoto')>('@/lib/petPhoto')

describe('the swap note', () => {
	it('says nothing when nothing was swapped', () => {
		expect(photo.swapNote([], 'cat')).toBeNull()
	})

	it('names one Plus option and the free one used, and where to switch later', () => {
		const note = photo.swapNote([{ key: 'pattern', from: 'tortie', to: 'tabby' }], 'cat')
		expect(note).toBe(
			'Your pet has Tortie, a Plus pattern. We used Tabby for now; you can switch with Kinpaw Plus later in Change look.'
		)
	})

	it('lists several in one sentence', () => {
		const calico = lookById('calico').appearance
		const { swapped } = freeVersionOf({ ...calico, eyes: 'odd' })
		expect(photo.swapNote(swapped, 'cat')).toMatch(
			/^Patches and Odd-eyed are Plus options\. We used Solid and Blue for now;/
		)
	})
})

describe('the chips under the reveal', () => {
	it('say the coat, the markings when there are some, the eyes and the ears', () => {
		const tuxedo = lookById('tuxedo').appearance
		const labels = photo.seenChips(tuxedo).map((chip) => chip.label)
		expect(labels[0]).toBe('Charcoal')
		expect(labels).toContain('Pointy ears')
		expect(labels.some((label) => label.endsWith(' eyes'))).toBe(true)
	})

	it('leave out "no markings"', () => {
		const ginger = { ...lookById('ginger').appearance, white: 'none' as const }
		expect(photo.seenChips(ginger).map((chip) => chip.key)).not.toContain('white')
	})
})

describe('changes after a read', () => {
	const read = lookById('tuxedo').appearance

	it('counts the attributes the person changed', () => {
		expect(photo.changedCount(read, read)).toBe(0)
		expect(photo.changedCount(read, { ...read, eyes: 'blue', tail: 'fluffy' })).toBe(2)
	})

	it('counts another species as more than every attribute', () => {
		const dog = lookById('biscuit').appearance
		expect(photo.changedCount(read, dog)).toBeGreaterThan(9)
	})
})

describe('the photo in memory', () => {
	it('is held from the pick to Name, with the read, then forgotten', () => {
		photo.startPhotoSession({ uri: 'file:///cat.jpg', base64: 'AAAA' })
		photo.rememberRead(lookById('tuxedo').appearance, [])
		expect(photo.photoSession()?.read?.fur).toBe('charcoal')
		photo.endPhotoSession()
		expect(photo.photoSession()).toBeNull()
	})
})

describe('picking', () => {
	beforeEach(() => {
		jest.clearAllMocks()
		mockSave.mockResolvedValue({ base64: 'AAAA' })
		mockRender.mockResolvedValue({
			saveAsync: (...args: unknown[]) => mockSave(...args),
			release: () => mockRelease()
		})
	})

	function libraryGives(asset: { uri: string; width: number; height: number }) {
		mockLibrary.mockResolvedValue({ canceled: false, assets: [asset] })
	}

	it('shrinks a large photo to the upload size on its long side, and sends JPEG base64', async () => {
		libraryGives({ uri: 'file:///cat.jpg', width: 8064, height: 6048 })
		expect(await photo.pickPetPhoto('library')).toEqual({
			kind: 'picked',
			photo: { uri: 'file:///cat.jpg', base64: 'AAAA' }
		})
		expect(mockResize).toHaveBeenCalledWith({ width: photo.UPLOAD_LONG_SIDE })
		expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ format: 'jpeg', base64: true }))
	})

	it('shrinks a portrait photo by its height', async () => {
		libraryGives({ uri: 'file:///dog.jpg', width: 3024, height: 4032 })
		await photo.pickPetPhoto('library')
		expect(mockResize).toHaveBeenCalledWith({ height: photo.UPLOAD_LONG_SIDE })
	})

	it('leaves a photo already small enough at its size', async () => {
		libraryGives({ uri: 'file:///small.jpg', width: 1200, height: 900 })
		expect((await photo.pickPetPhoto('library')).kind).toBe('picked')
		expect(mockResize).not.toHaveBeenCalled()
	})

	it("says a photo it couldn't open is unreadable, and frees the native image", async () => {
		mockRender.mockRejectedValue(new Error('decode failed'))
		libraryGives({ uri: 'file:///broken.jpg', width: 4000, height: 3000 })
		expect(await photo.pickPetPhoto('library')).toEqual({ kind: 'unreadable' })
		expect(mockRelease).toHaveBeenCalled()
	})

	it('still refuses a photo over the limit before anything is sent', async () => {
		mockSave.mockResolvedValue({ base64: 'A'.repeat(Math.ceil((PHOTO_MAX_BYTES * 4) / 3) + 8) })
		libraryGives({ uri: 'file:///big.png', width: 1536, height: 1536 })
		expect(await photo.pickPetPhoto('library')).toEqual({ kind: 'too_large' })
	})

	it('asks for the camera first, and a refusal opens nothing', async () => {
		mockCameraPermission.mockResolvedValue({ granted: false })
		expect(await photo.pickPetPhoto('camera')).toEqual({ kind: 'camera_denied' })
		expect(mockCamera).not.toHaveBeenCalled()
	})

	it('gives nothing when cancelled', async () => {
		mockLibrary.mockResolvedValue({ canceled: true, assets: null })
		expect(await photo.pickPetPhoto('library')).toEqual({ kind: 'cancelled' })
		expect(mockRender).not.toHaveBeenCalled()
	})
})

describe('keeping the species with a photo of the other one (redo, R28)', () => {
	it('paints the coat and eyes, and keeps the species, ears, body and tail', () => {
		const cat = lookById('ginger').appearance
		const dog = {
			...lookById('biscuit').appearance,
			fur: 'charcoal' as const,
			eyes: 'blue' as const
		}
		const kept = photo.withCoatOf(cat, dog)
		expect(kept).toMatchObject({
			species: 'cat',
			ears: cat.ears,
			body: cat.body,
			tail: cat.tail,
			fur: 'charcoal',
			pattern: dog.pattern,
			white: dog.white,
			eyes: 'blue'
		})
	})
})
