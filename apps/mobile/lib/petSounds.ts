/**
 * The pet's little sound with each reply (docs/application/features/m6-talk-requirements.md,
 * R28): a meow or a purr for a cat, a bark for a dog, quietly, never over the silent switch, and
 * mixed with whatever else is playing rather than stopping it. A sound that can't play is
 * skipped: it never holds up or fails a reply.
 *
 * expo-audio is loaded only once its native module is known to be in this build (one made before
 * it was added has none), so the import can't crash the app.
 */
import { requireOptionalNativeModule } from 'expo'
import type { AudioPlayer } from 'expo-audio'
import type { Intent, Species } from '@app/contract'
import { log } from '@/lib/logger'
import { popMouth } from '@/lib/petMouth'

const SOUNDS = {
	'cat-meow': require('../assets/sounds/cat-meow.m4a'),
	'cat-purr': require('../assets/sounds/cat-purr.m4a'),
	'dog-bark': require('../assets/sounds/dog-bark.m4a')
} as const
export type PetSound = keyof typeof SOUNDS

/** Quiet: a sound in the room, not an alert. */
const VOLUME = 0.6
/**
 * How the pet's sounds play: "ambient" on iOS, so the silent switch silences them and other audio
 * keeps playing. Set again before every sound, because listening to the mic takes the audio
 * session over (recording mode), and a sound played in it is routed for voice, not for the room.
 */
const PLAYBACK_MODE = { playsInSilentMode: false, interruptionMode: 'mixWithOthers' } as const

/** Warm words get a purr; anything else a meow. A dog barks (one sound for now). */
const PURRS: ReadonlySet<Intent> = new Set(['affectionate', 'kind', 'apology', 'upset'])

export function soundFor(species: Species, intent: Intent): PetSound {
	if (species === 'dog') return 'dog-bark'
	return PURRS.has(intent) ? 'cat-purr' : 'cat-meow'
}

type Audio = typeof import('expo-audio')
let audio: Promise<Audio | null> | null = null
const players = new Map<PetSound, AudioPlayer>()

/** expo-audio, once its native module is known to be in this build. Null without it. */
function loadAudio(): Promise<Audio | null> {
	audio ??= (async () => {
		if (!requireOptionalNativeModule('ExpoAudio')) return null
		return import('expo-audio')
	})().catch((err) => {
		log.warn('pet sounds unavailable', { err })
		return null
	})
	return audio
}

/** A meow or a bark opens the mouth; a cat purrs with it shut. */
const OPENS_MOUTH: ReadonlySet<PetSound> = new Set(['cat-meow', 'dog-bark'])

/** Plays the sound from the start, and opens the pet's mouth for a meow or a bark. Never throws. */
export async function playPetSound(sound: PetSound): Promise<void> {
	try {
		const loaded = await loadAudio()
		if (!loaded) return
		await loaded.setAudioModeAsync(PLAYBACK_MODE)
		let player = players.get(sound)
		if (!player) {
			player = loaded.createAudioPlayer(SOUNDS[sound])
			player.volume = VOLUME
			players.set(sound, player)
		}
		await player.seekTo(0)
		player.play()
		if (OPENS_MOUTH.has(sound)) popMouth()
	} catch (err) {
		log.warn('pet sound did not play', { sound, err })
	}
}
