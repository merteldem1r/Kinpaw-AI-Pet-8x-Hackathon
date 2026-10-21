import { useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
	countWords,
	INTRO_ATTEMPTS_MAX,
	type IntroSkipStep,
	type MemoryItem,
	type TalkInput
} from '@app/contract'
import { MEMORIES_QUERY_KEY } from '@/hooks/useMemories'
import { track } from '@/lib/analytics'
import { api, errorCode } from '@/lib/api'
import { newId } from '@/lib/ids'
import { deviceTimeZone } from '@/lib/timeZone'

// "Tell me about you" (docs/application/features/v2-memory-requirements.md, R18–R24): whether the
// step is open, and sending or skipping it through POST /api/app/v1/pet/intro. No UI here: the
// screen (app/intro.tsx) decides what each outcome looks like. The words are sent once and never
// stored or sent to analytics.

/** Whether the intro is still open for this pet (`intro_due` on GET /pet). */
const INTRO_DUE_QUERY_KEY = ['pet', 'intro'] as const

/** The phone waits a little longer than the server gives the model (10s). */
const INTRO_TIMEOUT_MS = 20_000
/** What was said as analytics sees it: roughly how many words, never the words. */
const SHORT_WORDS = 15
const MEDIUM_WORDS = 40

export const introLengthBucket = (text: string) => {
	const words = countWords(text)
	return words < SHORT_WORDS ? 'short' : words < MEDIUM_WORDS ? 'medium' : 'long'
}

/**
 * Whether "Tell me about you" is still open; false until known, on any failure, and while it is
 * being asked again: right after the intro ends, the cached "yes" is stale until the server's
 * answer lands, and showing the offer from it was the button Mert saw after finishing.
 */
export function useIntroDue(enabled = true) {
	const query = useQuery({
		queryKey: INTRO_DUE_QUERY_KEY,
		queryFn: async ({ signal }) => (await api('getPet', { signal })).intro_due === true,
		enabled
	})
	return query.data === true && !query.isFetching
}

/**
 * - `saved`: the pet listened; `facts` are what it kept (maybe none), `line` its answer.
 * - `closed`: the step was already over (another phone finished it). Go home.
 * - `failed`: nothing was used up; `notConnected` when the AI or the network was the reason.
 */
export type IntroOutcome =
	| {
			kind: 'saved'
			facts: MemoryItem[]
			line: string
			attemptsLeft: number
			due: boolean
			/** The id it was answered under: what the pet's voice is asked by. */
			messageId: string
	  }
	| { kind: 'closed' }
	| { kind: 'failed'; notConnected: boolean }

type ErrorKind = 'not_connected' | 'invalid' | 'network'

function errorKindOf(error: unknown): ErrorKind | 'closed' {
	switch (errorCode(error)) {
		case 'intro_closed':
			return 'closed'
		case 'talk_unavailable':
		case 'not_configured':
			return 'not_connected'
		case 'offline':
		case 'unreachable':
		case 'timeout':
			return 'network'
		default:
			return 'invalid'
	}
}

export function useIntro() {
	const queryClient = useQueryClient()
	/** Answered calls used so far, as the server last said: the next send's `attempt`. */
	const used = useRef(0)

	const settled = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: INTRO_DUE_QUERY_KEY })
		void queryClient.invalidateQueries({ queryKey: MEMORIES_QUERY_KEY })
	}, [queryClient])

	/** Sends what they said about themselves. Never throws. */
	const send = useCallback(
		async (text: string, input: TalkInput): Promise<IntroOutcome> => {
			track('intro_sent', { input, attempt: Math.min(used.current + 1, INTRO_ATTEMPTS_MAX) })
			const messageId = newId()
			try {
				const result = await api('petIntro', {
					body: {
						message_id: messageId,
						text: text.trim(),
						input,
						time_zone: deviceTimeZone()
					},
					timeoutMs: INTRO_TIMEOUT_MS
				})
				used.current = INTRO_ATTEMPTS_MAX - result.attempts_left
				settled()
				return {
					kind: 'saved',
					facts: result.facts,
					line: result.line ?? '',
					attemptsLeft: result.attempts_left,
					due: result.intro_due,
					messageId
				}
			} catch (error) {
				const kind = errorKindOf(error)
				if (kind === 'closed') {
					settled()
					return { kind: 'closed' }
				}
				track('intro_failed', { error_kind: kind })
				return { kind: 'failed', notConnected: kind !== 'invalid' }
			}
		},
		[settled]
	)

	/**
	 * Skip: the step ends for good (R24). Best effort: if it can't reach the server, the step
	 * simply stays open and is offered again from the pet's page.
	 */
	const skip = useCallback(
		async (step: IntroSkipStep) => {
			try {
				await api('petIntro', { body: { skip: true, step } })
			} catch {
				// Offered again later; nothing to tell the person.
			}
			settled()
		},
		[settled]
	)

	return { send, skip }
}
