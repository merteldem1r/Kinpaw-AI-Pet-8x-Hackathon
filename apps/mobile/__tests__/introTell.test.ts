/**
 * "Tell me about you"'s page state (useIntroTell; v2-memory-requirements.md, R18–R25): a
 * recording adds to the words, typing replaces them, and each answer to a send lands where the
 * spec says: the result, the words kept for another try, the sleepy pet, or home.
 */
import { act, renderHook } from '@testing-library/react-native'
import type { IntroOutcome } from '@/hooks/useIntro'
import { useIntroTell } from '@/hooks/useIntroTell'
import { speakReply } from '@/lib/petVoice'

type VoiceCallbacks = { onHeard: (words: string) => void; onNothingHeard: () => void }
let mockVoice: VoiceCallbacks
jest.mock('@/hooks/useVoice', () => ({
	useVoice: (callbacks: VoiceCallbacks) => {
		mockVoice = callbacks
		return {
			available: true,
			refused: false,
			listening: false,
			words: '',
			start: jest.fn(),
			finish: jest.fn(),
			cancel: jest.fn()
		}
	}
}))
jest.mock('@/hooks/useIntro', () => ({ introLengthBucket: () => 'short' }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/lib/haptics', () => ({
	haptic: { press: jest.fn(), warning: jest.fn(), select: jest.fn() }
}))
jest.mock('@/lib/petVoice', () => ({ speakReply: jest.fn() }))

const fact = { id: 'f1' } as never
const saved = (over: Partial<Extract<IntroOutcome, { kind: 'saved' }>> = {}): IntroOutcome => ({
	kind: 'saved',
	facts: [fact],
	line: 'Nice to meet you, Ada!',
	attemptsLeft: 1,
	due: false,
	messageId: 'm1',
	...over
})

function setup(outcome: IntroOutcome) {
	const intro = { send: jest.fn().mockResolvedValue(outcome), skip: jest.fn() }
	const onResult = jest.fn()
	const onLater = jest.fn()
	const view = renderHook(() =>
		useIntroTell({ name: 'Mochi', intro: intro as never, onResult, onLater })
	)
	return { ...view, intro, onResult, onLater }
}

beforeEach(() => jest.clearAllMocks())

describe('useIntroTell', () => {
	it('adds each recording to the words already there', () => {
		const { result } = setup(saved())
		act(() => mockVoice.onHeard('I am Ada'))
		act(() => result.current.startListening())
		act(() => mockVoice.onHeard('I love cats'))
		expect(result.current.text).toBe('I am Ada I love cats')
		expect(result.current.notice).toBe('heard')
	})

	it('sends what was typed, and shows the result with what was kept', async () => {
		const { result, intro, onResult } = setup(saved())
		act(() => result.current.type('I am Ada'))
		await act(() => result.current.send())
		expect(intro.send).toHaveBeenCalledWith('I am Ada', 'typed')
		expect(onResult).toHaveBeenCalledWith({ facts: [fact], line: 'Nice to meet you, Ada!' })
		expect(speakReply).toHaveBeenCalledWith('m1', 'Nice to meet you, Ada!', 'typed', 'intro')
	})

	it('keeps the words for another try when nothing was kept and a try is left', async () => {
		const { result, onResult } = setup(saved({ facts: [], due: true }))
		act(() => result.current.type('hmm'))
		await act(() => result.current.send())
		expect(onResult).not.toHaveBeenCalled()
		expect(result.current.notice).toBe('empty')
		expect(result.current.text).toBe('hmm')
	})

	it('turns sleepy when the AI cannot be reached, and goes home when the step is closed', async () => {
		const failed = setup({ kind: 'failed', notConnected: true })
		act(() => failed.result.current.type('I am Ada'))
		await act(() => failed.result.current.send())
		expect(failed.result.current.notice).toBe('later')
		expect(failed.result.current.sending).toBe(false)

		const closed = setup({ kind: 'closed' })
		act(() => closed.result.current.type('I am Ada'))
		await act(() => closed.result.current.send())
		expect(closed.onLater).toHaveBeenCalled()
	})

	it('sends nothing while the words are empty', async () => {
		const { result, intro } = setup(saved())
		act(() => result.current.type('   '))
		await act(() => result.current.send())
		expect(intro.send).not.toHaveBeenCalled()
	})
})
