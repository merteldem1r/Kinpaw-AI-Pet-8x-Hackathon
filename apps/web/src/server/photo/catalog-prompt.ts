import {
	ACCENT_IDS,
	BODY_IDS,
	CAT_EAR_IDS,
	DOG_EAR_IDS,
	EYE_IDS,
	FUR_IDS,
	PATTERN_IDS,
	TAIL_IDS,
	TRIM_IDS,
	WHITE_IDS,
	type BodyId,
	type CatEarId,
	type DogEarId,
	type EyeId,
	type FurId,
	type PatternId,
	type TailId,
	type WhiteId
} from '@app/contract'
import { PHOTO_ANSWER_ATTRIBUTES, UNSEEN } from './answer-schema'

// What the model is told (v2-pet-from-photo-requirements.md, R8): every attribute as a closed list
// of our ids, each with what it looks like on a real animal, and real breeds mapped onto them. A
// label like "Van" means nothing to a model; "mostly white, colour only on the head and tail"
// does. Each table is keyed by the catalog's own ids, so a new option without its description
// fails typecheck.
//
// The model describes first and picks after (`seen`, then the ids): picking from what it already
// put into words is more accurate than picking straight from the pixels.

const FUR: Record<FurId, string> = {
	ginger: 'bright orange or marmalade (an orange cat)',
	cream: 'pale beige, buff or light fawn',
	grey: 'mid grey, blue-grey or silver',
	charcoal: 'black or very dark grey',
	chocolate: 'dark brown, liver or seal brown',
	golden: 'yellow-gold or apricot, like a golden retriever or a yellow labrador',
	snow: 'pure white',
	cinnamon:
		'warm red-brown, lighter and redder than chocolate (a red poodle or doodle, an Irish setter, a red dog)',
	lilac: 'pale dove grey with a pinkish-lavender tint'
}

const PATTERN: Record<PatternId, string> = {
	solid: 'one colour all over (white areas are described separately, under white)',
	stripes: 'even, narrow stripes along the body (mackerel tabby, tiger stripes)',
	tabby: 'swirls or blotches and an "M" on the forehead (classic tabby)',
	spots: 'distinct round spots (Dalmatian, Bengal, spotted tabby)',
	patches: 'large separate patches of a second colour (calico, patched dogs like a Jack Russell)',
	tortie: 'two colours mottled and mixed together with no clear patches (tortoiseshell)',
	points:
		'a pale body with darker face, ears, paws and tail (Siamese, Ragdoll, Himalayan colourpoint)',
	saddle: 'a darker area across the back like a blanket (beagle, German shepherd)',
	brindle: 'dark streaks over a lighter base, tiger-like, on dogs (boxer, greyhound, mastiff)'
}

const WHITE: Record<WhiteId, string> = {
	none: 'no white areas (or none of another light colour)',
	mittens: 'only the paws are white',
	socks: 'white paws and a white chest or bib',
	bicolour:
		'about half white: chest, belly, legs and muzzle (tuxedo cat, border collie, husky face)',
	van: 'mostly white, with colour only on the head and tail (Turkish Van)'
}

const EYES: Record<EyeId, string> = {
	brown: 'brown or dark brown (most dogs)',
	amber: 'yellow-orange or gold',
	green: 'green',
	blue: 'blue',
	hazel: 'green and brown mixed',
	copper: 'deep orange or copper',
	ice: 'very pale, icy blue (husky)',
	odd: 'one eye a different colour from the other'
}

const CAT_EARS: Record<CatEarId, string> = {
	pointy: 'upright, triangular (most cats)',
	round: 'small, low, with rounded tips (British shorthair, Persian)',
	folded: 'folded forward and down (Scottish fold)',
	tufted: 'large with small fur tufts at the tips (Maine Coon)',
	lynx: 'tall with long dark tufts at the tips'
}

const DOG_EARS: Record<DogEarId, string> = {
	floppy: 'long and hanging down (beagle, retriever, spaniel)',
	perky: 'upright and pointed (German shepherd, husky, corgi)',
	button: 'the flap folded forward over the ear (Jack Russell, many terriers)',
	rose: 'small, folded back against the head (greyhound, pug)',
	bat: 'large, upright and rounded (French bulldog, chihuahua)'
}

const BODY: Record<BodyId, string> = {
	tiny: 'a kitten or a puppy (big head, short legs, young), or a toy breed, however fluffy',
	slim: 'lean and long-legged (Siamese, whippet, greyhound)',
	round: 'average and a little plump (most pets)',
	chonky: 'big and heavy, very fluffy or fat',
	buff: 'muscular with a broad chest (pit bull, boxer)'
}

