/**
 * Friends on the phone (v2-friends-requirements.md): the link a QR holds and the code read back
 * out of it (R6, R8), how a friend is named (R13), the line under their pet from its bands (R11),
 * and a link kept for a day while there is no pet yet (R10).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { lookById, type FriendPet } from '@app/contract'
import {
	codeFromParam,
	friendLink,
	friendName,
	friendPetCaption,
	friendPetLine,
	friendShareMessage
} from '@/lib/friends'
import {
	friendCodeInPath,
	savePendingFriendCode,
	takePendingFriendCode
} from '@/lib/pendingFriendCode'

jest.mock('@/lib/logger', () => ({ log: { error: jest.fn(), warn: jest.fn() } }))
jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

const pet = (needs: Partial<FriendPet['needs']> = {}): FriendPet => ({
	appearance: lookById('ginger').appearance,
	name: 'Luna',
	mood: 'content',
	needs: { hunger: 'okay', happiness: 'okay', energy: 'okay', affection: 'okay', ...needs }
})

describe('friend links', () => {
	it('holds the code in the app scheme, and gives it back from a link', () => {
		expect(friendLink('KP7XM3QD')).toBe('cozypet://friends/add?code=KP7XM3QD')
		expect(friendCodeInPath('cozypet://friends/add?code=KP7XM3QD')).toBe('KP7XM3QD')
		expect(friendCodeInPath('/friends/add?code=kp7x-m3qd')).toBe('KP7XM3QD')
		expect(friendCodeInPath('/friends/add?x=1&code=KP7XM3QD')).toBe('KP7XM3QD')
	})

	it('ignores every other link, and a code that cannot be one', () => {
		expect(
			friendCodeInPath('exp+cozypet://expo-development-client/?url=http%3A%2F%2F127.0.0.1')
		).toBeNull()
		expect(friendCodeInPath('cozypet:///look')).toBeNull()
		expect(friendCodeInPath('cozypet://friends/add?code=0000')).toBeNull()
		expect(codeFromParam(undefined)).toBeNull()
		expect(codeFromParam(['kp7xm3qd'])).toBe('KP7XM3QD')
	})

	it('shares the code first, then the link', () => {
		const message = friendShareMessage('KP7XM3QD', 'Mochi')
		expect(message).toContain('KP7X-M3QD')
		expect(message.indexOf('KP7X-M3QD')).toBeLessThan(message.indexOf('cozypet://'))
	})
})

describe('naming a friend', () => {
	it("uses their name, else their pet's human", () => {
		expect(friendName({ display_name: 'Ece', pet: pet() })).toBe('Ece')
		expect(friendName({ display_name: null, pet: pet() })).toBe("Luna's human")
		expect(friendName({ display_name: null, pet: null })).toBe('A friend')
		expect(friendPetCaption({ display_name: 'Ece', pet: pet() })).toBe("Ece's cat")
		expect(friendPetCaption({ display_name: null, pet: pet() })).toBe("A friend's cat")
	})
})

describe("the line under a friend's pet", () => {
	it('speaks about a low need first, in the bubble order, never a number', () => {
		expect(friendPetLine(pet({ hunger: 'low' }))).toBe("Luna's a bit hungry.")
		expect(friendPetLine(pet({ hunger: 'low', affection: 'low' }))).toBe('Luna could use a cuddle.')
		expect(friendPetLine(pet({ energy: 'low' }))).toBe("Luna's getting sleepy.")
	})

	it('says great when all is good, fine otherwise', () => {
		expect(
			friendPetLine(pet({ hunger: 'good', happiness: 'good', energy: 'good', affection: 'good' }))
		).toBe("Luna's doing great.")
		expect(friendPetLine(pet())).toBe("Luna's doing fine.")
	})
})

describe('a link that came before the pet', () => {
	beforeEach(() => AsyncStorage.clear())

	it('is kept once, and taken once', async () => {
		await savePendingFriendCode('KP7XM3QD', 1_000)
		expect(await takePendingFriendCode(2_000)).toBe('KP7XM3QD')
		expect(await takePendingFriendCode(3_000)).toBeNull()
	})

	it('is dropped after a day', async () => {
		await savePendingFriendCode('KP7XM3QD', 0)
		expect(await takePendingFriendCode(24 * 60 * 60 * 1000 + 1)).toBeNull()
	})

	it('a newer link replaces an older one', async () => {
		await savePendingFriendCode('KP7XM3QD', 0)
		await savePendingFriendCode('ABCD2345', 10)
		expect(await takePendingFriendCode(20)).toBe('ABCD2345')
	})
})
