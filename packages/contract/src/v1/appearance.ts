import { z } from 'zod'

// What a pet looks like: its species and eight attributes (docs/application/UI/
// kinpaw-screen-spec-v1.md, "Pet art contract"; features/m4b-pet-builder-requirements.md,
// v2-pet-looks-requirements.md). The coat is four of them: `fur` (the base colour), `pattern`
// (where markings go), `accent` (the markings' colour) and `white` (white markings).
// The app draws any appearance in any mood (PetArt); the server validates every saved one
// against these lists and decides whether it needs Plus. Ids are stable: they are stored, sent
// and tracked, so an option is renamed by its `label`, never its id. No colour lives here: the
// palette is @app/brand's (`art.pet`).

export const SPECIES = ['cat', 'dog'] as const
export const speciesSchema = z.enum(SPECIES)
export type Species = z.infer<typeof speciesSchema>

export const MOODS = ['happy', 'content', 'sad', 'sleepy'] as const
export const moodSchema = z.enum(MOODS)
export type Mood = z.infer<typeof moodSchema>

export const FUR_IDS = [
	'ginger',
	'cream',
	'grey',
	'charcoal',
	'chocolate',
	'golden',
	'snow',
	'cinnamon',
	'lilac'
] as const
export const PATTERN_IDS = [
	'solid',
	'stripes',
	'tabby',
	'spots',
	'patches',
	'tortie',
	'points',
	'saddle',
	'brindle'
] as const
/** `auto` is each pattern's own colour (a darker shade of the fur; patches white or ginger). */
export const ACCENT_IDS = ['auto', ...FUR_IDS] as const
/** The paws & chest markings (white markings, whatever their colour). */
export const WHITE_IDS = ['none', 'mittens', 'socks', 'bicolour', 'van'] as const
/** Their colour: white, or a fur colour (not Snow, too close to white). */
export const TRIM_IDS = [
	'white',
	'cream',
	'golden',
	'ginger',
	'cinnamon',
	'chocolate',
	'grey',
	'lilac',
	'charcoal'
] as const
export const EYE_IDS = ['brown', 'amber', 'green', 'blue', 'hazel', 'copper', 'ice', 'odd'] as const
export const CAT_EAR_IDS = ['pointy', 'round', 'tufted', 'folded', 'lynx'] as const
export const DOG_EAR_IDS = ['floppy', 'perky', 'button', 'rose', 'bat'] as const
export const BODY_IDS = ['tiny', 'slim', 'round', 'chonky', 'buff'] as const
export const TAIL_IDS = ['long', 'fluffy', 'curly', 'bob', 'plume'] as const

export type FurId = (typeof FUR_IDS)[number]
export type PatternId = (typeof PATTERN_IDS)[number]
export type EyeId = (typeof EYE_IDS)[number]
export type CatEarId = (typeof CAT_EAR_IDS)[number]
export type DogEarId = (typeof DOG_EAR_IDS)[number]
export type EarId = CatEarId | DogEarId
export type BodyId = (typeof BODY_IDS)[number]
export type TailId = (typeof TAIL_IDS)[number]
export type AccentId = (typeof ACCENT_IDS)[number]
export type WhiteId = (typeof WHITE_IDS)[number]
export type TrimId = (typeof TRIM_IDS)[number]

const EAR_IDS: Record<Species, readonly EarId[]> = { cat: CAT_EAR_IDS, dog: DOG_EAR_IDS }

/**
 * Before the layered coat (2026-10-03), Socks and bib was a pattern; it is a white marking now,
 * drawn the same. An appearance saved or drafted then still reads, as the same pet.
 */
function fromBeforeLayeredCoat(value: unknown): unknown {
	if (typeof value !== 'object' || value === null) return value
	const old = value as Record<string, unknown>
	if (old.pattern !== 'socks') return value
	return { ...old, pattern: 'solid', white: old.white ?? 'socks' }
}

/**
 * A pet's appearance, as stored and sent. Ears must be one of its species' ears; nothing else
 * depends on the species. `accent` and `white` default, so an appearance from before they
 * existed (an old draft, an old client) is still valid.
 */