const TAIL: Record<TailId, string> = {
	long: 'a normal long, short-haired tail',
	fluffy: 'thick and bushy',
	curly: 'curled up over the back (shiba, pug, husky)',
	bob: 'very short or no tail (Manx, corgi, bobtail)',
	plume: 'long and feathery, the fur hanging from it (golden retriever, setter, long-haired cats)'
}

/** Real coats in our ids: the examples that teach the mapping. */
const BREEDS: readonly string[] = [
	'Tuxedo cat: fur charcoal, pattern solid, white bicolour, trim white.',
	'Calico: fur snow or cream, pattern patches, accent ginger (the patches; some are also charcoal), white bicolour.',
	'Siamese: fur cream, pattern points, accent chocolate (or charcoal), eyes blue, body slim.',
	'Orange tabby: fur ginger, pattern tabby (or stripes when the stripes are even), accent auto.',
	'Grey tabby with white paws: fur grey, pattern stripes, white socks.',
	'Tortoiseshell: fur charcoal, pattern tortie, accent ginger.',
	'Husky: fur grey (or charcoal), pattern solid, white bicolour, eyes ice (or blue, or odd), ears perky, tail curly.',
	'Beagle: fur golden (or cinnamon), pattern saddle, accent charcoal, white socks, ears floppy.',
	'Doberman or rottweiler: fur charcoal, pattern solid, white socks, trim cinnamon or golden (the tan markings are the paws and chest, in their colour).',
	'Golden retriever: fur golden, pattern solid, ears floppy, tail plume.',
	'Dalmatian: fur snow, pattern spots, accent charcoal.',
	'German shepherd: fur golden or cinnamon, pattern saddle, accent charcoal, ears perky.',
	'Black labrador: fur charcoal, pattern solid, white none, ears floppy, tail long.'
]

const list = <T extends string>(ids: readonly T[], words: Record<T, string>) =>
	ids.map((id) => `  - ${id}: ${words[id]}`).join('\n')

/** The furs, as the base colour and as the colour of markings (accent) or white areas (trim). */
const FUR_LIST = list(FUR_IDS, FUR)

const SYSTEM = `You look at one photo of a pet and describe its look using a fixed catalog, so a cartoon of the same pet can be drawn.

First decide the verdict:
- "ok": one cat or one dog is clearly visible.
- "no_pet": no cat or dog (another animal, a toy, a drawing, a person, an object).
- "several": more than one cat or dog, and none is clearly the subject.
- "unclear": a cat or dog, but too blurry, dark, far or covered to see its coat.

When the verdict is ok, write "seen": one or two short sentences on its species, coat colours, markings, white areas, eyes, ears, body and tail. Then pick, for each attribute, the one option id closest to what you described. Pick "${UNSEEN}" only when that part is not visible in the photo (eyes closed, tail out of frame). Never invent an id that is not listed.

species: cat or dog.

fur, the main coat colour:
${FUR_LIST}

pattern, where the second colour goes:
${list(PATTERN_IDS, PATTERN)}

accent, the colour of the pattern's markings: "auto" when they are just a darker shade of the main fur (most tabbies and brindles), or one of the fur ids above when they are clearly another colour. With pattern solid, use "auto".
  Ids: ${ACCENT_IDS.join(', ')}

white, white (or light) areas on the paws, chest and belly:
${list(WHITE_IDS, WHITE)}

trim, the colour of those areas: "white" almost always; a fur id when they are clearly another colour, like the tan paws and chest of a Doberman.
  Ids: ${TRIM_IDS.join(', ')}

eyes:
${list(EYE_IDS, EYES)}

ears, for a cat:
${list(CAT_EAR_IDS, CAT_EARS)}
ears, for a dog:
${list(DOG_EAR_IDS, DOG_EARS)}

body:
${list(BODY_IDS, BODY)}

tail:
${list(TAIL_IDS, TAIL)}

Examples of real coats in these ids:
${BREEDS.map((breed) => `- ${breed}`).join('\n')}

Answer with one JSON object and nothing else, with exactly these keys: "verdict", "seen", "species", ${PHOTO_ANSWER_ATTRIBUTES.map((key) => `"${key}"`).join(', ')}. When the verdict is not "ok", set "seen" to "" and every other key except "verdict" to null.`

const USER = 'Describe the pet in this photo with the catalog.'

/** The system and user text the reader sends with the photo. */
export function photoPrompt(): { system: string; user: string } {
	return { system: SYSTEM, user: USER }
}
