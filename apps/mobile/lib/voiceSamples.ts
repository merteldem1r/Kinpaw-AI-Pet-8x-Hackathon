/**
 * The pet's recorded lines (v2 voice, "Before Home"): each line of assets/voice/lines.json in each
 * of the eight voices, made by `npm run voice:samples --workspace=@app/web` with the voice model's
 * playback rate already in the file. Static requires, so Metro bundles them; a test checks every
 * file is here. Change a line in lines.json, then run the script again.
 */
import type { PresetId, Species } from '@app/contract'

export type SampleLine = 'hello' | 'meet' | 'custom'

type Clips = Record<Species, Record<PresetId, Record<SampleLine, number>>>

const CLIPS: Clips = {
	cat: {
		cuddly: {
			hello: require('../assets/voice/cat-cuddly-hello.m4a'),
			meet: require('../assets/voice/cat-cuddly-meet.m4a'),
			custom: require('../assets/voice/cat-cuddly-custom.m4a')
		},
		curious: {
			hello: require('../assets/voice/cat-curious-hello.m4a'),
			meet: require('../assets/voice/cat-curious-meet.m4a'),
			custom: require('../assets/voice/cat-curious-custom.m4a')
		},
		cool: {
			hello: require('../assets/voice/cat-cool-hello.m4a'),
			meet: require('../assets/voice/cat-cool-meet.m4a'),
			custom: require('../assets/voice/cat-cool-custom.m4a')
		},
		loyal: {
			hello: require('../assets/voice/cat-loyal-hello.m4a'),
			meet: require('../assets/voice/cat-loyal-meet.m4a'),
			custom: require('../assets/voice/cat-loyal-custom.m4a')
		}
	},
	dog: {
		cuddly: {
			hello: require('../assets/voice/dog-cuddly-hello.m4a'),
			meet: require('../assets/voice/dog-cuddly-meet.m4a'),
			custom: require('../assets/voice/dog-cuddly-custom.m4a')
		},
		curious: {
			hello: require('../assets/voice/dog-curious-hello.m4a'),
			meet: require('../assets/voice/dog-curious-meet.m4a'),
			custom: require('../assets/voice/dog-curious-custom.m4a')
		},
		cool: {
			hello: require('../assets/voice/dog-cool-hello.m4a'),
			meet: require('../assets/voice/dog-cool-meet.m4a'),
			custom: require('../assets/voice/dog-cool-custom.m4a')
		},
		loyal: {
			hello: require('../assets/voice/dog-loyal-hello.m4a'),
			meet: require('../assets/voice/dog-loyal-meet.m4a'),
			custom: require('../assets/voice/dog-loyal-custom.m4a')
		}
	}
}

/** The recorded line for this species and preset. */
export const voiceSample = (species: Species, preset: PresetId, line: SampleLine): number =>
	CLIPS[species][preset][line]
