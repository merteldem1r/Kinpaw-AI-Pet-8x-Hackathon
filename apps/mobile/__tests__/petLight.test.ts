/**
 * The light on the Skia pet (lib/petLight.ts; docs/application/features/v3-pet-looks-plan.md,
 * B2): the shader compiles, it is given exactly what it declares, no part of any pet is left
 * out of the light, and the parts shadow each other.
 *
 * @jest-environment @shopify/react-native-skia/jestEnv.js
 */
import { Skia } from '@shopify/react-native-skia'
import { LOOKS } from '@app/contract'
import { PART_KEYS, petDrawing, petParts } from '@app/brand'
import {
	castsOn,
	lightUniforms,
	ownRound,
	partRounds,
	PET_LIGHT,
	PUPPET,
	rgb,
	RIM
} from '@/lib/petLight'

const PETS = LOOKS.map((look) => petParts(look.appearance))
const GINGER = PETS[0]!

describe('the pet light', () => {
	// A shader with a mistake compiles to null: on a phone the pet is then drawn unlit.
	it('compiles the shader, and gives it the uniforms it declares', () => {
		const effect = Skia.RuntimeEffect.Make(PET_LIGHT)
		expect(effect).not.toBeNull()
		const declared = Array.from({ length: effect!.getUniformCount() }, (_, i) =>
			effect!.getUniformName(i)
		)
		const rounds = partRounds(GINGER, petDrawing(GINGER))
		const given = lightUniforms(rounds.body, GINGER.colors.fur, castsOn('body', GINGER, rounds))
		expect(declared.sort()).toEqual(Object.keys(given).sort())
	})

	it("keeps every number of the look from 0 to 1, and a grain's direction out of the shader", () => {
		for (const value of Object.values(PUPPET)) {
			expect(value).toBeGreaterThanOrEqual(0)
			expect(value).toBeLessThanOrEqual(1)
		}
		// Mert, 2026-10-12: fur drawn as streaks one way read as wood. The grain is sampled at the
		// same scale across and down.
		for (const [, x, y] of PET_LIGHT.matchAll(
			/noise\(vec2\(p\.x \* ([\d.]+), p\.y \* ([\d.]+)\)/g
		)) {
			expect(x).toBe(y)
		}
		expect(PET_LIGHT).toMatch(/noise\(p \* [\d.]+/)
	})

	// A part left flat beside lit ones looks stuck on.
	it('gives every part of every look a round with some size, about where it is', () => {
		for (const p of PETS) {
			const rounds = partRounds(p, petDrawing(p))
			for (const key of PART_KEYS) {
				const { c, r } = rounds[key]
				expect(r[0]).toBeGreaterThan(1)
				expect(r[1]).toBeGreaterThan(1)
				for (const value of [...c, ...r]) expect(Number.isFinite(value)).toBe(true)
			}
			expect(rounds.earLeft.c[0]).toBeLessThan(0)
			expect(rounds.earRight.c[0]).toBeGreaterThan(0)
			expect(rounds.head.c).toEqual([p.head.cx, p.head.cy])
		}
	})

	it("casts the head's shadow on the body under the head, and a paw's round each paw", () => {
		for (const p of PETS) {
			const [[x, y, reach, dark], left, right] = castsOn('body', p, partRounds(p, petDrawing(p)))
			expect(y).toBeGreaterThan(p.head.cy)
			expect(Math.abs(x - p.head.cx)).toBeLessThan(p.head.r)
			expect(reach).toBeGreaterThan(p.head.r)
			expect(dark).toBeGreaterThan(0)
			expect(left[0]).toBe(p.paws[0].cx)
			expect(right[0]).toBe(p.paws[1].cx)
		}
	})

	it('shadows part on part by species, and never blacks a part out', () => {
		for (const p of PETS) {
			const rounds = partRounds(p, petDrawing(p))
			const dark = (key: (typeof PART_KEYS)[number]) =>
				castsOn(key, p, rounds).map((cast) => cast[3])
			// The body on the tail; a cat's head on its ears, a dog's ears on its head.
			expect(dark('tail')[0]).toBeGreaterThan(0)
			expect(dark('earLeft')[0] > 0).toBe(p.isCat)
			expect(dark('head').filter((strength) => strength > 0)).toHaveLength(p.isCat ? 1 : 3)
			expect(dark('pawLeft')).toEqual([0, 0, 0])
			for (const key of PART_KEYS) {
				for (const strength of dark(key)) expect(strength).toBeLessThanOrEqual(0.45)
			}
		}
	})

	it('lets the muzzle and the belly stand out as rounds of their own, wider than they are', () => {
		for (const p of PETS) {
			const drawing = petDrawing(p)
			const muzzle = drawing.parts.head.over[0]!
			const belly = drawing.parts.body.over[0]!
			expect(ownRound('head', muzzle)?.c).toEqual([p.muzzle.cx, p.muzzle.cy])
			expect(ownRound('head', muzzle)?.r[0]).toBeGreaterThan(p.muzzle.rx)
			expect(ownRound('body', belly)?.r[0]).toBeGreaterThan(p.belly.rx)
			expect(ownRound('tail', belly)).toBeNull()
			// The nose and the whiskers stay on the head's round.
			expect(ownRound('head', drawing.parts.head.over.at(-2)!) === null).toBe(p.isCat)
		}
	})

	it('hands a colour to the shader as red, green and blue from 0 to 1', () => {
		for (const channel of [...RIM, ...rgb(GINGER.colors.fur)]) {
			expect(channel).toBeGreaterThanOrEqual(0)
			expect(channel).toBeLessThanOrEqual(1)
		}
	})
})
