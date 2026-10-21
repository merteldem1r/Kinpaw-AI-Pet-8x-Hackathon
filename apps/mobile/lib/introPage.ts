import type { IntroSkipStep } from '@app/contract'

// What "Tell me about you" says, and when (docs/application/UI/kinpaw-screen-spec-v1.md, "Tell
// me about you (v2)"; features/v2-memory-requirements.md, R18–R25). Pure: the page
// (components/intro/TellPage) draws it, useIntroTell holds the state it is decided from.

// The copy (approved by Mert, 2026-10-04; HEARD_LINE and the one-page lines added 2026-10-04).
export const ASK_LINE = 'I want to know you! Tell me a little about yourself.'
export const CONSENT =
	'Your words go to our AI to find what to remember. Audio stays on your phone.'
export const PLACEHOLDER = 'Hold the mic and talk, or tap here to type.'

/** What the pet says besides asking: after a recording, or after a send that didn't land. */
export type IntroNotice = 'heard' | 'nothing_heard' | 'could_not_hear' | 'empty' | 'later'

const NOTICE_LINE: Record<IntroNotice, string> = {
	heard: 'Ooh, tell me more! Or send it when you are ready.',
	nothing_heard: "Hm? I didn't catch that. Try again?",
	could_not_hear: "I couldn't hear you just now. You can type instead.",
	empty: 'Tell me more about you sometime! Your name, what you do, who you love?',
	later: "I'm a bit sleepy… try again in a moment, or let's do it later?"
}

/** The pet's line in its bubble: the notice, or the ask. */
export function introLine(notice: IntroNotice | null): string {
	return notice ? NOTICE_LINE[notice] : ASK_LINE
}

/** Where Skip leaves the step, for its event: after an empty result, with words, or before any. */
export function introSkipStep(notice: IntroNotice | null, hasText: boolean): IntroSkipStep {
	if (notice === 'empty') return 'empty_result'
	return hasText ? 'review' : 'record'
}

export type MicState = { available: boolean; refused: boolean; listening: boolean }

/** The line under the mic: how to use it now, or why there is none. */
export function introStatus(mic: MicState, hasText: boolean, name: string): string {
	if (!mic.available) {
		return mic.refused
			? 'The microphone is off for Kinpaw. You can type, or turn it on in Settings.'
			: `Type a few sentences for ${name}.`
	}
	if (mic.listening) return 'Tap or let go to stop'
	return hasText ? 'Talk again to add more' : 'Hold or tap to talk'
}

/** The small heading over the title. */
export function introEyebrow(sending: boolean, listening: boolean): string {
	if (sending) return 'Getting to know you'
	return listening ? 'Listening…' : 'One last thing'
}
