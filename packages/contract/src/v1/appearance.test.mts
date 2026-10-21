// The appearance catalog's promises (features/m4b-pet-builder-requirements.md, R1): every
// ready-made look is a valid appearance and Plus exactly when its recipe uses a Plus option,
// the helpers never produce an appearance the schema refuses, and the server's Plus check sees
// every Plus option.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	appearanceKey,
	appearanceSchema,
	ATTRIBUTE_KEYS,
	ATTRIBUTES,
	attributesIn,
	BUILDER_TABS,
	describeAppearance,
	FUR_IDS,
	LOOKS,
	lookById,
	matchLook,
	nameIdeas,
	optionsFor,
	premiumOptionsIn,
	randomAppearance,
	SPECIES,
	usesPremium,
	withAttribute,
	withSpecies,
	type PetAppearance
} from '../../index'

const GINGER: PetAppearance = {
	species: 'cat',
	fur: 'ginger',
	pattern: 'stripes',
	eyes: 'brown',
	ears: 'pointy',
	body: 'round',
	tail: 'long',
	accent: 'auto',
	white: 'none',
	trim: 'white'
}

/** A deterministic stand-in for Math.random, walking 0, 0.1, 0.2 … */
function steps(): () => number {
	let n = 0
	return () => (n++ % 10) / 10
}

test('appearance: every ready-made look is valid, and Plus only through a Plus option', () => {
	for (const look of LOOKS) {
		assert.equal(appearanceSchema.safeParse(look.appearance).success, true, look.id)
		assert.equal(look.species, look.appearance.species, look.id)
		assert.equal(look.tier === 'premium', usesPremium(look.appearance), look.id)
		assert.equal(matchLook(look.appearance)?.id, look.id, look.id)
	}
	assert.deepEqual(
		LOOKS.filter((look) => look.tier === 'premium').map((look) => look.id),
		['calico', 'merle']
	)
	assert.equal(new Set(LOOKS.map((look) => appearanceKey(look.appearance))).size, LOOKS.length)
})

test('appearance: the schema refuses ears of the other species, unknown ids and extra fields', () => {
	assert.equal(appearanceSchema.safeParse(GINGER).success, true)
	assert.equal(appearanceSchema.safeParse({ ...GINGER, ears: 'floppy' }).success, false)
	assert.equal(appearanceSchema.safeParse({ ...GINGER, species: 'dog' }).success, false)
	assert.equal(appearanceSchema.safeParse({ ...GINGER, fur: 'purple' }).success, false)
	assert.equal(appearanceSchema.safeParse({ ...GINGER, hat: 'beret' }).success, false)
	const missing = Object.fromEntries(Object.entries(GINGER).filter(([key]) => key !== 'tail'))
	assert.equal(appearanceSchema.safeParse(missing).success, false)
})

test('appearance: the Plus options are the ones the spec names, each enough to need Plus', () => {
	const plus = SPECIES.flatMap((species) =>
		ATTRIBUTE_KEYS.flatMap((key) =>
			optionsFor(key, species)
				.filter((o) => o.premium)
				.map((o) => `${species}.${key}.${o.id}`)
		)
	)
	assert.deepEqual(
		[...new Set(plus)].sort(),
		[
			'cat.body.buff',
			'cat.ears.lynx',
			'cat.ears.tufted',
			'cat.eyes.ice',
			'cat.eyes.odd',
			'cat.pattern.brindle',
			'cat.pattern.patches',
			'cat.pattern.points',
			'cat.pattern.spots',
			'cat.pattern.tortie',
			'cat.white.van',
			'dog.body.buff',
			'dog.eyes.ice',
			'dog.eyes.odd',
			'dog.pattern.brindle',
			'dog.pattern.patches',
			'dog.pattern.points',
			'dog.pattern.spots',
			'dog.pattern.tortie',
			'dog.white.van'
		].sort()
	)
	assert.equal(usesPremium(GINGER), false)
	for (const [key, id] of [
		['pattern', 'patches'],
		['pattern', 'spots'],
		['eyes', 'odd'],
		['eyes', 'ice'],
		['ears', 'tufted'],
		['ears', 'lynx'],
		['pattern', 'tortie'],
		['pattern', 'points'],
		['pattern', 'brindle'],
		['white', 'van'],
		['body', 'buff']
	] as const) {
		const a = withAttribute(GINGER, key, id)
		assert.equal(usesPremium(a), true, id)
		assert.deepEqual(premiumOptionsIn(a), [{ key, id }])
	}
})

test('appearance: switching species keeps everything but ears it cannot have', () => {
	const dog = withSpecies(GINGER, 'dog')
	assert.deepEqual(dog, { ...GINGER, species: 'dog', ears: 'floppy' })
	assert.equal(appearanceSchema.safeParse(dog).success, true)
	assert.equal(withSpecies(GINGER, 'cat'), GINGER)
	// Round ears exist on cats only, so a dog never keeps them.
	assert.equal(withSpecies({ ...GINGER, ears: 'round' }, 'dog').ears, 'floppy')
})

