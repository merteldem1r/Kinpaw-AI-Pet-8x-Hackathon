/**
 * The reply's voice on Home (v2-voice-requirements.md): which reply it belongs to, "on its way"
 * until it plays, a newer reply taking over, the day's limit said once, and stopping when the app
 * goes to the background (R9).
 */
import { AppState, type AppStateStatus } from 'react-native'
import { act, renderHook } from '@testing-library/react-native'
import { useReplyVoice } from '@/hooks/useReplyVoice'
import type { TalkAnswer } from '@/hooks/useTalk'
import { OUT_OF_VOICE_LINE } from '@/lib/petLines'
import { playReplyVoice, stopVoice, type ReadyVoice } from '@/lib/petVoice'

const mockShowToast = jest.fn()
jest.mock('@/contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }))
jest.mock('@/lib/petVoice', () => ({
	playReplyVoice: jest.fn(),
	stopVoice: jest.fn(),
	useVoiceSpeaking: () => null
}))

const mockPlay = jest.mocked(playReplyVoice)
const mockStop = jest.mocked(stopVoice)

const VOICE: ReadyVoice = { url: 'file://reply.m4a', rate: 1.15, generation: 1 }

const answer = (reply: string, voice: Promise<ReadyVoice> | null): TalkAnswer => ({
	messageId: `m-${reply}`,
	input: 'voice',
	voice,
	reply,
	intent: 'kind',
	suggestedAction: null,
	needChanged: false,
	remembered: null,
	recalled: null
})

/** A promise the test settles when it chooses. */
function held<T>() {
	let settle!: (value: T) => void
	const promise = new Promise<T>((resolve) => (settle = resolve))
	return { promise, settle }
}

beforeEach(() => {
	jest.clearAllMocks()
	mockPlay.mockResolvedValue(null)
})

describe('useReplyVoice', () => {
	it('marks the reply as voiced and on its way until its voice plays', async () => {
		const voice = held<ReadyVoice>()
		const { result } = renderHook(() => useReplyVoice())
		act(() => result.current.play(answer('Hello!', voice.promise)))
		expect(result.current.voicedLine).toBe('Hello!')
		expect(result.current.voiceComing).toBe(true)
		await act(async () => voice.settle(VOICE))
		expect(mockPlay).toHaveBeenCalledWith(VOICE, 'voice')
		expect(result.current.voiceComing).toBe(false)
	})

	it('voices nothing for a reply without a voice', () => {
		const { result } = renderHook(() => useReplyVoice())
		act(() => result.current.play(answer('Hello!', null)))
		expect(result.current.voicedLine).toBeNull()
		expect(result.current.voiceComing).toBe(false)
	})

	it('lets a newer reply own "on its way", whatever the older voice does', async () => {
		const older = held<ReadyVoice>()
		const newer = held<ReadyVoice>()
		const { result } = renderHook(() => useReplyVoice())
		act(() => result.current.play(answer('First', older.promise)))
		act(() => result.current.play(answer('Second', newer.promise)))
		await act(async () => older.settle(VOICE))
		expect(result.current.voicedLine).toBe('Second')
		expect(result.current.voiceComing).toBe(true)
		await act(async () => newer.settle(VOICE))
		expect(result.current.voiceComing).toBe(false)
	})

	it("says once that the day's voice is used up", async () => {
		mockPlay.mockResolvedValueOnce('out_of_voice')
		const { result } = renderHook(() => useReplyVoice())
		await act(async () => result.current.play(answer('Hello!', Promise.resolve('out_of_voice'))))
		expect(mockShowToast).toHaveBeenCalledWith(OUT_OF_VOICE_LINE, 'info')
	})

	it('stops the voice when the app goes to the background, and only then', () => {
		const listeners: ((state: AppStateStatus) => void)[] = []
		const remove = jest.fn()
		jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
			listeners.push(listener)
			return { remove }
		})
		const { unmount } = renderHook(() => useReplyVoice())
		act(() => listeners.forEach((listener) => listener('inactive')))
		expect(mockStop).not.toHaveBeenCalled()
		act(() => listeners.forEach((listener) => listener('background')))
		expect(mockStop).toHaveBeenCalledWith('left')
		unmount()
		expect(remove).toHaveBeenCalled()
	})
})
