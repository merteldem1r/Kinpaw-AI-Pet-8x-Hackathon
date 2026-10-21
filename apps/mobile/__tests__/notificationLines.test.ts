/**
 * What the pet says in its notes (docs/application/features/v2-notifications-requirements.md,
 * R9–R11): a line for every need, species and day; names used only when set; never the same line
 * twice in a row; short; and no guilt.
 */
import { NEEDS, SPECIES } from '@app/contract'
import { allLines, NOTE_NAME_MAX, noteName, pickLine } from '@/lib/notificationLines'
import type { NudgeDay } from '@/lib/nudge'

const DAYS: NudgeDay[] = [1, 2, 3]
// What a note in the pet's voice never says (R9).
const GUILT = /starv|dying|\bdie|dead|forg[eo]t|abandon|\bcr(y|ied|ies)\b|lonely|hate|alone/i

describe('pickLine', () => {
	it('has a line for every need, species and day, with and without a name', () => {
		for (const need of NEEDS) {
			for (const species of SPECIES) {
				for (const day of DAYS) {
					for (const you of ['Ece', null]) {
						const line = pickLine(need, species, day, { pet: 'Mochi', you }, null)
						expect(line.title).toBe('Mochi')
						expect(line.body.length).toBeGreaterThan(0)
						expect(line.body).not.toContain('{you}')
					}
				}
			}
		}
	})

	it('uses the first word of the name', () => {
		const body = (you: string) =>
			pickLine('hunger', 'cat', 1, { pet: 'Mochi', you }, 'hunger.first.1').body
		expect(body('Ece Yılmaz')).toBe("Ece, is it snack o'clock? Asking for me.")
		expect(body('  Mert ')).toBe("Mert, is it snack o'clock? Asking for me.")
	})

	it('never picks the same line twice in a row', () => {
		for (const need of NEEDS) {
			for (const you of ['Ece', null]) {
				let last: string | null = null
				for (let i = 0; i < 7; i++) {
					const line = pickLine(need, 'dog', 2, { pet: 'Mochi', you }, last)
					expect(line.key).not.toBe(last)
					last = line.key
				}
			}
		}
	})

	it('speaks as the species where they differ', () => {
		const cat = pickLine('happiness', 'cat', 1, { pet: 'Mochi' }, 'happiness.first.0')
		const dog = pickLine('happiness', 'dog', 1, { pet: 'Mochi' }, 'happiness.first.0')
		expect(cat.body).toContain('string')
		expect(dog.body).toContain('stick')
	})
})

describe('noteName', () => {
	it('is the first word, or nothing for a missing or handle-like name', () => {
		expect(noteName('Ece Yılmaz')).toBe('Ece')
		expect(noteName('')).toBeNull()
		expect(noteName('   ')).toBeNull()
		expect(noteName(null)).toBeNull()
		expect(noteName('x'.repeat(NOTE_NAME_MAX + 1))).toBeNull()
	})
})

describe('the bank', () => {
	const lines = allLines()

	it('never guilts', () => {
		for (const { key, text } of lines)
			expect({ key, guilt: GUILT.test(text) }).toEqual({ key, guilt: false })
	})

	it('fits a lock screen, even with the longest name', () => {
		const longest = 'x'.repeat(NOTE_NAME_MAX)
		for (const { text } of lines)
			expect(text.replace('{you}', longest).length).toBeLessThanOrEqual(80)
	})

	it('has at least two lines without a name for every need and tier', () => {
		for (const need of NEEDS) {
			for (const tier of ['first', 'later']) {
				const unnamed = lines.filter(
					(line) =>
						line.species === 'cat' &&
						line.key.startsWith(`${need}.${tier}.`) &&
						!line.text.includes('{you}')
				)
				expect(unnamed.length).toBeGreaterThanOrEqual(2)
			}
		}
	})
})
