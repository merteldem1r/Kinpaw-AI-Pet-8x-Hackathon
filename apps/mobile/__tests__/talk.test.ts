/**
 * Talking to the pet (m6-talk-requirements.md, R18–R23): one message at a time, the last three
 * exchanges sent along, the daily limit, the voice asked for with the reply, and a failed
 * message that can be retried under the same id (so it never counts twice) or left behind.
 */
import { createElement, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Pet } from '@app/contract'
import { useTalk } from '@/hooks/useTalk'
import { track } from '@/lib/analytics'
import { api } from '@/lib/api'
import { canSpeak, fetchReplyVoice } from '@/lib/petVoice'

jest.mock('@/lib/api', () => ({
	api: jest.fn(),
	errorCode: (error: unknown) => (error as { code?: string }).code ?? null
}))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/lib/timeZone', () => ({ deviceTimeZone: () => 'UTC' }))
jest.mock('@/lib/petVoice', () => ({ canSpeak: jest.fn(), fetchReplyVoice: jest.fn() }))
let mockIds = 0
jest.mock('@/lib/ids', () => ({ newId: () => `message-${++mockIds}` }))
// Their other exports reach the API client and storage; only the cache keys are needed here.
jest.mock('@/hooks/usePet', () => ({ PET_QUERY_KEY: ['pet'] }))
jest.mock('@/hooks/useMemories', () => ({ MEMORIES_QUERY_KEY: ['memories'] }))

const mockApi = jest.mocked(api)
const mockTrack = jest.mocked(track)
const mockCanSpeak = jest.mocked(canSpeak)
const mockFetchVoice = jest.mocked(fetchReplyVoice)

const pet = { id: 'p1', name: 'Mochi' } as unknown as Pet

const replied = (reply: string, over: Record<string, unknown> = {}) => ({
	outcome: 'replied',
	reply,
	intent: 'kind',
	suggested_action: null,
	need_changed: true,
	pet,
	messages_left: 7,
	...over
})

let queryClient: QueryClient

function setup() {
	const callbacks = { onAnswer: jest.fn(), onTalkedOut: jest.fn(), onFailed: jest.fn() }
	const hook = renderHook(() => useTalk(callbacks), {
		wrapper: ({ children }: { children: ReactNode }) =>
			createElement(QueryClientProvider, { client: queryClient }, children)
	})
	/** Says something and lets the answer land. */
	const say = async (text: string, input: 'voice' | 'typed' = 'typed') => {
		let sent = false
		await act(async () => {
			sent = hook.result.current.send(text, input)
		})
		return sent
	}
	return { ...hook, callbacks, say }
}

/** The body of the nth talk request. */
const body = (n: number) => (mockApi.mock.calls[n]![1] as { body: Record<string, unknown> }).body

beforeEach(() => {
	jest.clearAllMocks()
	mockIds = 0
	queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
	mockCanSpeak.mockResolvedValue(false)
	mockApi.mockImplementation(async () => replied('Purr. Hello!'))
})
afterEach(() => queryClient.clear())

describe('sending', () => {
	it("sends the words, trimmed, and hands the reply to Home with the server's pet", async () => {
		const { result, say, callbacks } = setup()
		expect(await say('  hello Mochi  ')).toBe(true)
		expect(mockApi).toHaveBeenCalledWith('petTalk', {
			body: {
				message_id: 'message-1',
				text: 'hello Mochi',
				input: 'typed',
				time_zone: 'UTC',
				recent: []
			},
			timeoutMs: expect.any(Number)
		})
		expect(callbacks.onAnswer).toHaveBeenCalledWith(
			expect.objectContaining({ reply: 'Purr. Hello!', messageId: 'message-1', voice: null })
		)
		expect(queryClient.getQueryData(['pet'])).toBe(pet)
		expect(result.current.messagesLeft).toBe(7)
		expect(result.current.state).toEqual({ status: 'idle' })
	})

	it('sends nothing for empty words', async () => {
		const { say } = setup()
		expect(await say('   ')).toBe(false)
		expect(mockApi).not.toHaveBeenCalled()
	})

	it('takes one message at a time, showing the words while the pet thinks', async () => {
		let answer!: (value: unknown) => void
		mockApi.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)) as never)
		const { result, say } = setup()
		await say('first')
		expect(result.current.state).toEqual({ status: 'thinking', words: 'first' })
		expect(await say('second')).toBe(false)
		await act(async () => answer(replied('ok')))
		expect(await say('second')).toBe(true)
		expect(mockApi).toHaveBeenCalledTimes(2)
	})

	it('sends the last three exchanges along, never more', async () => {
		const { say } = setup()
		for (const words of ['one', 'two', 'three', 'four']) {
			mockApi.mockImplementationOnce(async () => replied(`re ${words}`))
			await say(words)
		}
		await say('five')
		expect(body(4).recent).toEqual([
			{ said: 'two', reply: 're two' },
			{ said: 'three', reply: 're three' },
			{ said: 'four', reply: 're four' }
		])
	})

	it('marks what was kept from memory stale when a reply keeps a fact', async () => {
		mockApi.mockImplementationOnce(async () =>
			replied('I will remember that!', { remembered: { id: 'f1', text: 'Exam on Friday' } })
		)
		const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
		const { say, callbacks } = setup()
		await say('I have an exam on Friday')
		expect(invalidate).toHaveBeenCalledWith({ queryKey: ['memories'] })
		expect(callbacks.onAnswer).toHaveBeenCalledWith(
			expect.objectContaining({ remembered: { id: 'f1', text: 'Exam on Friday' } })
		)
	})
})

