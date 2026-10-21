import { useCallback, useEffect, useRef, useState } from 'react'
import { countWords, firstWords, TALK_WORDS_MAX } from '@app/contract'
import { track } from '@/lib/analytics'
import {
	askToListen,
	canListen,
	listenPermission,
	startListening,
	type ListenPermission,
	type ListenSession
} from '@/lib/speech'

// Listening to the person (docs/application/features/m6-talk-requirements.md, R24–R27): the
// permission asked on the first press, never before; what is heard so far; a 15-second cap and a
// 20-word cap (TALK_WORDS_MAX, whichever comes first; "Tell me about you" listens longer, to 60
// words, through `options`); and
// what happens when it stops: the words go to `onHeard`, or nothing was heard. No UI here: the
// mic's gestures are components/pet/MicButton.tsx, the rest is Home's.
//
// The words exist only while listening and in the message they become; nothing is stored.

/** Listening stops by itself after this and sends what it heard. */
const MAX_LISTEN_MS = 15_000
/** If the recognizer never says it ended after a stop, use what it heard by then. */
const END_GRACE_MS = 2_500

export type CancelReason = 'slid_away'

export type VoiceOptions = {
	/** Listening stops by itself at this many words. TALK_WORDS_MAX by default. */
	maxWords?: number
	/** And after this long, ms. MAX_LISTEN_MS by default. */
	maxMs?: number
	/** Records talk_started and talk_cancelled (Home's talking). Off for the intro, whose own events cover it. */
	talkEvents?: boolean
}

export function useVoice(
	callbacks: {
		/** It heard something and listening stopped: say it to the pet. */
		onHeard: (words: string) => void
		/** Listening stopped with nothing heard. */
		onNothingHeard: () => void
		/** The recognizer itself failed (no microphone, no service): it couldn't listen at all. */
		onCouldNotHear: () => void
	},
	{ maxWords = TALK_WORDS_MAX, maxMs = MAX_LISTEN_MS, talkEvents = true }: VoiceOptions = {}
) {
	/** This build can listen, and the person hasn't refused. */
	const [available, setAvailable] = useState(false)
	/** The person refused the microphone or speech recognition: typing is the way to talk. */
	const [refused, setRefused] = useState(false)
	const [listening, setListening] = useState(false)
	const [words, setWords] = useState('')
	const heard = useRef('')
	const session = useRef<ListenSession | null>(null)
	const sending = useRef(false)
	/** The recognizer failed during this session (not a refusal, not silence). */
	const failed = useRef(false)
	const timers = useRef<ReturnType<typeof setTimeout>[]>([])
	const latest = useRef(callbacks)
	latest.current = callbacks

	const apply = useCallback((permission: ListenPermission) => {
		setRefused(permission === 'refused')
		setAvailable(permission !== 'refused' && canListen())
	}, [])

	useEffect(() => {
		void listenPermission().then(apply)
	}, [apply])

	const clearTimers = () => timers.current.splice(0).forEach(clearTimeout)

	/** Listening is over: deliver what was heard (if it was a send), then reset. Once per session. */
	const ended = useCallback(() => {
		if (!session.current) return
		clearTimers()
		session.current.release()
		session.current = null
		setListening(false)
		const said = heard.current
		heard.current = ''
		setWords('')
		if (failed.current) {
			failed.current = false
			sending.current = false
			if (talkEvents) track('talk_cancelled', { reason: 'speech_failed' })
			latest.current.onCouldNotHear()
			return
		}
		if (!sending.current) return
		sending.current = false
		if (said) {
			latest.current.onHeard(said)
		} else {
			if (talkEvents) track('talk_cancelled', { reason: 'nothing_heard' })
			latest.current.onNothingHeard()
		}
	}, [talkEvents])

	const finish = useCallback(() => {
		const current = session.current
		if (!current || sending.current) return
		sending.current = true
		current.stop()
		timers.current.push(setTimeout(ended, END_GRACE_MS))
	}, [ended])

	/** Starts listening; the first time, asks for permission instead (press again to talk). */
	const start = useCallback(async () => {
		if (session.current) return
		let permission = await listenPermission()
		if (permission === 'ask') {
			permission = await askToListen()
			track('mic_permission_answered', { granted: permission === 'granted' })
			apply(permission)
			return
		}
		if (permission !== 'granted') {
			apply(permission)
			return
		}

		heard.current = ''
		sending.current = false
		failed.current = false
		const started = startListening({
			onHeard: (soFar) => {
				// A message holds `maxWords` at most: at the last one, it stops and sends.
				const kept = firstWords(soFar, maxWords)
				heard.current = kept
				setWords(kept)
				if (countWords(kept) >= maxWords) finish()
			},
			onEnd: ended,
			onError: (code) => {
				if (code === 'not-allowed') apply('refused')
				// Silence and our own cancel are expected; anything else means it couldn't listen.
				else if (code !== 'no-speech' && code !== 'aborted') failed.current = true
			}
		})
		if (!started) {
			setAvailable(false)
			return
		}
		session.current = started
		setListening(true)
		if (talkEvents) track('talk_started', { input: 'voice' })
		timers.current.push(setTimeout(finish, maxMs))
	}, [apply, ended, finish, maxMs, maxWords, talkEvents])

	/** Stops listening and throws the words away. */
	const cancel = useCallback(
		(reason: CancelReason) => {
			const current = session.current
			if (!current) return
			sending.current = false
			if (talkEvents) track('talk_cancelled', { reason })
			current.cancel()
			ended()
		},
		[ended, talkEvents]
	)

	// Leaving the screen mid-sentence stops the microphone.
	useEffect(
		() => () => {
			clearTimers()
			session.current?.cancel()
			session.current = null
		},
		[]
	)

	return { available, refused, listening, words, start, finish, cancel }
}