export const appearanceSchema = z.preprocess(
	fromBeforeLayeredCoat,
	z
		.object({
			species: speciesSchema,
			fur: z.enum(FUR_IDS),
			pattern: z.enum(PATTERN_IDS),
			eyes: z.enum(EYE_IDS),
			ears: z.enum([...CAT_EAR_IDS, ...DOG_EAR_IDS]),
			body: z.enum(BODY_IDS),
			tail: z.enum(TAIL_IDS),
			accent: z.enum(ACCENT_IDS).default('auto'),
			white: z.enum(WHITE_IDS).default('none'),
			trim: z.enum(TRIM_IDS).default('white')
		})
		.strict()
		.refine((a) => EAR_IDS[a.species].includes(a.ears), {
			message: 'Those ears are not one of this species',
			path: ['ears']
		})
)
export type PetAppearance = z.infer<typeof appearanceSchema>

/** In `appearanceKey` order: the coat attributes added later come last, so old keys are a prefix. */
export const ATTRIBUTE_KEYS = [
	'fur',
	'pattern',
	'eyes',
	'ears',
	'body',
	'tail',
	'accent',
	'white',
	'trim'
] as const
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number]

export type AttributeOption = {
	id: string
	label: string
	/** Plus only. During onboarding a Plus option shows a note and is not selected. */
	premium: boolean
}

export type AttributeDef = {
	key: AttributeKey
	/** The builder's tab it shows under: its own, or another's (a second row in that tab). */
	tab: BuilderTab
	/** The tab's name, for an attribute with its own tab. */
	label: string
	/** The heading above the options row, where a tab has more than one. */
	title: string
	/** Colours are swatches; the rest are chips. */
	display: 'swatch' | 'chip'
}

/** In the builder's order: tab by tab, each tab's rows top to bottom. */
export const ATTRIBUTES: readonly AttributeDef[] = [
	// The Fur tab holds the colours, the Pattern tab the shapes they colour.
	{ key: 'fur', tab: 'fur', label: 'Fur', title: 'Main', display: 'swatch' },
	{ key: 'accent', tab: 'fur', label: 'Pattern colour', title: 'Pattern', display: 'swatch' },
	{
		key: 'trim',
		tab: 'fur',
		label: 'Paws & chest colour',
		title: 'Paws & chest',
		display: 'swatch'
	},
	{ key: 'pattern', tab: 'pattern', label: 'Pattern', title: 'Pattern', display: 'chip' },
	{ key: 'white', tab: 'pattern', label: 'Paws & chest', title: 'Paws & chest', display: 'chip' },
	{ key: 'eyes', tab: 'eyes', label: 'Eyes', title: 'Eye colour', display: 'swatch' },
	{ key: 'ears', tab: 'ears', label: 'Ears', title: 'Ears', display: 'chip' },
	{ key: 'body', tab: 'body', label: 'Body', title: 'Body', display: 'chip' },
	{ key: 'tail', tab: 'tail', label: 'Tail', title: 'Tail', display: 'chip' }
]

/** The builder's tabs, in order: the attributes that have their own tab. */
export const BUILDER_TAB_KEYS = ['fur', 'pattern', 'eyes', 'ears', 'body', 'tail'] as const
export type BuilderTab = (typeof BUILDER_TAB_KEYS)[number]
export const BUILDER_TABS: readonly AttributeDef[] = BUILDER_TAB_KEYS.map((key) =>
	ATTRIBUTES.find((a) => a.key === key)!
)

/** The rows one tab shows, top to bottom. */
export function attributesIn(tab: BuilderTab): readonly AttributeDef[] {
	return ATTRIBUTES.filter((a) => a.tab === tab)
}

const option = (id: string, label: string, premium = false): AttributeOption => ({
	id,
	label,
	premium
})