test('appearance: withAttribute ignores an option the species does not have', () => {
	assert.equal(withAttribute(GINGER, 'ears', 'floppy'), GINGER)
	assert.equal(withAttribute(GINGER, 'fur', 'purple'), GINGER)
	assert.equal(withAttribute(GINGER, 'fur', 'cream').fur, 'cream')
})

test('appearance: Surprise me is always valid and free, unless Plus is asked for', () => {
	for (const species of SPECIES) {
		for (let i = 0; i < 200; i++) {
			const a = randomAppearance(species)
			assert.equal(appearanceSchema.safeParse(a).success, true)
			assert.equal(usesPremium(a), false)
		}
		const random = steps()
		for (let i = 0; i < 50; i++) {
			const a = randomAppearance(species, { includePremium: true, random })
			assert.equal(appearanceSchema.safeParse(a).success, true)
		}
	}
})

test('appearance: name ideas come from the fur, three by default, never repeated', () => {
	const ideas = nameIdeas(GINGER)
	assert.equal(ideas.length, 3)
	assert.equal(new Set(ideas).size, 3)
	assert.ok(ideas.every((name) => name.length >= 1 && name.length <= 20))
	assert.equal(nameIdeas(GINGER, 10).length, 5)
	for (const fur of FUR_IDS) {
		assert.equal(nameIdeas({ ...GINGER, fur }, 10).length, 5, fur)
	}
})

test('appearance: the description names the pet, never as content, and odd eyes in words', () => {
	assert.equal(describeAppearance(GINGER), 'A ginger striped cat with brown eyes')
	assert.equal(describeAppearance(GINGER, 'content'), 'A ginger striped cat with brown eyes')
	assert.equal(
		describeAppearance({ ...GINGER, pattern: 'solid', eyes: 'odd' }, 'sleepy'),
		'A ginger cat with one blue and one amber eye, looking sleepy'
	)
	assert.equal(
		describeAppearance({ ...GINGER, fur: 'snow', pattern: 'solid', eyes: 'ice' }),
		'A white cat with ice-blue eyes'
	)
	assert.equal(
		describeAppearance({ ...GINGER, fur: 'lilac', eyes: 'copper' }),
		'A lilac striped cat with copper eyes'
	)
	assert.equal(
		describeAppearance({ ...GINGER, pattern: 'tabby', white: 'socks', eyes: 'green' }),
		'A ginger tabby cat with white socks and green eyes'
	)
	assert.equal(
		describeAppearance({
			...GINGER,
			fur: 'cream',
			pattern: 'points',
			accent: 'chocolate',
			eyes: 'blue'
		}),
		'A cream and chocolate colourpoint cat with blue eyes'
	)
	// The paws & chest markings in their colour.
	assert.equal(
		describeAppearance({
			...GINGER,
			fur: 'charcoal',
			pattern: 'solid',
			white: 'socks',
			trim: 'golden'
		}),
		'A charcoal cat with golden socks and brown eyes'
	)
	assert.equal(
		describeAppearance({
			...GINGER,
			fur: 'chocolate',
			pattern: 'solid',
			white: 'bicolour',
			trim: 'cream'
		}),
		'A chocolate cat with a cream chest and belly and brown eyes'
	)
	// A marking colour names nothing on a solid coat.
	assert.equal(
		describeAppearance({ ...GINGER, pattern: 'solid', accent: 'charcoal' }),
		'A ginger cat with brown eyes'
	)
})

test('appearance: the builder shows every attribute once: colours under Fur, shapes under Pattern', () => {
	assert.deepEqual(ATTRIBUTES.map((d) => d.key).sort(), [...ATTRIBUTE_KEYS].sort())
	assert.deepEqual(
		BUILDER_TABS.map((d) => d.key),
		['fur', 'pattern', 'eyes', 'ears', 'body', 'tail']
	)
	assert.deepEqual(
		attributesIn('fur').map((d) => d.key),
		['fur', 'accent', 'trim']
	)
	assert.deepEqual(
		attributesIn('pattern').map((d) => d.key),
		['pattern', 'white']
	)
	// The two later coat attributes come last, so a key from before them is a prefix.
	assert.equal(appearanceKey(GINGER), 'cat.ginger.stripes.brown.pointy.round.long.auto.none.white')
})

test('appearance: a pet from before the layered coat reads as the same pet', () => {
	const { species, fur, pattern, eyes, ears, body, tail } = GINGER
	const old = { species, fur, pattern, eyes, ears, body, tail }
	assert.deepEqual(appearanceSchema.parse(old), GINGER)
	// Socks and bib was a pattern; it is a white marking, on a solid coat.
	assert.deepEqual(appearanceSchema.parse({ ...old, fur: 'charcoal', pattern: 'socks' }), {
		...GINGER,
		fur: 'charcoal',
		pattern: 'solid',
		white: 'socks'
	})
	assert.equal(
		matchLook(
			appearanceSchema.parse({
				...lookById('tuxedo').appearance,
				pattern: 'socks',
				white: undefined
			})
		)?.id,
		'tuxedo'
	)
	assert.equal(appearanceSchema.safeParse({ ...GINGER, white: 'stripes' }).success, false)
	assert.equal(appearanceSchema.safeParse({ ...GINGER, accent: 'purple' }).success, false)
})
