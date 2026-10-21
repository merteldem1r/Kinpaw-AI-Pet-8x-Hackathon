import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
	analyticsIntent,
	RECENT_EXCHANGES_MAX,
	type Exchange,
	type Intent,
	type PetAction,
	type Remembered,
	type TalkInput
} from '@app/contract'
import { MEMORIES_QUERY_KEY } from '@/hooks/useMemories'
import { PET_QUERY_KEY } from '@/hooks/usePet'
import { track } from '@/lib/analytics'
import { api, errorCode } from '@/lib/api'
import { newId } from '@/lib/ids'
import { canSpeak, fetchReplyVoice, type ReadyVoice } from '@/lib/petVoice'
import { deviceTimeZone } from '@/lib/timeZone'

// Talking to the pet (docs/application/features/m6-talk-requirements.md, R18–R23): sends what
// was said to POST /api/app/v1/pet/talk and turns the answer into state and events. No UI here:
// Home decides what the pet's face, bubble and haptics do with each outcome.
//
// The short memory (the last three exchanges) lives in this hook only, so it is forgotten when
// Home unmounts: closing the app or signing out. The words are never stored or sent to analytics.

/** The phone waits a little longer than the server gives the model (10s). */
const REPLY_TIMEOUT_MS = 20_000
/**
 * With the voice on, the reply's text waits for its voice so both arrive together (v2 voice,
 * Mert 2026-10-06), but never longer than this: a slow voice then follows the text.
 */
const VOICE_HOLD_MS = 3_000
/** Message lengths as analytics sees them: never the words, only roughly how many. */
const SHORT_MAX = 20
const MEDIUM_MAX = 80

export type TalkAnswer = {
	/** The id the reply counted under, and how it was said: what the pet's voice is asked by. */
	messageId: string
	input: TalkInput
	/** The reply's voice, already fetched or on its way; null when the pet doesn't speak. */
	voice: Promise<ReadyVoice> | null
	reply: string
	intent: Intent
	suggestedAction: PetAction | null
	needChanged: boolean
	/** The fact this reply kept (v2 memory, R15), or null: Home shows "Mochi will remember that". */
	remembered: Remembered | null
	/** The fact this reply brought up from memory (R15b), or null: "From Mochi's memory". */
	recalled: Remembered | null
}

/** What the bubble says when there is no reply: not reachable, or anything else. */
export type TalkFailure = 'not_connected' | 'dozed_off'

export type TalkState =
	| { status: 'idle' }
	/** Waiting for the reply; `words` is what was said, shown back in the chip. */
	| { status: 'thinking'; words: string }
	/** The last message got no reply; `retry()` sends the same words again. */
	| { status: 'failed'; words: string; failure: TalkFailure }

type ErrorKind = 'timeout' | 'not_connected' | 'invalid_reply' | 'network'

function errorKindOf(error: unknown): ErrorKind {
	switch (errorCode(error)) {
		case 'timeout':
			return 'timeout'
		case 'talk_unavailable':
		case 'not_configured':
			return 'not_connected'
		case 'offline':
		case 'unreachable':
			return 'network'
		default:
			return 'invalid_reply'
	}
}

const lengthBucket = (text: string) =>
	text.length < SHORT_MAX ? 'short' : text.length < MEDIUM_MAX ? 'medium' : 'long'

type Message = { messageId: string; text: string; input: TalkInput }

