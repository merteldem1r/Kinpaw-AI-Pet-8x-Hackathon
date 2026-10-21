/**
 * After the code is right (m4-save-your-pet-requirements.md): the pet being made is saved, or
 * for Welcome back the account's pet is found (and wins over a half-made one), or Create starts;
 * a failure stays with "Try again"; the pet's line moves on while it goes home.
 */
import { createElement, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { router } from 'expo-router'
import { lookById, type Pet } from '@app/contract'
import { usePetDraft } from '@/contexts/PetDraftContext'
import { GOING_HOME_MS, useAfterSignIn } from '@/hooks/useAfterSignIn'
import { fetchPet, PET_QUERY_KEY, useSavePet } from '@/hooks/usePet'
import type { PetDraft } from '@/lib/petDraft'
import { GOING_HOME_LINE_MS } from '@/lib/signIn'

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))
jest.mock('@/contexts/PetDraftContext', () => ({ usePetDraft: jest.fn() }))
jest.mock('@/hooks/usePet', () => ({
	PET_QUERY_KEY: ['pet'],
	fetchPet: jest.fn(),
	useSavePet: jest.fn()
}))
jest.mock('@/lib/haptics', () => ({ haptic: { warning: jest.fn() } }))
jest.mock('@/lib/createFlow', () => ({ createStepRoute: (step: string) => `/(create)/${step}` }))

const mockSave = jest.fn()
const mockDraft = { draft: null as PetDraft | null, start: jest.fn(), clear: jest.fn() }

const draft = {
	id: 'd1',
	step: 'name',
	species: 'cat',
	name: 'Mochi'
} as unknown as PetDraft
const pet = { id: 'p1', name: 'Luna', appearance: lookById('ginger').appearance } as unknown as Pet

let queryClient: QueryClient
function wrapper({ children }: { children: ReactNode }) {
	return createElement(QueryClientProvider, { client: queryClient }, children)
}

beforeEach(() => {
	jest.useFakeTimers()
	jest.clearAllMocks()
	queryClient = new QueryClient()
	mockDraft.draft = null
	mockDraft.start.mockReturnValue({ ...draft, step: 'start' })
	jest.mocked(usePetDraft).mockReturnValue(mockDraft as unknown as ReturnType<typeof usePetDraft>)
	jest.mocked(useSavePet).mockReturnValue(mockSave)
	mockSave.mockResolvedValue({ existing: false })
})
afterEach(() => jest.useRealTimers())

describe('saving the pet being made', () => {
	it('saves the draft, held for the going-home moment, with hearts', async () => {
		const { result } = renderHook(() => useAfterSignIn(draft), { wrapper })
		await act(async () => result.current.signedIn())
		expect(mockSave).toHaveBeenCalledWith(draft, { holdMs: GOING_HOME_MS })
		expect(result.current.after).toBe('saving')
		expect(result.current.hearts).toEqual([
			expect.objectContaining({ kind: 'pet', species: 'cat' })
		])
	})

	it('stays with "Try again" when the save fails, and tries again', async () => {
		mockSave.mockRejectedValueOnce(new Error('offline'))
		const { result } = renderHook(() => useAfterSignIn(draft), { wrapper })
		await act(async () => result.current.signedIn())
		expect(result.current.after).toBe('save_failed')
		await act(async () => result.current.signedIn())
		expect(mockSave).toHaveBeenCalledTimes(2)
		expect(result.current.after).toBe('saving')
	})

	it("moves the pet's line on while it goes home, and starts from the first", async () => {
		mockSave.mockReturnValue(new Promise(() => {}))
		const { result } = renderHook(() => useAfterSignIn(draft), { wrapper })
		await act(async () => result.current.signedIn())
		expect(result.current.tick).toBe(0)
		act(() => jest.advanceTimersByTime(GOING_HOME_LINE_MS * 2))
		expect(result.current.tick).toBe(2)
	})
})

describe('welcome back', () => {
	it("puts the account's pet in the cache after the moment, over a half-made one", async () => {
		mockDraft.draft = draft
		jest.mocked(fetchPet).mockResolvedValue(pet)
		const { result } = renderHook(() => useAfterSignIn(null), { wrapper })
		await act(async () => result.current.signedIn())
		expect(result.current.after).toBe('finding')
		expect(mockDraft.clear).toHaveBeenCalled()
		expect(queryClient.getQueryData(PET_QUERY_KEY)).toBeUndefined()
		await act(async () => jest.advanceTimersByTime(GOING_HOME_MS))
		expect(queryClient.getQueryData(PET_QUERY_KEY)).toEqual(pet)
		expect(router.replace).not.toHaveBeenCalled()
	})

	it('resumes the half-made pet when the account has none', async () => {
		mockDraft.draft = draft
		jest.mocked(fetchPet).mockResolvedValue(null)
		const { result } = renderHook(() => useAfterSignIn(null), { wrapper })
		await act(async () => result.current.signedIn())
		expect(router.replace).toHaveBeenCalledWith('/(create)/name')
		expect(mockDraft.start).not.toHaveBeenCalled()
	})

	it('starts Create when there is no pet anywhere', async () => {
		jest.mocked(fetchPet).mockResolvedValue(null)
		const { result } = renderHook(() => useAfterSignIn(null), { wrapper })
		await act(async () => result.current.signedIn())
		expect(mockDraft.start).toHaveBeenCalled()
		expect(router.replace).toHaveBeenCalledWith('/(create)/start')
	})

	it('stays with "Try again" when the pet cannot be reached', async () => {
		jest.mocked(fetchPet).mockRejectedValue(new Error('offline'))
		const { result } = renderHook(() => useAfterSignIn(null), { wrapper })
		await act(async () => result.current.signedIn())
		expect(result.current.after).toBe('find_failed')
		expect(mockSave).not.toHaveBeenCalled()
	})
})
