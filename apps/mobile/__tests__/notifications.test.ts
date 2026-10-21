/**
 * The pet's notes on the phone (docs/application/features/v2-notifications-requirements.md):
 * scheduled only when on, never more than three, always cancelled before scheduling again and on
 * return or sign-out; the bubble asks once, then once more 3 days later, then never.
 */
import type { Pet } from '@app/contract'

jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/lib/logger', () => ({ log: { warn: jest.fn(), error: jest.fn() } }))

const permission = { status: 'undetermined', granted: false, canAskAgain: true, ios: { status: 0 } }
const calls: string[] = []
jest.mock('expo-notifications', () => ({
	PermissionStatus: { UNDETERMINED: 'undetermined', GRANTED: 'granted', DENIED: 'denied' },
	IosAuthorizationStatus: {
		NOT_DETERMINED: 0,
		DENIED: 1,
		AUTHORIZED: 2,
		PROVISIONAL: 3,
		EPHEMERAL: 4
	},
	SchedulableTriggerInputTypes: { DATE: 'date' },
	setNotificationHandler: jest.fn(),
	getPermissionsAsync: jest.fn(async () => ({ ...permission })),
	requestPermissionsAsync: jest.fn(async () => ({ ...permission })),
	scheduleNotificationAsync: jest.fn(async ({ identifier }: { identifier: string }) => {
		calls.push(`schedule ${identifier}`)
		return identifier
	}),
	cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
		calls.push(`cancel ${id}`)
	}),
	dismissAllNotificationsAsync: jest.fn(async () => {
		calls.push('dismiss')
	})
}))

type NotificationsModule = typeof import('@/lib/notifications')
type ExpoNotifications = typeof import('expo-notifications')

const pet = {
	name: 'Mochi',
	appearance: { species: 'cat' },
	needs: {
		hunger: 100,
		happiness: 100,
		energy: 100,
		affection: 100,
		updated_at: '2026-10-05T07:00:00.000Z'
	}
} as unknown as Pet

function allow(granted: boolean) {
	Object.assign(
		permission,
		granted
			? { status: 'granted', granted: true, canAskAgain: true, ios: { status: 2 } }
			: { status: 'denied', granted: false, canAskAgain: false, ios: { status: 1 } }
	)
}

let notes: NotificationsModule
let schedule: jest.MockedFunction<ExpoNotifications['scheduleNotificationAsync']>

beforeEach(async () => {
	jest.resetModules()
	calls.length = 0
	Object.assign(permission, {
		status: 'undetermined',
		granted: false,
		canAskAgain: true,
		ios: { status: 0 }
	})
	const storage = jest.requireMock('@react-native-async-storage/async-storage')
	await (storage.default ?? storage).clear()
	// Fresh each test: the module keeps the person's choices in memory once read.
	notes = jest.requireActual<NotificationsModule>('@/lib/notifications')
	schedule = jest.mocked(
		jest.requireMock<ExpoNotifications>('expo-notifications').scheduleNotificationAsync
	)
	jest.clearAllMocks()
})

describe('state', () => {
	it('is unasked, then on once allowed, off with the toggle, denied when refused', async () => {
		expect(await notes.notesState()).toBe('unasked')
		allow(true)
		expect(await notes.notesState()).toBe('on')
		await notes.setNotesEnabled(false)
		expect(await notes.notesState()).toBe('off')
		allow(false)
		expect(await notes.notesState()).toBe('denied')
	})
})

describe('scheduleNudges', () => {
	const leftAt = new Date('2026-10-05T07:00:00.000Z')

	it('cancels the old notes first, then schedules three, in the pet voice, with labels only', async () => {
		allow(true)
		await notes.scheduleNudges(pet, 'Mert Eldemir', leftAt)
		expect(calls).toEqual([
			'cancel nudge-1',
			'cancel nudge-2',
			'cancel nudge-3',
			'schedule nudge-1',
			'schedule nudge-2',
			'schedule nudge-3'
		])
		const [first] = schedule.mock.calls[0]
		expect(first.content.title).toBe('Mochi')
		expect(first.content.data).toEqual({ kind: 'nudge', day: 1, need: 'hunger' })
		expect(first.trigger).toEqual({ type: 'date', date: expect.any(Date) })
	})

	it('schedules nothing when notes are off, refused or never allowed', async () => {
		await notes.scheduleNudges(pet, null, leftAt)
		allow(true)
		await notes.setNotesEnabled(false)
		await notes.scheduleNudges(pet, null, leftAt)
		allow(false)
		await notes.scheduleNudges(pet, null, leftAt)
		expect(schedule).not.toHaveBeenCalled()
	})

	it('never repeats a line from one absence to the next', async () => {
		allow(true)
		await notes.scheduleNudges(pet, null, leftAt)
		await notes.scheduleNudges(pet, null, leftAt)
		const bodies = schedule.mock.calls.map(([request]) => request.content.body)
		expect(bodies[0]).not.toBe(bodies[3])
	})

	it('lets a cancel asked for after a schedule run after it', async () => {
		allow(true)
		const scheduled = notes.scheduleNudges(pet, null, leftAt)
		const cancelled = notes.cancelNudges()
		await Promise.all([scheduled, cancelled])
		expect(calls.slice(-4)).toEqual([
			'cancel nudge-1',
			'cancel nudge-2',
			'cancel nudge-3',
			'dismiss'
		])
	})
})

describe('the bubble ask', () => {
	const DAY = 24 * 60 * 60 * 1000

	it('asks once, once more 3 days later, then never', async () => {
		const now = Date.parse('2026-10-05T10:00:00Z')
		expect(await notes.mayAsk(now)).toBe(true)
		expect(await notes.markAsked(now)).toBe(1)
		expect(await notes.mayAsk(now + 2 * DAY)).toBe(false)
		expect(await notes.mayAsk(now + 3 * DAY)).toBe(true)
		expect(await notes.markAsked(now + 3 * DAY)).toBe(2)
		expect(await notes.mayAsk(now + 30 * DAY)).toBe(false)
	})

	it('never asks once iOS has an answer', async () => {
		allow(true)
		expect(await notes.mayAsk()).toBe(false)
		allow(false)
		expect(await notes.mayAsk()).toBe(false)
	})

	it('starts over for the next person after sign-out, with nothing pending', async () => {
		await notes.markAsked()
		await notes.markAsked(Date.now() + 4 * DAY)
		await notes.resetNotesForSignOut()
		expect(await notes.mayAsk()).toBe(true)
		expect(calls).toContain('dismiss')
	})
})

describe('nudgeData', () => {
	it('accepts only a note of ours with valid labels', () => {
		expect(notes.nudgeData({ kind: 'nudge', day: 2, need: 'energy' })).toEqual({
			kind: 'nudge',
			day: 2,
			need: 'energy'
		})
		expect(notes.nudgeData({ kind: 'nudge', day: 4, need: 'energy' })).toBeNull()
		expect(notes.nudgeData({ kind: 'nudge', day: 1, need: 'sleep' })).toBeNull()
		expect(notes.nudgeData({ kind: 'other' })).toBeNull()
		expect(notes.nudgeData(null)).toBeNull()
	})

	it('hands the opened note to the greeting once', () => {
		notes.rememberOpenedNudge({ kind: 'nudge', day: 1, need: 'hunger' })
		expect(notes.takeOpenedNudge()).toEqual({ kind: 'nudge', day: 1, need: 'hunger' })
		expect(notes.takeOpenedNudge()).toBeNull()
	})
})
