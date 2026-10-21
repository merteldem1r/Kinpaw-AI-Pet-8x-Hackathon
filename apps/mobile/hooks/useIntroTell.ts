import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, type TextInput } from 'react-native'
import {
	countWords,
	firstWords,
	INTRO_WORDS_MAX,
	type MemoryItem,
	type TalkInput
} from '@app/contract'
import { introLengthBucket, type useIntro } from '@/hooks/useIntro'
import { useVoice } from '@/hooks/useVoice'
import { track } from '@/lib/analytics'
import { haptic } from '@/lib/haptics'
import { litHints } from '@/lib/introHints'
import { type IntroNotice } from '@/lib/introPage'
import { speakReply } from '@/lib/petVoice'
import { joinWords } from '@/lib/transcript'

// "Tell me about you"'s one page (components/intro/TellPage): the words, how they came (talked
// or typed), what the pet says about them, and sending them. Each recording adds to the words;
// typing edits them freely.

/** Listening stops by itself after this, ms: 60 words is about 20–25 seconds. */
const MAX_LISTEN_MS = 30_000

/** What a send kept, for the result page. */
export type IntroResult = { facts: MemoryItem[]; line: string }

export function useIntroTell({
	name,
	intro,
	onResult,
	onLater
}: {
	name: string
	intro: ReturnType<typeof useIntro>
	onResult: (result: IntroResult) => void
	/** Go home without ending the step (the AI couldn't be reached). */
	onLater: () => void
}) {
	const [text, setText] = useState('')
	const [input, setInput] = useState<TalkInput>('voice')
	const [notice, setNotice] = useState<IntroNotice | null>(null)
	const [sending, setSending] = useState(false)
	/** The words before this recording: a new recording adds to them. */
	const before = useRef('')
	const recorded = useRef(false)
	const field = useRef<TextInput>(null)

	/** The funnel's "words ready" step, once a visit. */
	function noteRecorded(how: TalkInput, said: string) {
		if (recorded.current) return
		recorded.current = true
		track('intro_recorded', { input: how, length_bucket: introLengthBucket(said) })
	}

	const room = Math.max(1, INTRO_WORDS_MAX - countWords(text))
	const voice = useVoice(
		{
			onHeard: (heard) => {
				const all = joinWords(before.current, heard)
				setText(firstWords(all, INTRO_WORDS_MAX))
				setNotice('heard')
				noteRecorded('voice', all)
			},
			onNothingHeard: () => {
				haptic.press()
				setNotice('nothing_heard')
			},
			onCouldNotHear: () => {
				haptic.warning()
				setNotice('could_not_hear')
			}
		},
		{ maxWords: room, maxMs: MAX_LISTEN_MS, talkEvents: false }
	)
	const listening = voice.listening

	// What the card shows, and what lights the hints: the words so far and, while listening, what
	// is being heard after them.
	const shown = listening ? joinWords(before.current, voice.words) : text
	const words = countWords(shown)
	const lit = useMemo(() => litHints(shown), [shown])
	const litCount = useRef(0)
	useEffect(() => {
		if (lit.length > litCount.current) haptic.select()
		litCount.current = lit.length
	}, [lit.length])

	function type(next: string) {
		setText(firstWords(next, INTRO_WORDS_MAX))
		setInput('typed')
		setNotice(null)
	}

	function startListening() {
		field.current?.blur()
		before.current = text
		setInput('voice')
		setNotice(null)
		void voice.start()
	}

	function clear() {
		setText('')
		setNotice(null)
		haptic.press()
	}

	async function send() {
		const said = text.trim()
		if (!said || sending) return
		field.current?.blur()
		noteRecorded(input, said)
		setSending(true)
		setNotice(null)
		const outcome = await intro.send(said, input)
		setSending(false)
		if (outcome.kind === 'closed') return onLater()
		if (outcome.kind === 'failed') {
			haptic.warning()
			setNotice('later')
			return
		}
		if (outcome.facts.length === 0 && outcome.due) {
			// Kept nothing, one try left: the words stay, to add to them.
			haptic.press()
			setNotice('empty')
			return
		}
		AccessibilityInfo.announceForAccessibility(
			outcome.facts.length > 0
				? `${outcome.line} ${name} will remember ${outcome.facts.length} things.`
				: outcome.line
		)
		onResult({ facts: outcome.facts, line: outcome.line })
		// Then the pet says its answer out loud, in its voice (v2 voice), as after talking.
		if (outcome.line) void speakReply(outcome.messageId, outcome.line, input, 'intro')
	}

	return {
		field,
		text,
		shown,
		words,
		lit,
		notice,
		sending,
		listening,
		busy: listening || sending,
		mic: { available: voice.available, refused: voice.refused, listening },
		finishListening: voice.finish,
		cancelListening: voice.cancel,
		type,
		startListening,
		clear,
		send
	}
}
