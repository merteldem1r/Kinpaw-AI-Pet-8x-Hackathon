/**
 * The pet asking to send its notes (v2-notifications-requirements.md, R13–R14): only under the
 * reaction to a confirmed care, once per visit, never when the bubble has moved on, and gone with
 * its line. The permission checks are async, so the races are tested with promises held open.
 */
import { useState } from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { useNotesAsk } from '@/hooks/useNotesAsk'
import { markAsked, mayAsk, requestNotes } from '@/lib/notifications'
import { NOTES_LINES } from '@/lib/petLines'

jest.mock('@/lib/notifications', () => ({
	mayAsk: jest.fn(),
	markAsked: jest.fn(),
	requestNotes: jest.fn()
}))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/lib/haptics', () => ({ haptic: { success: jest.fn() } }))

const mockMayAsk = jest.mocked(mayAsk)
const mockMarkAsked = jest.mocked(markAsked)
const mockRequest = jest.mocked(requestNotes)

/** The hook with a bubble line of its own, as Home gives it. `null`: no pet yet. */
function renderAsk(name: string | null = 'Mochi') {
	return renderHook(() => {
		const [said, setSaid] = useState<string | null>(null)
		return { said, setSaid, notes: useNotesAsk({ name: name ?? undefined, said, setSaid }) }
	})
}

/** A promise the test settles when it chooses. */
function held<T>() {
	let settle!: (value: T) => void
	const promise = new Promise<T>((resolve) => (settle = resolve))
	return { promise, settle }
}

const YUM = 'Yum! Thank you.'

beforeEach(() => {
	jest.clearAllMocks()
	mockMayAsk.mockResolvedValue(true)
	mockMarkAsked.mockResolvedValue(1)
})

/** A care whose reaction is now the bubble's line. */
function care(result: ReturnType<typeof renderAsk>['result'], line = YUM) {
	act(() => {
		result.current.setSaid(line)
		result.current.notes.cared(line)
	})
}

describe('useNotesAsk', () => {
	it('asks under the confirmed care reaction', async () => {
		const { result } = renderAsk()
		care(result)
		await act(() => result.current.notes.confirmed())
		expect(result.current.notes.asking).toEqual({ line: YUM, attempt: 1 })
		expect(mockMarkAsked).toHaveBeenCalledTimes(1)
	})

	it('asks once per visit, even after more confirmed cares', async () => {
		const { result } = renderAsk()
		care(result)
		await act(() => result.current.notes.confirmed())
		care(result, 'Purr.')
		await act(() => result.current.notes.confirmed())
		expect(mockMarkAsked).toHaveBeenCalledTimes(1)
	})

	it('stops checking for this visit when it may not ask', async () => {
		mockMayAsk.mockResolvedValue(false)
		const { result } = renderAsk()
		care(result)
		await act(() => result.current.notes.confirmed())
		await act(() => result.current.notes.confirmed())
		expect(mockMayAsk).toHaveBeenCalledTimes(1)
		expect(result.current.notes.asking).toBeNull()
	})

	it("doesn't ask when the bubble moved on during the check, and asks on the next care", async () => {
		const check = held<boolean>()
		mockMayAsk.mockReturnValueOnce(check.promise)
		const { result } = renderAsk()
		care(result)
		let pending!: Promise<void>
		act(() => {
			pending = result.current.notes.confirmed()
		})
		act(() => result.current.setSaid('A reply about your day.'))
		await act(async () => {
			check.settle(true)
			await pending
		})
		expect(result.current.notes.asking).toBeNull()
		expect(mockMarkAsked).not.toHaveBeenCalled()

		care(result, 'Purr.')
		await act(() => result.current.notes.confirmed())
		expect(result.current.notes.asking).toEqual({ line: 'Purr.', attempt: 1 })
	})

	it('checks once when two confirmations land together', async () => {
		const check = held<boolean>()
		mockMayAsk.mockReturnValueOnce(check.promise)
		const { result } = renderAsk()
		care(result)
		let first!: Promise<void>
		act(() => {
			first = result.current.notes.confirmed()
		})
		await act(() => result.current.notes.confirmed())
		await act(async () => {
			check.settle(true)
			await first
		})
		expect(mockMayAsk).toHaveBeenCalledTimes(1)
		expect(mockMarkAsked).toHaveBeenCalledTimes(1)
	})

	it('drops the ask when the line changes, and it does not come back with the line', async () => {
		const { result } = renderAsk()
		care(result)
		await act(() => result.current.notes.confirmed())
		act(() => result.current.setSaid('Purr.'))
		expect(result.current.notes.asking).toBeNull()
		act(() => result.current.setSaid(YUM))
		expect(result.current.notes.asking).toBeNull()
	})

	it('never asks before there is a pet or a care', async () => {
		const noPet = renderAsk(null)
		care(noPet.result)
		await act(() => noPet.result.current.notes.confirmed())
		const noCare = renderAsk()
		await act(() => noCare.result.current.notes.confirmed())
		expect(mockMayAsk).not.toHaveBeenCalled()
	})

	it('answers Not now without asking iOS', async () => {
		const { result } = renderAsk()
		care(result)
		await act(() => result.current.notes.confirmed())
		await act(() => result.current.notes.answer(false))
		expect(mockRequest).not.toHaveBeenCalled()
		expect(result.current.said).toBe(NOTES_LINES.notNow)
		expect(result.current.notes.asking).toBeNull()
	})

	it('answers Yes by asking iOS, and the pet says how it went', async () => {
		const { result } = renderAsk()
		care(result)
		await act(() => result.current.notes.confirmed())
		mockRequest.mockResolvedValueOnce(true)
		await act(() => result.current.notes.answer(true))
		expect(mockRequest).toHaveBeenCalledWith('bubble')
		expect(result.current.said).toBe(NOTES_LINES.allowed)
	})

	it('says so when iOS refuses', async () => {
		const { result } = renderAsk()
		care(result)
		await act(() => result.current.notes.confirmed())
		mockRequest.mockResolvedValueOnce(false)
		await act(() => result.current.notes.answer(true))
		expect(result.current.said).toBe(NOTES_LINES.refused)
	})
})