describe('the voice', () => {
	it('asks for the voice with the reply when the pet speaks, and passes it to Home', async () => {
		mockCanSpeak.mockResolvedValue(true)
		const voice = Promise.resolve({ url: 'file://r.m4a', rate: 1.15, generation: 1 })
		mockFetchVoice.mockReturnValue(voice)
		const { say, callbacks } = setup()
		await say('hello', 'voice')
		expect(body(0).voice).toBe(true)
		expect(mockFetchVoice).toHaveBeenCalledWith('message-1', 'Purr. Hello!')
		expect(callbacks.onAnswer.mock.calls[0]![0].voice).toBe(voice)
	})
})

describe('the daily limit', () => {
	it('tells Home when a free account has nothing left today, with no reply', async () => {
		mockApi.mockImplementationOnce(async () => ({
			outcome: 'limit_reached',
			pet,
			messages_left: 0
		}))
		const { result, say, callbacks } = setup()
		await say('hello')
		expect(callbacks.onTalkedOut).toHaveBeenCalled()
		expect(callbacks.onAnswer).not.toHaveBeenCalled()
		expect(result.current.messagesLeft).toBe(0)
		expect(mockTrack).toHaveBeenCalledWith('talk_limit_reached')
	})

	it('records reaching the limit on the last free reply', async () => {
		mockApi.mockImplementationOnce(async () => replied('Bye for today!', { messages_left: 0 }))
		const { say, callbacks } = setup()
		await say('hello')
		expect(callbacks.onAnswer).toHaveBeenCalled()
		expect(mockTrack).toHaveBeenCalledWith('talk_limit_reached')
	})
})

describe('a failed message', () => {
	it('says the pet is not connected when the model or the network is the reason', async () => {
		mockApi.mockRejectedValueOnce({ code: 'talk_unavailable' })
		const { result, say, callbacks } = setup()
		await say('hello')
		expect(result.current.state).toEqual({
			status: 'failed',
			words: 'hello',
			failure: 'not_connected'
		})
		expect(callbacks.onFailed).toHaveBeenCalledWith('not_connected')
	})

	it('says the pet dozed off for anything else', async () => {
		mockApi.mockRejectedValueOnce({ code: 'invalid_response' })
		const { result, say } = setup()
		await say('hello')
		expect(result.current.state).toEqual(expect.objectContaining({ failure: 'dozed_off' }))
	})

	it('retries under the same id, so it can never count twice', async () => {
		mockApi.mockRejectedValueOnce({ code: 'timeout' })
		const { result, say, callbacks } = setup()
		await say('hello')
		await act(async () => result.current.retry())
		expect(mockApi).toHaveBeenCalledTimes(2)
		expect(body(1).message_id).toBe(body(0).message_id)
		expect(callbacks.onAnswer).toHaveBeenCalledTimes(1)
	})

	it('is left behind when the person moves on, and cannot be retried after', async () => {
		mockApi.mockRejectedValueOnce({ code: 'offline' })
		const { result, say } = setup()
		await say('hello')
		act(() => result.current.forget())
		expect(result.current.state).toEqual({ status: 'idle' })
		await act(async () => result.current.retry())
		expect(mockApi).toHaveBeenCalledTimes(1)
	})
})