export function useTalk(callbacks: {
	/** The pet answered; the pet in the query cache is already the server's. */
	onAnswer: (answer: TalkAnswer) => void
	/** A free account with nothing left today. */
	onTalkedOut: () => void
	onFailed: (failure: TalkFailure) => void
}) {
	const queryClient = useQueryClient()
	const [state, setState] = useState<TalkState>({ status: 'idle' })
	/** Free messages left today: unknown until the first answer, null for Plus. */
	const [messagesLeft, setMessagesLeft] = useState<number | null | undefined>(undefined)
	const recent = useRef<Exchange[]>([])
	const unanswered = useRef<Message | null>(null)
	const busy = useRef(false)
	// The latest callbacks, read when the answer arrives.
	const latest = useRef(callbacks)
	latest.current = callbacks

	const request = useCallback(
		async (message: Message) => {
			busy.current = true
			unanswered.current = message
			setState({ status: 'thinking', words: message.text })
			const started = Date.now()
			// Whether the pet will say it out loud: the server then starts the voice with the reply.
			const speaks = await canSpeak()
			try {
				const result = await api('petTalk', {
					body: {
						message_id: message.messageId,
						text: message.text,
						input: message.input,
						time_zone: deviceTimeZone(),
						recent: recent.current,
						...(speaks && { voice: true })
					},
					timeoutMs: REPLY_TIMEOUT_MS
				})
				unanswered.current = null
				queryClient.setQueryData(PET_QUERY_KEY, result.pet)
				setMessagesLeft(result.messages_left)

				if (result.outcome === 'limit_reached') {
					setState({ status: 'idle' })
					track('talk_limit_reached')
					latest.current.onTalkedOut()
					return
				}
				recent.current = [...recent.current, { said: message.text, reply: result.reply }].slice(
					-RECENT_EXCHANGES_MAX
				)
				track('talk_reply_received', {
					input: message.input,
					intent: analyticsIntent(result.intent),
					latency_ms: Date.now() - started,
					messages_left: result.messages_left
				})
				if (result.messages_left === 0) track('talk_limit_reached')
				// A kept fact makes the pet's "remembers…" list stale.
				if (result.remembered) void queryClient.invalidateQueries({ queryKey: MEMORIES_QUERY_KEY })
				// The paws stay until the voice is ready (or VOICE_HOLD_MS), then text and voice together.
				const voice = speaks ? fetchReplyVoice(message.messageId, result.reply) : null
				if (voice) {
					let hold: ReturnType<typeof setTimeout> | undefined
					await Promise.race([
						voice,
						new Promise((done) => {
							hold = setTimeout(done, VOICE_HOLD_MS)
						})
					])
					clearTimeout(hold)
				}
				setState({ status: 'idle' })
				latest.current.onAnswer({
					voice,
					messageId: message.messageId,
					input: message.input,
					reply: result.reply,
					intent: result.intent,
					suggestedAction: result.suggested_action,
					needChanged: result.need_changed,
					remembered: result.remembered ?? null,
					recalled: result.recalled ?? null
				})
			} catch (error) {
				const kind = errorKindOf(error)
				const failure: TalkFailure =
					kind === 'not_connected' || kind === 'network' ? 'not_connected' : 'dozed_off'
				setState({ status: 'failed', words: message.text, failure })
				track('talk_reply_failed', { error_kind: kind })
				latest.current.onFailed(failure)
			} finally {
				busy.current = false
			}
		},
		[queryClient]
	)

	/** Says `text` to the pet. False when there is nothing to say or a reply is on its way. */
	const send = useCallback(
		(text: string, input: TalkInput): boolean => {
			const words = text.trim()
			if (!words || busy.current) return false
			track('talk_message_sent', { input, length_bucket: lengthBucket(words) })
			void request({ messageId: newId(), text: words, input })
			return true
		},
		[request]
	)

	/** Sends the unanswered message again, with the same id, so it can never count twice. */
	const retry = useCallback(() => {
		if (!unanswered.current || busy.current) return
		track('talk_retry_tapped')
		void request(unanswered.current)
	}, [request])

	/** Moves on from a failed message (the person did something else); a reply on its way stays. */
	const forget = useCallback(() => {
		if (busy.current) return
		unanswered.current = null
		setState((current) => (current.status === 'failed' ? { status: 'idle' } : current))
	}, [])

	return { state, messagesLeft, send, retry, forget }
}
