/**
 * The pet drawing (docs/application/features/m4b-pet-builder-requirements.md,
 * R2–R3): every appearance has its shapes and colours, each mood changes the
 * face only, and PetArt renders every ready-made look in every mood.
 */
import { render, screen } from '@testing-library/react-native'
import {
	LOOKS,
	MOODS,
	randomAppearance,
	SPECIES,
	withAttribute,
	type PetAppearance
} from '@app/contract'
import { PetArt } from '@/components/pet/PetArt'
import { usePetPose } from '@/lib/petPose'
import Svg from 'react-native-svg'
import { HEAD_CENTRE, petParts } from '@app/brand'

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

const GINGER = LOOKS[0]!.appearance

describe('petParts', () => {
	it('gives every look and many random pets a colour for every part', () => {
		const pets: PetAppearance[] = [
			...LOOKS.map((look) => look.appearance),
			...SPECIES.flatMap((species) =>
				Array.from({ length: 50 }, () => randomAppearance(species, { includePremium: true }))
			)
		]
		for (const pet of pets) {
			const p = petParts(pet)
			for (const colour of Object.values(p.colors)) expect(colour).toMatch(/^#[0-9a-f]{6}$/i)
			for (const eye of p.eyes) expect(eye.fill).toMatch(/^#[0-9a-f]{6}$/i)
			expect(p.isCat ? p.catEars : p.dogEars).toBeTruthy()
		}
	})

	it('changes only the face between moods: the mouth, the blush, and the eyes PetArt draws', () => {
		const {
			mood: _content,
			mouth: _contentMouth,
			blush: _contentBlush,
			...content
		} = petParts(GINGER, 'content')
		for (const mood of MOODS) {
			const { mood: _mood, mouth: _mouth, blush: _blush, ...other } = petParts(GINGER, mood)
			expect(other).toEqual(content)
		}
	})

	it('draws only the pattern it is given', () => {
		expect(petParts(GINGER).markings.length).toBeGreaterThan(0)
		expect(petParts(withAttribute(GINGER, 'pattern', 'solid')).markings).toEqual([])
		expect(petParts(withAttribute(GINGER, 'pattern', 'spots')).markings.length).toBeGreaterThan(0)
	})

	it('puts the head where a head crop expects it', () => {
		expect(HEAD_CENTRE.x).toBeCloseTo(0.48)
		expect(HEAD_CENTRE.y).toBeCloseTo(0.3525)
	})
})

describe('<PetArt>', () => {
	it('renders every ready-made look in every mood', () => {
		for (const look of LOOKS) {
			for (const mood of MOODS) {
				const { unmount } = render(<PetArt appearance={look.appearance} mood={mood} size={160} />)
				unmount()
			}
		}
	})

	// A living pet (Home, Meet) draws its parts in moving groups; a still one draws plain groups.
	it('renders every look with a pose, in every mood', () => {
		function Living({
			appearance,
			mood
		}: {
			appearance: PetAppearance
			mood: (typeof MOODS)[number]
		}) {
			const pose = usePetPose()
			return <PetArt appearance={appearance} mood={mood} size={200} pose={pose} />
		}
		for (const look of LOOKS) {
			for (const mood of MOODS) {
				const { unmount } = render(<Living appearance={look.appearance} mood={mood} />)
				unmount()
			}
		}
	})

	it('is decorative without a label, and an image with one', () => {
		render(<PetArt appearance={GINGER} mood="happy" size={120} label="Mochi, happy" />)
		expect(screen.getByLabelText('Mochi, happy')).toBeTruthy()
	})

	// A mood change used to mount a second whole pet to crossfade over; on iOS that briefly
	// showed the previous look (a ghost of the old tail in the builder).
	it('changes mood by fading the face, never by drawing a second pet', () => {
		const pets = () => screen.UNSAFE_root.findAllByType(Svg).length
		const { rerender } = render(<PetArt appearance={GINGER} mood="content" size={120} />)
		expect(pets()).toBe(1)
		rerender(<PetArt appearance={GINGER} mood="happy" size={120} />)
		expect(pets()).toBe(1)
		rerender(
			<PetArt appearance={withAttribute(GINGER, 'tail', 'curly')} mood="content" size={120} />
		)
		expect(pets()).toBe(1)
	})
})
