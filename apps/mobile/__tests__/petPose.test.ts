/**
 * The pose's arithmetic (docs/application/features/v3-pet-looks-requirements.md, R1–R2): a part
 * turns about its pivot, and an ear carried by the head ends up where both turns put it.
 */
import { compose, turnAbout, type Matrix } from '@/lib/petPose'

// lib/petPose holds the pose's shared values too: Reanimated runs on worklets, which need native
// code; both ship Jest mocks.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'))
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'))

/** Where a matrix puts a point. */
const apply = ([a, b, c, d, e, f]: Matrix, x: number, y: number) => [
	a * x + c * y + e,
	b * x + d * y + f
]

describe('turnAbout', () => {
	it('is no change at rest', () => {
		const m = turnAbout(12, -40, 0)
		const [x, y] = apply(m, 30, 7)
		expect(x).toBeCloseTo(30)
		expect(y).toBeCloseTo(7)
	})

	it('keeps the pivot where it is', () => {
		const [x, y] = apply(turnAbout(26, 37, 25), 26, 37)
		expect(x).toBeCloseTo(26)
		expect(y).toBeCloseTo(37)
	})

	it('turns clockwise on screen (y points down)', () => {
		// A point right of the pivot, turned 90°, ends up below it.
		const [x, y] = apply(turnAbout(0, 0, 90), 10, 0)
		expect(x).toBeCloseTo(0)
		expect(y).toBeCloseTo(10)
	})

	it('moves by the offset after turning', () => {
		const [x, y] = apply(turnAbout(0, -12, 0, 0, 3), 0, -38)
		expect(x).toBeCloseTo(0)
		expect(y).toBeCloseTo(-35)
	})
})

describe('compose', () => {
	it('applies the inner turn first, then the outer', () => {
		const ear = turnAbout(-13.5, -54, 15)
		const head = turnAbout(0, -12, -8, 0, 2)
		const both = compose(head, ear)
		const [ex, ey] = apply(ear, -19, -77)
		const [x, y] = apply(both, -19, -77)
		const [hx, hy] = apply(head, ex, ey)
		expect(x).toBeCloseTo(hx)
		expect(y).toBeCloseTo(hy)
	})

	it('carries an ear with a head that does not move as if it were alone', () => {
		const ear = turnAbout(-13.5, -54, 15)
		expect(compose(turnAbout(0, -12, 0), ear).map((n) => Number(n.toFixed(9)))).toEqual(
			ear.map((n) => Number(n.toFixed(9)))
		)
	})
})
