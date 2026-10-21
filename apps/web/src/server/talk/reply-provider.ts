import type { Exchange, Intent, MemoryKind, Needs, NewMemory, Pet, PetAction } from '@app/contract'

// The pet's voice behind one interface (docs/application/features/m6-talk-requirements.md, R1):
// the talk route asks a provider for a reply and never knows which model answered. Groq is the
// one in use (./groq.ts); the stub (./stub.ts) answers in tests, in CI and in development without
// a key. A paid model later is one more file that implements this.

/** Everything the prompt needs about the pet. Its needs are already decayed to now. */
export type TalkPet = Pick<Pet, 'name' | 'appearance' | 'preset' | 'traits'> & { needs: Needs }

export type ReplyRequest = {
	pet: TalkPet
	/** What was just said, trimmed. */
	said: string
	/** Up to RECENT_EXCHANGES_MAX earlier exchanges, oldest first. */
	recent: readonly Exchange[]
	/** The name the person set on their profile, as typed; none: the pet doesn't use one. */
	personName?: string | null
	/**
	 * Long-term memory (docs/application/features/v2-memory-requirements.md). Absent: memory is
	 * off, and the prompt and answer shape are M6's, unchanged.
	 */
	memory?: PromptMemoryContext
}

/** One fact the prompt shows, by its short ref (R10). The ref maps to a row id on the server. */
export type PromptMemory = {
	ref: string
	text: string
	kind: MemoryKind
	/** The question to ask about a due event, when one was written. */
	followUp: string | null
	/** YYYY-MM-DD, events only: shown relative to today, so "tomorrow" never goes stale. */
	followUpOn: string | null
	/** An event whose follow-up date has come and that hasn't been asked about yet. */
	due: boolean
	/** What was just said sounds worried and this event is coming up: most likely why. */
	worry?: boolean
}

export type PromptMemoryContext = {
	/** YYYY-MM-DD in the person's time zone (R11). */
	today: string
	/** "Saturday", in the person's time zone. */
	weekday: string
	/** At most MEMORY_IN_PROMPT, picked by the server (R9). */
	facts: readonly PromptMemory[]
}

/** What the reply asks the server to remember (R12), already checked (R13). */
export type MemoryOp =
	{ action: 'add'; fact: NewMemory } | { action: 'replace'; ref: string; fact: NewMemory }

/** The pet's answer, checked (./reply-schema.ts). */
export type PetReply = {
	reply: string
	intent: Intent
	/** The care action the pet hints at ("are you hungry?" → feed), or null. */
	suggestedAction: PetAction | null
	/** A fact to keep, or null: memory off, nothing worth keeping, or a proposal the checks refused. */
	memory: MemoryOp | null
	/**
	 * The ref of the note this reply brought up (R15b), as the model says: one the prompt showed,
	 * or null. The talk flow checks the reply really mentions it before telling the person.
	 */
	recalled?: string | null
}

export type ReplyUsage = { inputTokens: number | null; outputTokens: number | null }

/**
 * - `unavailable`: the model couldn't be reached, was rate-limited, timed out, or refused the key.
 *   The pet is "not connected".
 * - `invalid`: it answered, but not in the shape R5 accepts.
 */
export type ReplyFailure = 'unavailable' | 'invalid'

/** Why it failed, for logs and the check script: `timeout`, `network`, `http_429`, `schema`… Never content. */
export type FailureDetail = string

export type ReplyResult =
	| { ok: true; reply: PetReply; usage: ReplyUsage; latencyMs: number }
	| {
			ok: false
			failure: ReplyFailure
			detail: FailureDetail
			usage: ReplyUsage
			latencyMs: number
	  }

/**
 * "Tell me about you" (v2-memory-requirements.md, R21): what the person said about themselves the
 * first time, for one call that returns the pet's first reaction and the facts to keep.
 */
export type IntroRequest = {
	pet: TalkPet
	/** What they said, trimmed: at most INTRO_WORDS_MAX words. */
	said: string
	personName?: string | null
	/** YYYY-MM-DD in the person's time zone, and its weekday, for events' dates (R11). */
	today: string
	weekday: string
}

/** The intro's answer, checked: the pet's line, and the facts `checkFact` let through (at most 8). */
export type IntroAnswer = { line: string; facts: NewMemory[] }

export type IntroResult =
	| { ok: true; answer: IntroAnswer; usage: ReplyUsage; latencyMs: number }
	| {
			ok: false
			failure: ReplyFailure
			detail: FailureDetail
			usage: ReplyUsage
			latencyMs: number
	  }

export interface ReplyProvider {
	/** Recorded in ai_usage, with the model. */
	readonly name: 'groq' | 'stub'
	readonly model: string
	/** Never throws: every failure is a result. */
	reply(request: ReplyRequest): Promise<ReplyResult>
	/** "Tell me about you". Never throws: every failure is a result. */
	intro(request: IntroRequest): Promise<IntroResult>
}

export const NO_USAGE: ReplyUsage = { inputTokens: null, outputTokens: null }
