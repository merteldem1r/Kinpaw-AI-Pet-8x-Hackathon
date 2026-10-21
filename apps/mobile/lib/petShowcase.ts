import type { PetAppearance, Species } from '@app/contract'

// The pets on Create · Start's "Make your own" card (components/onboarding/BuiltStage.tsx):
// examples of what someone can build, so they must be buildable by anyone.

/**
 * Four pets someone could build, free options only, per species: the card's showcase. Some wear
 * the layered coat: a ginger tabby in socks, a beagle's saddle, a black-and-tan in golden socks.
 */
export const SHOWCASE: Record<Species, readonly PetAppearance[]> = {
	cat: [
		{
			species: 'cat',
			fur: 'grey',
			pattern: 'stripes',
			eyes: 'amber',
			ears: 'pointy',
			body: 'round',
			tail: 'fluffy',
			accent: 'auto',
			white: 'none',
			trim: 'white'
		},
		{
			species: 'cat',
			fur: 'cream',
			pattern: 'solid',
			eyes: 'green',
			ears: 'round',
			body: 'chonky',
			tail: 'curly',
			accent: 'auto',
			white: 'none',
			trim: 'white'
		},
		{
			species: 'cat',
			fur: 'chocolate',
			pattern: 'solid',
			eyes: 'blue',
			ears: 'pointy',
			body: 'slim',
			tail: 'long',
			accent: 'auto',
			white: 'socks',
			trim: 'white'
		},
		{
			species: 'cat',
			fur: 'ginger',
			pattern: 'tabby',
			eyes: 'brown',
			ears: 'round',
			body: 'round',
			tail: 'fluffy',
			accent: 'auto',
			white: 'socks',
			trim: 'white'
		}
	],
	dog: [
		{
			species: 'dog',
			fur: 'chocolate',
			pattern: 'solid',
			eyes: 'amber',
			ears: 'floppy',
			body: 'round',
			tail: 'curly',
			accent: 'auto',
			white: 'socks',
			trim: 'white'
		},
		{
			species: 'dog',
			fur: 'charcoal',
			pattern: 'solid',
			eyes: 'amber',
			ears: 'perky',
			body: 'slim',
			tail: 'long',
			accent: 'auto',
			white: 'socks',
			trim: 'golden'
		},
		{
			species: 'dog',
			fur: 'golden',
			pattern: 'saddle',
			eyes: 'green',
			ears: 'button',
			body: 'chonky',
			tail: 'fluffy',
			accent: 'charcoal',
			white: 'socks',
			trim: 'white'
		},
		{
			species: 'dog',
			fur: 'cream',
			pattern: 'solid',
			eyes: 'brown',
			ears: 'floppy',
			body: 'round',
			tail: 'curly',
			accent: 'auto',
			white: 'none',
			trim: 'white'
		}
	]
}
