/**
 * "Tell me about you" offered in Home's bubble (v2-memory-requirements.md, R18): once per pet on
 * this phone, only while the step is open, never while a just-saved pet is in the intro, and gone
 * when withdrawn.
 */
import { act, renderHook } from '@testing-library/react-native'
import type { Pet } from '@app/contract'
import { useIntroDue } from '@/hooks/useIntro'
import { useIntroOffer } from '@/hooks/useIntroOffer'
import { introOffered, markIntroOffered, useIntroAfterSave } from '@/lib/introOffer'

jest.mock('@/hooks/useIntro', () => ({ useIntroDue: jest.fn() }))
jest.mock('@/lib/introOffer', () => ({
	introOffered: jest.fn(),
	markIntroOffered: jest.fn(),
	useIntroAfterSave: jest.fn()
}))

const mockDue = jest.mocked(useIntroDue)
const mockOffered = jest.mocked(introOffered)
const mockMark = jest.mocked(markIntroOffered)
const mockAfterSave = jest.mocked(useIntroAfterSave)

/** Lets the phone's "already offered?" answer land, inside act. */
const settled = () => act(async () => {})

beforeEach(() => {
	jest.clearAllMocks()
	mockDue.mockReturnValue(true)
	// As on the phone: once marked, the pet has been offered it.
	const offered = new Set<string>()
	mockOffered.mockImplementation(async (id) => offered.has(id))
	mockMark.mockImplementation(async (id) => {
		offered.add(id)
	})
	mockAfterSave.mockReturnValue(null)
})

describe('useIntroOffer', () => {
	it('offers once to a pet that has not had it, and remembers that on the phone', async () => {
		const { result } = renderHook(() => useIntroOffer(true, 'pet-1'))
		await settled()
		expect(result.current.offering).toBe(true)
		expect(mockMark).toHaveBeenCalledWith('pet-1')
	})

	it('does not offer again to a pet already offered it on this phone', async () => {
		mockOffered.mockResolvedValue(true)
		const { result } = renderHook(() => useIntroOffer(true, 'pet-1'))
		await settled()
		expect(mockOffered).toHaveBeenCalled()
		expect(result.current.offering).toBe(false)
		expect(mockMark).not.toHaveBeenCalled()
	})

	it('waits while Home is away, there is no pet, the step is closed or a new pet is in the intro', async () => {
		renderHook(() => useIntroOffer(false, 'pet-1'))
		renderHook(() => useIntroOffer(true, undefined))
		mockDue.mockReturnValue(false)
		renderHook(() => useIntroOffer(true, 'pet-1'))
		mockDue.mockReturnValue(true)
		mockAfterSave.mockReturnValue({ id: 'pet-2' } as Pet)
		renderHook(() => useIntroOffer(true, 'pet-2'))
		await settled()
		expect(mockOffered).not.toHaveBeenCalled()
	})

	it('withdraws the offer when ended, and when the step closes', async () => {
		const { result, rerender } = renderHook(() => useIntroOffer(true, 'pet-1'))
		await settled()
		expect(result.current.offering).toBe(true)
		mockDue.mockReturnValue(false)
		rerender({})
		expect(result.current.offering).toBe(false)

		mockDue.mockReturnValue(true)
		rerender({})
		expect(result.current.offering).toBe(true)
		act(() => result.current.end())
		await settled()
		expect(result.current.offering).toBe(false)
	})
})
