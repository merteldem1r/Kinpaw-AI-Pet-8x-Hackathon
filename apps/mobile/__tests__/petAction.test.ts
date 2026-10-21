/**
 * Feed, Play and Pet (m5-home-core-loop-requirements.md, R9–R10): the needs change on screen at
 * once, requests go one at a time in order, only the last answer in flight is written back (an
 * earlier one would undo the taps still on their way), and a failure refetches the pet rather
 * than restoring a snapshot that could undo a tap that did land.
 */
import { createElement, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lookById, type Pet, type PetAction } from '@app/contract'
import { PET_QUERY_KEY } from '@/hooks/usePet'
import { usePetAction } from '@/hooks/usePetAction'
import { track } from '@/lib/analytics'
import { api } from '@/lib/api'

jest.mock('@/lib/api', () => ({
	api: jest.fn(),
	errorCode: (error: unknown) => (error as { code?: string }).code ?? null
}))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/lib/timeZone', () => ({ deviceTimeZone: () => 'UTC' }))
// usePet's other exports reach the API client and storage; only the cache key is needed here.
jest.mock('@/hooks/usePet', () => ({ PET_QUERY_KEY: ['pet'] }))

const mockApi = jest.mocked(api)
const mockTrack = jest.mocked(track)

/** A pet as the server sends it, with these needs stored just now. */
function petWith(needs: { hunger: number; happiness: number; energy: number; affection: number }) {
	return {
		id: '00000000-0000-4000-8000-000000000001',
		appearance: lookById('ginger').appearance,
		look_id: 'ginger',
		name: 'Mochi',
		preset: 'cuddly',
		traits: {},
		needs: { ...needs, updated_at: new Date().toISOString() },
		created_at: new Date().toISOString()
	} as unknown as Pet
}

/** A request the test answers when it chooses. */
function held() {
	let answer!: (value: { pet: Pet; changed: boolean }) => void
	let fail!: (error: unknown) => void
	const promise = new Promise<{ pet: Pet; changed: boolean }>((resolve, reject) => {
		answer = resolve
		fail = reject
	})
	return { promise, answer, fail }
}

const HUNGRY = { hunger: 30, happiness: 60, energy: 70, affection: 60 }

let queryClient: QueryClient
/** TanStack calls the request a tick after the tap: let that tick pass. */
const sent = () => act(async () => {})
const cachedPet = () => queryClient.getQueryData<Pet>(PET_QUERY_KEY)!

function setup(callbacks = { onFailed: jest.fn(), onConfirmed: jest.fn() }) {
	const hook = renderHook(() => usePetAction(callbacks), {
		wrapper: ({ children }: { children: ReactNode }) =>
			createElement(QueryClientProvider, { client: queryClient }, children)
	})
	return { ...hook, callbacks, tap: (action: PetAction) => hook.result.current(action) }
}

beforeEach(() => {
	jest.clearAllMocks()
	// No garbage-collection timers: they would keep Jest running after the tests.
	queryClient = new QueryClient({
		defaultOptions: {
			queries: { gcTime: Infinity },
			mutations: { retry: false, gcTime: Infinity }
		}
	})
	queryClient.setQueryData(PET_QUERY_KEY, petWith(HUNGRY))
})
afterEach(() => queryClient.clear())

describe('usePetAction', () => {
	it('changes the needs on screen at once, before the server answers', async () => {
		mockApi.mockReturnValue(held().promise)
		const { tap } = setup()
		let outcome: ReturnType<typeof tap> = null
		act(() => {
			outcome = tap('feed')
		})
		expect(outcome).toEqual(expect.objectContaining({ changed: true }))
		expect(cachedPet().needs.hunger).toBeGreaterThan(HUNGRY.hunger)
		await sent()
		expect(mockApi).toHaveBeenCalledWith('petAction', {
			body: { action: 'feed', time_zone: 'UTC' }
		})
	})

	it('does nothing before there is a pet', () => {
		queryClient.removeQueries({ queryKey: PET_QUERY_KEY })
		const { tap } = setup()
		let outcome: ReturnType<typeof tap> = petWith(HUNGRY) as never
		act(() => {
			outcome = tap('feed')
		})
		expect(outcome).toBeNull()
		expect(mockApi).not.toHaveBeenCalled()
	})

	it("writes the server's answer back, and says the care was confirmed", async () => {
		const request = held()
		mockApi.mockReturnValue(request.promise)
		const { tap, callbacks } = setup()
		act(() => {
			tap('feed')
		})
		await sent()
		const fromServer = petWith({ ...HUNGRY, hunger: 55 })
		await act(async () => request.answer({ pet: fromServer, changed: true }))
		expect(cachedPet()).toEqual(fromServer)
		expect(callbacks.onConfirmed).toHaveBeenCalledWith('feed')
		expect(mockTrack).toHaveBeenCalledWith(
			'pet_action_taken',
			expect.objectContaining({ action: 'feed', need_changed: true, suggested: false })
		)
	})

	it('sends taps one at a time, in the order they were made', async () => {
		const first = held()
		const second = held()
		mockApi.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
		const { tap } = setup()
		act(() => {
			tap('feed')
			tap('pet')
		})
		await sent()
		expect(mockApi).toHaveBeenCalledTimes(1)
		await act(async () => first.answer({ pet: petWith(HUNGRY), changed: true }))
		await sent()
		expect(mockApi).toHaveBeenCalledTimes(2)
		expect(mockApi).toHaveBeenLastCalledWith('petAction', {
			body: { action: 'pet', time_zone: 'UTC' }
		})
	})

	it('keeps the later taps on screen while their answers are on the way', async () => {
		const first = held()
		const second = held()
		mockApi.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
		const { tap } = setup()
		act(() => {
			tap('feed')
			tap('pet')
		})
		const shownAfterBoth = cachedPet()
		await sent()
		// The first answer knows nothing of the second tap: writing it would undo Pet on screen.
		await act(async () => first.answer({ pet: petWith(HUNGRY), changed: true }))
		await sent()
		expect(cachedPet()).toBe(shownAfterBoth)
		const last = petWith({ ...HUNGRY, hunger: 55, affection: 80 })
		await act(async () => second.answer({ pet: last, changed: true }))
		expect(cachedPet()).toEqual(last)
	})

	it('refetches the pet on a failure, and tells the screen', async () => {
		const request = held()
		mockApi.mockReturnValue(request.promise)
		const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
		const { tap, callbacks } = setup()
		act(() => {
			tap('play')
		})
		await sent()
		await act(async () => request.fail({ code: 'offline' }))
		expect(invalidate).toHaveBeenCalledWith({ queryKey: PET_QUERY_KEY })
		expect(callbacks.onFailed).toHaveBeenCalledWith('play')
		expect(callbacks.onConfirmed).not.toHaveBeenCalled()
		expect(mockTrack).toHaveBeenCalledWith('pet_action_failed', {
			action: 'play',
			error_kind: 'offline'
		})
	})

	it("says a care can't help when it changes nothing (Feed when full)", () => {
		queryClient.setQueryData(PET_QUERY_KEY, petWith({ ...HUNGRY, hunger: 100 }))
		mockApi.mockReturnValue(held().promise)
		const { tap } = setup()
		let outcome: ReturnType<typeof tap> = null
		act(() => {
			outcome = tap('feed')
		})
		expect(outcome).toEqual(expect.objectContaining({ changed: false }))
	})
})
