/**
 * The bubble's question with two answers (the notes ask, v2-notifications R13): each answer is
 * its own button, and the bubble itself is not one.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import { PetBubble } from '@/components/pet/PetBubble'

// Reanimated 4 runs on worklets, which need native code; both ship Jest mocks.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'))
jest.mock('react-native-reanimated', () => ({
	...jest.requireActual('react-native-reanimated/mock'),
	useReducedMotion: () => false
}))
jest.mock('@react-native-async-storage/async-storage', () =>
	jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

describe('<PetBubble choice>', () => {
	it('shows the line, the question and two buttons that each answer', () => {
		const yes = jest.fn()
		const no = jest.fn()
		const action = jest.fn()
		render(
			<PetBubble
				line="Yum! Thank you."
				action={{ label: 'Try again', onPress: action }}
				choice={{
					prompt: 'Tell me when Mochi misses you?',
					yes: { label: 'Yes', onPress: yes },
					no: { label: 'Not now', onPress: no }
				}}
			/>
		)
		expect(screen.getByText('Yum! Thank you.')).toBeTruthy()
		expect(screen.getByText('Tell me when Mochi misses you?')).toBeTruthy()
		expect(screen.queryByText('Try again')).toBeNull()
		fireEvent.press(screen.getByRole('button', { name: 'Yes' }))
		fireEvent.press(screen.getByRole('button', { name: 'Not now' }))
		expect(yes).toHaveBeenCalledTimes(1)
		expect(no).toHaveBeenCalledTimes(1)
		expect(action).not.toHaveBeenCalled()
		expect(screen.getAllByRole('button')).toHaveLength(2)
	})
})