// Patches and Spots are Plus because the Plus looks (Calico, Blue merle) are built from them;
// otherwise anyone could build those for free. Ice eyes, Lynx ears (the step up from Tufted),
// Tortie, Points, Brindle and Van are Plus too; every marking colour is free
// (features/v2-pet-looks-requirements.md, R16 and "Decisions").
const OPTIONS: Record<Exclude<AttributeKey, 'ears'>, readonly AttributeOption[]> = {
	fur: [
		option('ginger', 'Ginger'),
		option('cream', 'Cream'),
		option('grey', 'Grey'),
		option('charcoal', 'Charcoal'),
		option('chocolate', 'Chocolate'),
		option('golden', 'Golden'),
		option('snow', 'Snow'),
		option('cinnamon', 'Cinnamon'),
		option('lilac', 'Lilac')
	],
	accent: [
		option('auto', 'Matching'),
		option('ginger', 'Ginger'),
		option('cream', 'Cream'),
		option('grey', 'Grey'),
		option('charcoal', 'Charcoal'),
		option('chocolate', 'Chocolate'),
		option('golden', 'Golden'),
		option('snow', 'Snow'),
		option('cinnamon', 'Cinnamon'),
		option('lilac', 'Lilac')
	],
	pattern: [
		option('solid', 'Solid'),
		option('stripes', 'Stripes'),
		option('tabby', 'Tabby'),
		option('saddle', 'Saddle'),
		option('patches', 'Patches', true),
		option('spots', 'Spots', true),
		option('tortie', 'Tortie', true),
		option('points', 'Points', true),
		option('brindle', 'Brindle', true)
	],
	white: [
		option('none', 'None'),
		option('mittens', 'Mittens'),
		option('socks', 'Socks and bib'),
		option('bicolour', 'Bicolour'),
		option('van', 'Van', true)
	],
	trim: [
		option('white', 'White'),
		option('cream', 'Cream'),
		option('golden', 'Golden'),
		option('ginger', 'Ginger'),
		option('cinnamon', 'Cinnamon'),
		option('chocolate', 'Chocolate'),
		option('grey', 'Grey'),
		option('lilac', 'Lilac'),
		option('charcoal', 'Charcoal')
	],
	eyes: [
		option('brown', 'Brown'),
		option('amber', 'Amber'),
		option('green', 'Green'),
		option('blue', 'Blue'),
		option('hazel', 'Hazel'),
		option('copper', 'Copper'),
		option('ice', 'Ice', true),
		option('odd', 'Odd-eyed', true)
	],
	body: [
		option('tiny', 'Tiny'),
		option('slim', 'Slim'),
		option('round', 'Round'),
		option('chonky', 'Chonky'),
		option('buff', 'Buff', true)
	],
	tail: [
		option('long', 'Long'),
		option('fluffy', 'Fluffy'),
		option('curly', 'Curly'),
		option('bob', 'Bobtail'),
		option('plume', 'Plume')
	]
}

const EAR_OPTIONS: Record<Species, readonly AttributeOption[]> = {
	cat: [
		option('pointy', 'Pointy'),
		option('round', 'Round'),
		option('folded', 'Folded'),
		option('tufted', 'Tufted', true),
		option('lynx', 'Lynx', true)
	],
	dog: [
		option('floppy', 'Floppy'),
		option('perky', 'Perky'),
		option('button', 'Button'),
		option('rose', 'Rose'),
		option('bat', 'Bat')
	]
}

/** The options for one builder tab, in display order. */
export function optionsFor(key: AttributeKey, species: Species): readonly AttributeOption[] {
	return key === 'ears' ? EAR_OPTIONS[species] : OPTIONS[key]
}

export function optionLabel(key: AttributeKey, id: string, species: Species): string {
	return optionsFor(key, species).find((o) => o.id === id)?.label ?? id
}

export function isPremiumOption(key: AttributeKey, id: string, species: Species): boolean {
	return optionsFor(key, species).some((o) => o.id === id && o.premium)
}

/** The Plus options an appearance uses; empty for a free pet. */
export function premiumOptionsIn(a: PetAppearance): { key: AttributeKey; id: string }[] {
	return ATTRIBUTE_KEYS.filter((key) => isPremiumOption(key, a[key], a.species)).map((key) => ({
		key,
		id: a[key]
	}))
}

/** Whether saving this appearance needs Plus. The server decides with it on every save. */
export function usesPremium(a: PetAppearance): boolean {
	return premiumOptionsIn(a).length > 0
}

/** The ears a species takes when the person switches to it with ears it doesn't have. */
export const DEFAULT_EARS: Record<Species, EarId> = { cat: 'pointy', dog: 'floppy' }

/** Switch species, keeping every attribute that still applies (only the ears can't). */
export function withSpecies(a: PetAppearance, species: Species): PetAppearance {
	if (a.species === species) return a
	const earsOk = EAR_IDS[species].includes(a.ears)
	return { ...a, species, ears: earsOk ? a.ears : DEFAULT_EARS[species] }
}

/** Change one attribute; an id that isn't an option for this species is ignored. */
export function withAttribute(a: PetAppearance, key: AttributeKey, id: string): PetAppearance {
	const valid = optionsFor(key, a.species).some((o) => o.id === id)
	return valid ? ({ ...a, [key]: id } as PetAppearance) : a
}

