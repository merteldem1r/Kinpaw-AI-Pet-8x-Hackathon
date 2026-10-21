import { makeMutable, withSequence, withTiming } from 'react-native-reanimated'

// The pet's mouth and its sounds (docs/application/features/v3-pet-looks-requirements.md, R6):
// how open the voice and the pet's little sounds hold its mouth, 0 shut to 1 wide. lib/petVoice
// writes it from the voice's loudness while a reply plays, lib/petSounds pops it for a meow or a
// bark, and the pet on Home follows it (usePetBehaviour). A Reanimated value, so the mouth moves on
// the UI thread.

/** How open sound holds the mouth now. */
export const soundMouth = makeMutable(0)

/** Quieter than this (RMS of the frames, -1 to 1) is a pause: the mouth shuts. */
const SILENCE = 0.015
/** At this loudness and above, the mouth is open wide. Speech mostly sits well under it. */
const LOUD = 0.2

/**
 * How open the mouth is for one batch of audio frames: their loudness (root mean square), from
 * silence to loud, eased so quiet syllables still open it a little.
 */
export function opennessOf(frames: readonly number[]): number {
	if (frames.length === 0) return 0
	let sum = 0
	for (const frame of frames) sum += frame * frame
	const rms = Math.sqrt(sum / frames.length)
	const share = Math.min(1, Math.max(0, (rms - SILENCE) / (LOUD - SILENCE)))
	return Math.sqrt(share)
}

/**
 * The next mouth from the last one and a new batch's openness: it opens at once with a louder
 * sound and closes a little slower, so it doesn't flicker between batches.
 */
export function nextMouth(last: number, openness: number): number {
	return openness >= last ? openness : last * 0.6 + openness * 0.4
}

/** A little sound (a meow, a bark, a purr starting): the mouth pops open and shuts. */
export function popMouth(): void {
	soundMouth.value = withSequence(
		withTiming(0.8, { duration: 70 }),
		withTiming(0, { duration: 280 })
	)
}

/** The voice stopped: the mouth shuts. */
export function shutMouth(): void {
	soundMouth.value = withTiming(0, { duration: 120 })
}
