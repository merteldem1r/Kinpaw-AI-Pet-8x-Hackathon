// The model's answer, checked (v2-pet-from-photo-requirements.md, R8–R10): only the catalog's
// ids pass, unseen parts get plain defaults that are always drawable, and the prompt names every
// option the catalog has.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ATTRIBUTE_KEYS, optionsFor, SPECIES, usesPremium } from '@app/contract'
import { parsePhotoAnswer, UNSEEN } from './answer-schema'
import { photoPrompt } from './catalog-prompt'

const tuxedo = {
	verdict: 'ok',
	seen: 'A black cat with a white chest and paws, green eyes.',
	species: 'cat',
	fur: 'charcoal',
	pattern: 'solid',
	accent: 'auto',
	white: 'socks',
	trim: 'white',
	eyes: 'green',
	ears: 'pointy',
	body: 'round',
	tail: 'long'
}
const text = (answer: object) => JSON.stringify(answer)

test('a full answer becomes the pet it describes', () => {
	const parsed = parsePhotoAnswer(text(tuxedo))
	assert.deepEqual(parsed, {
		verdict: 'ok',
		appearance: {
			species: 'cat',
			fur: 'charcoal',
			pattern: 'solid',
			accent: 'auto',
			white: 'socks',
			trim: 'white',
			eyes: 'green',
			ears: 'pointy',
			body: 'round',
			tail: 'long'
		}
	})
})

test('a ```json fence around the answer is read through', () => {
	const fenced = '```json\n' + text(tuxedo) + '\n```'
	assert.equal(parsePhotoAnswer(fenced)?.verdict, 'ok')
})

test('an invented id, a missing key or no JSON at all is refused whole', () => {
	assert.equal(parsePhotoAnswer(text({ ...tuxedo, fur: 'tabby-orange' })), null)
	assert.equal(parsePhotoAnswer(text({ ...tuxedo, pattern: 'merle' })), null)
	const missing: Partial<typeof tuxedo> = { ...tuxedo }
	delete missing.tail
	assert.equal(parsePhotoAnswer(text(missing)), null)
	assert.equal(parsePhotoAnswer('I see a cat.'), null)
	assert.equal(parsePhotoAnswer('{"verdict": "ok", '), null)
})

test('what the model found instead of one pet is kept, whatever else it said', () => {
	for (const verdict of ['no_pet', 'several', 'unclear'] as const) {
		const nulls = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, null]))
		assert.deepEqual(parsePhotoAnswer(text({ verdict, seen: '', species: null, ...nulls })), {
			verdict
		})
	}
})

test('a pet whose species or main colour was not seen is unclear: nothing to draw', () => {
	assert.deepEqual(parsePhotoAnswer(text({ ...tuxedo, species: null })), { verdict: 'unclear' })
	assert.deepEqual(parsePhotoAnswer(text({ ...tuxedo, fur: UNSEEN })), { verdict: 'unclear' })
})

test('every unseen part gets a default that is drawable and free, for both species', () => {
	for (const species of SPECIES) {
		const unseen = Object.fromEntries(
			ATTRIBUTE_KEYS.filter((key) => key !== 'fur').map((key) => [key, UNSEEN])
		)
		const parsed = parsePhotoAnswer(text({ ...tuxedo, species, ...unseen }))
		assert.equal(parsed?.verdict, 'ok')
		if (parsed?.verdict !== 'ok') continue
		assert.equal(parsed.appearance.species, species)
		assert.equal(usesPremium(parsed.appearance), false)
	}
})

test("ears of the other species become the species' own default", () => {
	const parsed = parsePhotoAnswer(text({ ...tuxedo, species: 'dog', ears: 'pointy' }))
	assert.equal(parsed?.verdict === 'ok' && parsed.appearance.ears, 'floppy')
})

test('a solid coat has no marking colour', () => {
	const parsed = parsePhotoAnswer(text({ ...tuxedo, accent: 'ginger' }))
	assert.equal(parsed?.verdict === 'ok' && parsed.appearance.accent, 'auto')
	const striped = parsePhotoAnswer(text({ ...tuxedo, pattern: 'stripes', accent: 'ginger' }))
	assert.equal(striped?.verdict === 'ok' && striped.appearance.accent, 'ginger')
})

test('the prompt names every option in the catalog, for both species', () => {
	const { system } = photoPrompt()
	for (const species of SPECIES) {
		for (const key of ATTRIBUTE_KEYS) {
			for (const option of optionsFor(key, species)) {
				assert.match(system, new RegExp(`\\b${option.id}\\b`), `${key}.${option.id}`)
			}
		}
	}
})