/** "Surprise me", and the builder's blank start. Free options only unless asked. */
export function randomAppearance(
	species: Species,
	{
		includePremium = false,
		random = Math.random
	}: { includePremium?: boolean; random?: () => number } = {}
): PetAppearance {
	const pick = (key: AttributeKey): string => {
		const pool = optionsFor(key, species).filter((o) => includePremium || !o.premium)
		return pool[Math.floor(random() * pool.length)]!.id
	}
	return {
		species,
		fur: pick('fur') as FurId,
		pattern: pick('pattern') as PatternId,
		eyes: pick('eyes') as EyeId,
		ears: pick('ears') as EarId,
		body: pick('body') as BodyId,
		tail: pick('tail') as TailId,
		accent: pick('accent') as AccentId,
		white: pick('white') as WhiteId,
		// White half the time, so most surprises keep the natural look.
		trim: random() < 0.5 ? 'white' : (pick('trim') as TrimId)
	}
}

/** A stable key, e.g. "cat.ginger.stripes.brown.pointy.round.long", for analytics and caching. */
export function appearanceKey(a: PetAppearance): string {
	return [a.species, ...ATTRIBUTE_KEYS.map((key) => a[key])].join('.')
}

// ── The ready-made looks ─────────────────────────────────────────────────────

export const LOOK_IDS = [
	'ginger',
	'smoke',
	'tuxedo',
	'calico',
	'biscuit',
	'pepper',
	'snow',
	'merle'
] as const
export const lookIdSchema = z.enum(LOOK_IDS)
export type LookId = z.infer<typeof lookIdSchema>

export type LookTier = 'free' | 'premium'
export type Look = {
	id: LookId
	species: Species
	name: string
	/** Plus when its recipe uses a Plus option. */
	tier: LookTier
	appearance: PetAppearance
}

/** The coat attributes a look's recipe may leave out: Matching, no paws & chest, white. */
type CoatDefaults = 'accent' | 'white' | 'trim'

/** A look from its recipe. */
const look = (
	id: LookId,
	name: string,
	recipe: Omit<PetAppearance, CoatDefaults> & Partial<Pick<PetAppearance, CoatDefaults>>
): Look => {
	const appearance: PetAppearance = { accent: 'auto', white: 'none', trim: 'white', ...recipe }
	return {
		id,
		species: appearance.species,
		name,
		tier: usesPremium(appearance) ? 'premium' : 'free',
		appearance
	}
}

/** In the order Choose a friend shows them: the free looks first, the rare coat last. */
export const LOOKS: readonly Look[] = [
	look('ginger', 'Ginger', {
		species: 'cat',
		fur: 'ginger',
		pattern: 'stripes',
		eyes: 'brown',
		ears: 'pointy',
		body: 'round',
		tail: 'long'
	}),
	look('smoke', 'Smoke', {
		species: 'cat',
		fur: 'grey',
		pattern: 'stripes',
		eyes: 'green',
		ears: 'pointy',
		body: 'slim',
		tail: 'long'
	}),
	look('tuxedo', 'Tuxedo', {
		species: 'cat',
		fur: 'charcoal',
		pattern: 'solid',
		white: 'socks',
		eyes: 'amber',
		ears: 'pointy',
		body: 'round',
		tail: 'long'
	}),
	look('calico', 'Calico', {
		species: 'cat',
		fur: 'cream',
		pattern: 'patches',
		eyes: 'brown',
		ears: 'pointy',
		body: 'round',
		tail: 'fluffy'
	}),
	look('biscuit', 'Biscuit', {
		species: 'dog',
		fur: 'golden',
		pattern: 'solid',
		eyes: 'brown',
		ears: 'floppy',
		body: 'round',
		tail: 'long'
	}),
	look('pepper', 'Pepper', {
		species: 'dog',
		fur: 'charcoal',
		pattern: 'solid',
		white: 'socks',
		eyes: 'brown',
		ears: 'perky',
		body: 'slim',
		tail: 'long'
	}),
	look('snow', 'Snow', {
		species: 'dog',
		fur: 'cream',
		pattern: 'solid',
		eyes: 'brown',
		ears: 'floppy',
		body: 'chonky',
		tail: 'fluffy'
	}),
	look('merle', 'Blue merle', {
		species: 'dog',
		fur: 'grey',
		pattern: 'spots',
		eyes: 'blue',
		ears: 'floppy',
		body: 'round',
		tail: 'long'
	})
]

