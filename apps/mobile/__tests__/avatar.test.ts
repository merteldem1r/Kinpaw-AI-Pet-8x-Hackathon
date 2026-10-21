import { MAX_AVATAR_BYTES } from '@app/contract'
import { avatarCacheKey, avatarContentType, AvatarError, checkAvatar } from '@/lib/avatar'

// The profile photo's checks on the phone (docs/application/features/profile-edit-requirements.md,
// R8, R11): refuse what the bucket would refuse before uploading, and cache by path.

describe('avatarContentType', () => {
	it("takes the picker's type, normalising image/jpg", () => {
		expect(avatarContentType('image/jpeg', 'file:///a.jpg')).toBe('image/jpeg')
		expect(avatarContentType('image/jpg', 'file:///a')).toBe('image/jpeg')
		expect(avatarContentType('IMAGE/PNG', 'file:///a')).toBe('image/png')
		expect(avatarContentType('image/heic', 'file:///a')).toBe('image/heic')
	})

	it("falls back to the file's extension when the picker didn't say", () => {
		expect(avatarContentType(null, 'file:///x/ABC.JPEG')).toBe('image/jpeg')
		expect(avatarContentType(undefined, 'file:///x/a.webp?v=1')).toBe('image/webp')
		expect(avatarContentType(null, 'file:///x/a.heic')).toBe('image/heic')
	})

	it('is null for a type the bucket refuses', () => {
		expect(avatarContentType('image/gif', 'file:///a.gif')).toBeNull()
		expect(avatarContentType('video/mp4', 'file:///a.jpg')).toBeNull()
		expect(avatarContentType(null, 'file:///a.gif')).toBeNull()
		expect(avatarContentType(null, 'file:///a')).toBeNull()
	})
})

describe('checkAvatar', () => {
	it('passes a supported photo within the limit', () => {
		expect(checkAvatar('image/jpeg', MAX_AVATAR_BYTES)).toBe('image/jpeg')
	})

	it('refuses an unsupported type before its size', () => {
		expect(() => checkAvatar(null, MAX_AVATAR_BYTES + 1)).toThrow(
			expect.objectContaining({ stage: 'unsupported' })
		)
	})

	it('refuses a photo over the limit', () => {
		let error: unknown
		try {
			checkAvatar('image/png', MAX_AVATAR_BYTES + 1)
		} catch (e) {
			error = e
		}
		expect(error).toBeInstanceOf(AvatarError)
		expect(error).toMatchObject({ stage: 'too_large', kind: 'too_large' })
	})
})

describe('avatarCacheKey', () => {
	const path = 'http://127.0.0.1:55321/storage/v1/object/sign/user-uploads/u/avatar/p.jpg'

	it('is the URL without its token, the same across signings', () => {
		expect(avatarCacheKey(`${path}?token=one`)).toBe(path)
		expect(avatarCacheKey(`${path}?token=two`)).toBe(path)
	})

	it('is the URL itself when it has no query, and null for no photo', () => {
		expect(avatarCacheKey('https://example.com/me.png')).toBe('https://example.com/me.png')
		expect(avatarCacheKey(null)).toBeNull()
	})
})
