import type { Needs, Species } from '@app/contract'
import type { TalkState } from '@/hooks/useTalk'
import { INTRO_OFFER_LINE, needsLine, TALK_LINES } from '@/lib/petLines'

// What the pet's bubble on Home shows (docs/application/UI/kinpaw-screen-spec-v1.md, "Home" and
// "Talking (on Home)"), decided in one place from the screen's state. Pure: the screen draws it.

/** A reply that kept a fact (v2-memory R15) or brought one up (R15b), while it is the line. */
export type MemoryNote = { reply: string; factId: string; kind: 'remembered' | 'recalled' }

/** The pet asking to send its notes, under the care reaction it came with (v2-notifications R13). */
export type NotesAsk = { line: string; attempt: 1 | 2 }

export type HomeBubbleState = {
	name: string
	species: Species
	needs: Needs
	talk: TalkState
	/** What the pet just said (a reaction, a reply, a tap line); null: nothing since arriving. */
	said: string | null
	/** "I missed you" (v2-memory R26–R27), until anything else is said. */
	greetingLine: string | null
	/** "Tell me about you" is being offered and the step is still open (v2-memory R18). */
	offeringIntro: boolean
	memoryNote: MemoryNote | null
	askingNotes: NotesAsk | null
	/** The reply whose voice was asked for, and where that voice is. */
	voicedLine: string | null
	speakingReply: boolean
	voiceComing: boolean
	listening: boolean
}

/** The button under the line: retry a failed message, the intro, or the fact behind a reply. */
export type HomeBubbleAction =
	{ kind: 'retry' } | { kind: 'intro' } | { kind: 'memory'; note: MemoryNote }

export type HomeBubble = {
	line: string
	/** Typing paws in place of the line while the pet thinks. */
	thinking: boolean
	action: HomeBubbleAction | null
	/** The notes ask's Yes / Not now, under the reaction it came with. */
	ask: NotesAsk | null
	voice: 'preparing' | 'speaking' | null
}

/**
 * The bubble follows the conversation. Its line, first that applies: why a message failed;
 * what the pet just said; the intro offer; "I missed you"; the line for its needs. A memory
 * note, the notes ask and the voice belong to the line they came with, and go when it changes.
 */
export function homeBubble(state: HomeBubbleState): HomeBubble {
	const { talk, said } = state
	const idle = talk.status === 'idle'
	const failedLine =
		talk.status === 'failed'
			? talk.failure === 'not_connected'
				? TALK_LINES.notConnected
				: TALK_LINES.dozedOff(state.name)
			: null

	const offer = state.offeringIntro && !failedLine && said === null && idle
	const note =
		!failedLine && idle && said !== null && said === state.memoryNote?.reply
			? state.memoryNote
			: null
	const ask =
		state.askingNotes && !failedLine && !note && idle && said === state.askingNotes.line
			? state.askingNotes
			: null

	return {
		line:
			failedLine ??
			said ??
			(offer ? INTRO_OFFER_LINE : (state.greetingLine ?? needsLine(state.needs, state.species))),
		thinking: talk.status === 'thinking',
		action: failedLine
			? { kind: 'retry' }
			: offer
				? { kind: 'intro' }
				: note
					? { kind: 'memory', note }
					: null,
		ask,
		voice:
			said === null || said !== state.voicedLine || failedLine
				? null
				: state.speakingReply
					? 'speaking'
					: state.voiceComing && idle && !state.listening
						? 'preparing'
						: null
	}
}
