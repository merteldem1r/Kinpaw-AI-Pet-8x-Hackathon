/**
 * Illustration colours: the sky outside, not UI roles. They are the same in
 * every preset and scheme (the sky is the sky), so they sit beside the palette
 * rather than in it, and app code reads them from here instead of writing hex
 * (docs/application/UI/kinpaw-screen-spec-v1.md, "Home" → SkyBand).
 */
import type { EyeId, FurId } from '@app/contract'
import { shiftLightness } from './color'

export type SkyPhase = 'morning' | 'afternoon' | 'evening' | 'night'

export type SkyArt = {
	/** Gradient stops at 0, 28%, 50% and 74%; the band then ends on the screen's `bg`. */
	stops: readonly [string, string, string, string]
	/** The sun, or the night's crescent moon. */
	body: string
	/**
	 * Replaces the 74% stop when the appearance is locked to the other scheme, so a
	 * day sky still fades into a dark ground and a night sky into a light one.
	 */
	bridge: string
}

export const SKY_PHASES: readonly SkyPhase[] = ['morning', 'afternoon', 'evening', 'night']

/**
 * The pet's coat. Keyed by the fur ids in @app/contract (`FUR_IDS`); typecheck fails if one is
 * missing here, so a new fur can't ship without its colours. Everything that differs by fur
 * lives here, so the drawing never checks a fur's id.
 */
export type FurArt = {
	base: string
	/** Inner ears, dog ears, a fluffy tail's tip. */
	shade: string
	/** Stripes and spots. */
	stripe: string
	/** The belly and muzzle, where no white marking covers them. */
	belly: string
	/** Patches: white on most coats, ginger on cream (a calico). */
	patch: string
	/** Dark coats switch the face lines to a light ink, so the eyes stay visible. */
	dark: boolean
	/** Where the light falls on the head and body, and where it falls off: the base, shifted. */
	highlight: string
	lowlight: string
}

export type PetArtColors = {
	fur: Record<FurId, FurArt>
	/** Iris colours, keyed by the eye ids in @app/contract; odd eyes are blue and amber. */
	eyes: Record<Exclude<EyeId, 'odd'>, string>
	/** The cream sticker edge around every pet. */
	edge: string
	/** Socks and bib. */
	white: string
	catNose: string
	dogNose: string
	mouth: string
	/** Inside the mouth, when it opens to speak (v3-pet-looks-requirements.md, R6). */
	mouthInside: string
	tongue: string
	/** Closed eyes, brows and dot eyes. */
	ink: string
	/** The same on dark coats. */
	inkOnDark: string
	pupil: string
	glint: string
	brownIrisOnDark: string
	/** The cheeks' blush, drawn see-through over any coat. */
	blush: string
	/** The contact shadow under the feet. */
	shadow: string
	/**
	 * What floats up from the pet after a care action on Home: hearts after Pet, treats after
	 * Feed (fish or bones), stars after Play, a sleepy "z" when it is too tired to play.
	 */
	fx: { heart: string; treat: string; star: string; sleep: string }
}

const BELLY = '#f7e9d2'
const BELLY_ON_CREAM = '#fffaf2'
const WHITE = '#f6efe3'
const GINGER_PATCH = '#e3914a'

/** How far a coat's light and low tones sit from its base, in OKLCH lightness. */
const COAT_HIGHLIGHT = 0.05
const COAT_LOWLIGHT = -0.06

/** A coat: most share the belly and white patches, and are light. */
function coat(
	base: string,
	shade: string,
	stripe: string,
	rest: Partial<Pick<FurArt, 'belly' | 'patch' | 'dark'>> = {}
): FurArt {
	return {
		base,
		shade,
		stripe,
		belly: BELLY,
		patch: WHITE,
		dark: false,
		highlight: shiftLightness(base, COAT_HIGHLIGHT),
		lowlight: shiftLightness(base, COAT_LOWLIGHT),
		...rest
	}
}

