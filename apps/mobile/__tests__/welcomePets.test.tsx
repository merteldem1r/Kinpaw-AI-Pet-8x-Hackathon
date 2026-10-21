/**
 * Welcome's pets (docs/application/features/v3-pet-looks-plan.md, "Phase A4c"): the three are
 * living pets, a touch on one is recorded as `welcome_pet_touched` with which pet, the kind and
 * the zone, the cat's lines keep coming, and only the cat, whose square lies over its
 * neighbours', has a touch area narrower than its square.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { WelcomePets } from '@/components/welcome/WelcomePets'
import { track } from '@/lib/analytics'

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
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn() }))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))
jest.mock('@/lib/logger', () => ({ log: { warn: jest.fn(), error: jest.fn() } }))
jest.mock('@/lib/petVoice', () => ({ voiceSampled: () => false }))

const PETS = ['Tuxedo, content', 'Ginger, happy', 'Biscuit, content'] as const

const touched = () =>
	jest
		.mocked(track)
		.mock.calls.filter(([name]) => name === 'welcome_pet_touched')
		.map(([, metadata]) => metadata)

/** What VoiceOver's action does to a pet: each is one of the touches. */
function touch(pet: (typeof PETS)[number], actionName: string) {
	fireEvent(screen.getByLabelText(pet), 'accessibilityAction', { nativeEvent: { actionName } })
}

describe('<WelcomePets>', () => {
	beforeEach(() => {
		jest.useFakeTimers()
		jest.mocked(track).mockClear()
	})
	afterEach(() => {
		// The happy face a touch gets, and the cat's next line, are on timers.
		act(() => jest.runOnlyPendingTimers())
		jest.useRealTimers()
	})

	it('shows three living pets, each with the touches as its actions', () => {
		render(<WelcomePets phase="night" />)
		for (const pet of PETS) {
			const labels = screen
				.getByLabelText(pet)
				.props.accessibilityActions.map((a: { label?: string }) => a.label)
			expect(labels).toEqual(expect.arrayContaining(['Pat head', 'Stroke', 'Hug']))
		}
	})

	it('records a touch with the pet, the kind and where it landed', () => {
		render(<WelcomePets phase="night" />)
		touch('Tuxedo, content', 'patHead')
		touch('Ginger, happy', 'scratchChin')
		touch('Biscuit, content', 'hug')
		expect(touched()).toEqual([
			{ pet: 'tuxedo', kind: 'tap', zone: 'head' },
			{ pet: 'ginger', kind: 'stroke', zone: 'chin' },
			{ pet: 'biscuit', kind: 'hug' }
		])
	})

	it('makes a side pet happy for a moment when it is patted', () => {
		render(<WelcomePets phase="night" />)
		touch('Tuxedo, content', 'patHead')
		expect(screen.getByLabelText('Tuxedo, happy')).toBeTruthy()
		act(() => jest.advanceTimersByTime(1000))
		expect(screen.getByLabelText('Tuxedo, content')).toBeTruthy()
	})

	it("says the hour's hello first, then a new line every few seconds", () => {
		render(<WelcomePets phase="night" />)
		expect(screen.queryByText('Still up? Me too.')).toBeNull()
		act(() => jest.advanceTimersByTime(900))
		expect(screen.getByText('Still up? Me too.')).toBeTruthy()
		act(() => jest.advanceTimersByTime(4000))
		expect(screen.getByText("Talk to me. I'm a good listener.")).toBeTruthy()
	})

	it("lets touches through the cat's square where the cat is not drawn", () => {
		render(<WelcomePets phase="night" />)
		expect(screen.getByLabelText('Ginger, happy').props.pointerEvents).toBe('box-none')
		expect(screen.getByLabelText('Tuxedo, content').props.pointerEvents).toBe('auto')
		expect(screen.getByLabelText('Biscuit, content').props.pointerEvents).toBe('auto')
	})
})
