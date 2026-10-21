import type { Intent, PresetId, Species } from '@app/contract'

// The pet's spoken voice (docs/application/features/v2-voice-requirements.md, R2–R3): one voice
// per species and personality for each speech model, and an emotion from the reply's intent (only
// MiniMax takes one). Picked on the server from the pet, never from the phone. Compared and tuned
// by ear with `npm run voice:check --workspace=@app/web`.

export type Emotion = 'happy' | 'sad' | 'neutral'

/** A MiniMax voice: a preset voice made smaller and quicker or slower by pitch and speed. */
export type Voice = {
	/** A MiniMax preset voice id (fal's `voice_setting.voice_id`). */
	id: string
	/** Semitones, -12 to 12: a pet sounds smaller than the person who voices it. */
	pitch: number
	/** 0.5 to 2: a curious pet talks fast, a cool one takes its time. */
	speed: number
}

export const MINIMAX_VOICES: Record<Species, Record<PresetId, Voice>> = {
	cat: {
		cuddly: { id: 'Sweet_Girl_2', pitch: 2, speed: 0.95 },
		curious: { id: 'Lively_Girl', pitch: 3, speed: 1.1 },
		cool: { id: 'Calm_Woman', pitch: 1, speed: 0.95 },
		loyal: { id: 'Lovely_Girl', pitch: 2, speed: 1 }
	},
	dog: {
		cuddly: { id: 'Friendly_Person', pitch: 1, speed: 1 },
		curious: { id: 'Decent_Boy', pitch: 2, speed: 1.15 },
		cool: { id: 'Casual_Guy', pitch: 0, speed: 1 },
		loyal: { id: 'Patient_Man', pitch: 1, speed: 1 }
	}
}

/**
 * Inworld TTS-1.5 Max's voices (fal's `voice` enum): six times cheaper than MiniMax, no pitch,
 * speed or emotion, so the voice itself has to sound like the pet. Picked 2026-10-06 from its
 * lighter, more character-like English voices; for Mert to judge by ear against MiniMax.
 */
export const INWORLD_VOICES: Record<Species, Record<PresetId, string>> = {
	cat: {
		cuddly: 'Pippa (en)',
		curious: 'Pixie (en)',
		cool: 'Luna (en)',
		loyal: 'Hana (en)'
	},
	dog: {
		cuddly: 'Timothy (en)',
		curious: 'Snik (en)',
		cool: 'Blake (en)',
		loyal: 'Theodore (en)'
	}
}

/**
 * Inworld has no pitch, so the phone plays its voices this much faster without pitch correction:
 * about 2.4 semitones higher and 15% quicker, so the pet sounds small. Mert picked 1.15 by ear on
 * 2026-10-06 from 1.10, 1.15 and 1.20.
 */
export const INWORLD_PLAYBACK_RATE = 1.15

/** Warm words are answered happily; hurt ones sadly; the rest plainly (R3). */
const EMOTIONS: Record<Intent, Emotion> = {
	affectionate: 'happy',
	kind: 'happy',
	playful: 'happy',
	apology: 'happy',
	neutral: 'neutral',
	harsh: 'sad',
	upset: 'sad'
}

export const emotionFor = (intent: Intent): Emotion => EMOTIONS[intent]