export const art: {
	sky: Record<SkyPhase, SkyArt>
	/** Stars, at the opacity each phase gives them. */
	star: string
	/** Clouds: near white by day, the same colour thinned in the evening. */
	cloud: string
	/** Life in the sky: fireflies at dusk, light motes in the morning, birds by day. */
	life: { firefly: string; mote: string; bird: string }
	/** The warm lamp glow behind the pet in the evening and at night. */
	lamp: string
	/**
	 * The moon-face mark as the launch screen draws it (assets/icon/source/splash.svg): the
	 * splash ground, the face, its craters and its eyes. They must match the native splash
	 * image exactly, so the hand-over to the animated launch scene can't be seen.
	 */
	mark: { ground: string; face: string; crater: string; ink: string }
	/** Home's care tiles, one colour each, matching the need it fills (hunger, happiness, affection). */
	care: { feed: string; play: string; pet: string }
	/**
	 * One colour per personality trait, for the pet's details page: mid tones that read on
	 * both the dark and the light ground.
	 */
	traits: {
		affection: string
		playfulness: string
		energy: string
		curiosity: string
		loyalty: string
		independence: string
	}
	/**
	 * A friend code's QR (features/v2-friends-requirements.md, R6): dark squares on a light card
	 * in both schemes, since a camera may not read a code drawn light on dark.
	 */
	qr: { ink: string; paper: string }
	/**
	 * Every pet's colours (features/m4b-pet-builder-requirements.md, R2), from the designer's
	 * pet builder. 🎨 BRAND: tune freely; the shapes are in ./pet.ts, shared by the app and the site.
	 */
	pet: PetArtColors
} = {
	star: '#f4f1ea',
	cloud: '#fffaf2',
	life: { firefly: '#f9e27d', mote: '#fff4d6', bird: '#3d4a66' },
	lamp: '#ffb45e',
	mark: { ground: '#090f1e', face: '#f2b66b', crater: '#e8a24f', ink: '#131b2e' },
	care: { feed: '#f2a65a', play: '#4fbfae', pet: '#f4849a' },
	traits: {
		affection: '#f4849a',
		playfulness: '#f2a65a',
		energy: '#e9c34f',
		curiosity: '#4fbfae',
		loyalty: '#6aa7f0',
		independence: '#b28df0'
	},
	qr: { ink: '#131b2e', paper: '#f6efe3' },
	sky: {
		morning: {
			stops: ['#bcd3e8', '#f1d9bd', '#f6c9a0', '#f3e7dc'],
			body: '#f7b267',
			bridge: '#5d7fa6'
		},
		afternoon: {
			stops: ['#7fb0dc', '#9cc4e6', '#c4dcef', '#dfe9f4'],
			body: '#f8d27a',
			bridge: '#5d7fa6'
		},
		evening: {
			stops: ['#3d3a6b', '#8a5a86', '#e59a6b', '#6a4a6e'],
			body: '#f6a25e',
			bridge: '#dfe9f4'
		},
		night: {
			stops: ['#141d38', '#1b2748', '#24325a', '#1b2748'],
			body: '#f1e9d2',
			bridge: '#dfe9f4'
		}
	},
	pet: {
		fur: {
			ginger: coat('#e3914a', '#c96f3a', '#a85a24'),
			cream: coat('#efe2cc', '#d8c3a2', '#c4a77f', {
				belly: BELLY_ON_CREAM,
				patch: GINGER_PATCH
			}),
			grey: coat('#8d93a3', '#6f7586', '#5a6070'),
			charcoal: coat('#3a3640', '#55505c', '#25222a', { dark: true }),
			chocolate: coat('#7a4e32', '#5a3620', '#4a2c1a', { dark: true }),
			golden: coat('#d9a066', '#a8733f', '#9a6532'),
			// White patches would vanish on a white coat, so Snow's are ginger, as on cream.
			snow: coat('#f4efe7', '#ddd2c4', '#c7b9a6', {
				belly: BELLY_ON_CREAM,
				patch: GINGER_PATCH
			}),
			cinnamon: coat('#b5623a', '#954d2b', '#7a3b1f'),
			lilac: coat('#b4abbf', '#978da3', '#7c7289')
		},
		eyes: {
			brown: '#2a1a10',
			amber: '#e0a33a',
			green: '#6bab5e',
			blue: '#6aa7dd',
			hazel: '#a2893b',
			copper: '#c8702e',
			ice: '#b6dbea'
		},
		edge: '#fbf1e0',
		white: WHITE,
		catNose: '#c4787a',
		dogNose: '#2a1a10',
		mouth: '#7a3a22',
		mouthInside: '#4a1d14',
		tongue: '#e0807a',
		ink: '#2a1a10',
		inkOnDark: '#f3e6cf',
		pupil: '#1a1210',
		glint: '#ffffff',
		brownIrisOnDark: '#9a6a3a',
		blush: '#f2848e',
		shadow: '#02040d',
		fx: { heart: '#f4849a', treat: '#f2b66b', star: '#f8d27a', sleep: '#b9c3e6' }
	}
}