/** The look each species starts on in Choose a friend. */
export const DEFAULT_LOOK: Record<Species, LookId> = { cat: 'ginger', dog: 'biscuit' }

export function lookById(id: LookId): Look {
	const found = LOOKS.find((candidate) => candidate.id === id)
	if (!found) throw new Error(`Unknown look: ${id}`)
	return found
}

export function looksFor(species: Species): Look[] {
	return LOOKS.filter((candidate) => candidate.species === species)
}

export function isPremiumLook(id: LookId): boolean {
	return lookById(id).tier === 'premium'
}

/** The ready-made look an appearance is exactly, if any; a built or customized pet has none. */
export function matchLook(a: PetAppearance): Look | undefined {
	const key = appearanceKey(a)
	return LOOKS.find((candidate) => appearanceKey(candidate.appearance) === key)
}

// ── Words about a pet ────────────────────────────────────────────────────────

const NAME_IDEAS: Record<FurId, readonly string[]> = {
	ginger: ['Mochi', 'Pumpkin', 'Marmalade', 'Clementine', 'Toffee'],
	cream: ['Biscuit', 'Latte', 'Dumpling', 'Mallow', 'Butter'],
	grey: ['Pebble', 'Smoke', 'Earl', 'Misty', 'Cloud'],
	charcoal: ['Pepper', 'Inky', 'Olive', 'Licorice', 'Midnight'],
	chocolate: ['Cocoa', 'Fudge', 'Mocha', 'Brownie', 'Acorn'],
	golden: ['Honey', 'Nugget', 'Sunny', 'Waffle', 'Maple'],
	snow: ['Snowball', 'Marshmallow', 'Pearl', 'Yuki', 'Coconut'],
	cinnamon: ['Ginger Snap', 'Paprika', 'Chestnut', 'Rusty', 'Nutmeg'],
	lilac: ['Lavender', 'Plum', 'Violet', 'Mist', 'Heather']
}

/** Name ideas for the Name step, by fur colour, never repeating within one call. */
export function nameIdeas(
	a: PetAppearance,
	count = 3,
	random: () => number = Math.random
): string[] {
	const pool = [...NAME_IDEAS[a.fur]]
	const ideas: string[] = []
	while (ideas.length < count && pool.length > 0) {
		ideas.push(pool.splice(Math.floor(random() * pool.length), 1)[0]!)
	}
	return ideas
}

const PATTERN_WORD: Record<PatternId, string> = {
	solid: '',
	stripes: 'striped ',
	tabby: 'tabby ',
	spots: 'spotted ',
	patches: 'patchy ',
	tortie: 'tortoiseshell ',
	points: 'colourpoint ',
	saddle: 'saddled ',
	brindle: 'brindle '
}

/** The paws & chest markings in words, in their colour ("golden socks"). */
const WHITE_WORDS: Record<WhiteId, ((colour: string) => string) | null> = {
	none: null,
	mittens: (colour) => `${colour} paws`,
	socks: (colour) => `${colour} socks`,
	bicolour: (colour) => `a ${colour} chest and belly`,
	van: (colour) => `a mostly ${colour} coat`
}

/** How a fur reads in a sentence, where its id doesn't. */
const FUR_WORD: Partial<Record<FurId, string>> = { snow: 'white' }
/** How eyes read in a sentence, where the id doesn't. */
const EYES_WORD: Partial<Record<EyeId, string>> = {
	odd: 'one blue and one amber eye',
	ice: 'ice-blue eyes'
}

/** The pet's accessibility label, e.g. "A ginger striped cat with brown eyes, looking happy". */
export function describeAppearance(a: PetAppearance, mood?: Mood): string {
	const eyes = EYES_WORD[a.eyes] ?? `${a.eyes} eyes`
	const word = (fur: FurId) => FUR_WORD[fur] ?? fur
	// The markings' own colour is named when it is one, e.g. "A cream and chocolate colourpoint cat".
	const marked = a.pattern !== 'solid' && a.accent !== 'auto' && a.accent !== a.fur
	const fur = marked ? `${word(a.fur)} and ${word(a.accent as FurId)}` : word(a.fur)
	const white = WHITE_WORDS[a.white]?.(a.trim)
	const features = white ? `${white} and ${eyes}` : eyes
	const base = `A ${fur} ${PATTERN_WORD[a.pattern]}${a.species} with ${features}`
	return mood && mood !== 'content' ? `${base}, looking ${mood}` : base
}
