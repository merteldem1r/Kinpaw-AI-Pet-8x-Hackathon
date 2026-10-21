import AsyncStorage from '@react-native-async-storage/async-storage'
import { hasPhotoAiConsent, markRedoUsed, redoUsedToday, savePhotoAiConsent } from '@/lib/photoRedo'

// What the phone remembers about photos (v2-pet-from-photo-requirements.md, R26; Apple
// 5.1.2(i)): no photo goes to the AI before a yes, the yes is kept, and a used redo is today's
// only.

jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

beforeEach(async () => {
	await AsyncStorage.clear()
	jest.useRealTimers()
})

describe('permission to send a photo to the AI', () => {
	it('is not given until the person says yes, and then is kept', async () => {
		expect(await hasPhotoAiConsent()).toBe(false)
		await savePhotoAiConsent()
		expect(await hasPhotoAiConsent()).toBe(true)
	})
})

describe("today's redo", () => {
	it('is unused until marked, then used for the rest of the day only', async () => {
		jest.useFakeTimers({ now: new Date(2026, 9, 5, 9, 0) })
		expect(await redoUsedToday()).toBe(false)
		await markRedoUsed()
		expect(await redoUsedToday()).toBe(true)
		jest.setSystemTime(new Date(2026, 9, 6, 9, 0))
		expect(await redoUsedToday()).toBe(false)
	})
})
