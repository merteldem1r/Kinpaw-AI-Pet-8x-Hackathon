// What the mic heard in one session, from the recognizer's results (lib/speech.ts). No native
// code here, so it can be tested on its own.

/** Two pieces of what was said, one after the other. */
export const joinWords = (first: string, second: string) =>
	first && second ? `${first} ${second}` : first || second

/**
 * Everything heard in one session, from the recognizer's results. After a pause, iOS 18 ends the
 * segment (a final result) and starts the next one from empty, so what was said before the pause
 * is kept here (Mert's first intro, 2026-10-04: the words cleared after a pause). A recognizer
 * that keeps adding to the same transcript instead starts its next result with the final one,
 * and nothing is kept twice.
 */
export function createTranscript() {
	let before = ''
	let lastFinal: string | null = null
	return {
		/** One result; returns everything heard so far. */
		add(words: string, isFinal: boolean): string {
			if (lastFinal !== null) {
				if (!words.startsWith(lastFinal)) before = joinWords(before, lastFinal)
				lastFinal = null
			}
			if (isFinal) lastFinal = words
			return joinWords(before, words)
		}
	}
}
