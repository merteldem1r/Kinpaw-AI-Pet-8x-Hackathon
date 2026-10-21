/**
 * Meet's pet (docs/application/features/v3-pet-looks-plan.md, "Phase A4b"): the pet that arrives
 * is the living one, a touch on it is recorded as `pet_meet_touched` with its kind and zone, and
 * the bubble keeps the first line whatever is touched.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import MeetScreen from '@/app/(create)/meet'
import { track } from '@/lib/analytics'
import { newPetDraft } from '@/lib/petDraft'

// Reanimated 4 runs on worklets, which need native code; both ship Jest mocks.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'))
jest.mock('react-native-reanimated', () => ({
	...jest.requireActual('react-native-reanimated/mock'),
	// Missing from the mock; lib/motion re-exports it.
	useReducedMotion: () => false
}))
jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)
jest.mock(
	'react-native-safe-area-context',
	() => jest.requireActual('react-native-safe-area-context/jest/mock').default
)
jest.mock('expo-router', () => ({
	router: { push: jest.fn() },
	useFocusEffect: jest.fn()
}))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/lib/logger', () => ({ log: { warn: jest.fn(), error: jest.fn() } }))
jest.mock('@/lib/supabase', () => ({ isSupabaseEnabled: false, supabase: null }))
jest.mock('@/hooks/usePet', () => ({ useSavePet: () => jest.fn() }))
jest.mock('@/lib/petVoice', () => ({
	canSpeak: () => Promise.resolve(false),
	playVoiceSample: jest.fn(),
	stopVoice: jest.fn(),
	useVoiceSpeaking: () => null,
	voiceSampled: () => false
}))
jest.mock('@/contexts/PetDraftContext', () => ({
	usePetDraft: () => ({ draft: mockDraft, update: jest.fn() })
}))

const mockDraft = { ...newPetDraft(), name: 'Mochi' }
const FIRST_LINE = 'Oh! Hi. I think I like you already.'

const touched = () =>
	jest
		.mocked(track)
		.mock.calls.filter(([name]) => name === 'pet_meet_touched')
		.map(([, metadata]) => metadata)

/** What VoiceOver does to the pet: each of its actions is one of the touches. */
function touch(actionName: string) {
	fireEvent(screen.getByLabelText('Mochi, happy'), 'accessibilityAction', {
		nativeEvent: { actionName }
	})
}

describe('Meet', () => {
	beforeEach(() => {
		jest.useFakeTimers()
		jest.mocked(track).mockClear()
	})
	afterEach(() => {
		// The happy face a touch gets ends on a timer.
		act(() => jest.runOnlyPendingTimers())
		jest.useRealTimers()
	})

	it('shows the living pet: a button with the touches as its actions', () => {
		render(<MeetScreen />)
		const pet = screen.getByLabelText('Mochi, happy')
		expect(pet.props.accessibilityRole).toBe('button')
		expect(pet.props.accessibilityHint).toBe('Answers your touch')
		const labels = pet.props.accessibilityActions.map((a: { label?: string }) => a.label)
		expect(labels).toEqual(expect.arrayContaining(['Pat head', 'Stroke', 'Scratch chin', 'Hug']))
	})

	it('records each touch with its kind and where it landed', () => {
		render(<MeetScreen />)
		touch('patHead')
		touch('scratchChin')
		touch('rubBelly')
		touch('hug')
		expect(touched()).toEqual([
			{ kind: 'tap', zone: 'head' },
			{ kind: 'stroke', zone: 'chin' },
			{ kind: 'stroke', zone: 'belly' },
			{ kind: 'hug' }
		])
	})

	it('keeps the first line in the bubble whatever is touched', () => {
		render(<MeetScreen />)
		expect(screen.getByText(FIRST_LINE)).toBeTruthy()
		touch('patHead')
		touch('stroke')
		touch('hug')
		expect(screen.getByText(FIRST_LINE)).toBeTruthy()
	})

	it("never sends Home's touch events", () => {
		render(<MeetScreen />)
		touch('patHead')
		touch('stroke')
		touch('hug')
		const names = jest.mocked(track).mock.calls.map(([name]) => name)
		for (const home of ['pet_tapped', 'pet_stroked', 'pet_hugged']) {
			expect(names).not.toContain(home)
		}
	})
})
