import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useToast } from '@/contexts/ToastContext'
import type { TalkAnswer } from '@/hooks/useTalk'
import { OUT_OF_VOICE_LINE } from '@/lib/petLines'
import { playReplyVoice, stopVoice, useVoiceSpeaking } from '@/lib/petVoice'

// The pet saying its reply out loud on Home (v2-voice-requirements.md): which reply the voice
// belongs to, whether it is still on its way, and whether it is playing. The bubble shows
// "preparing" and "speaking" from these (lib/homeBubble.ts).

export function useReplyVoice() {
	const { showToast } = useToast()
	// The reply being said out loud: the bubble shows its voice while it is the line.
	const [voicedLine, setVoicedLine] = useState<string | null>(null)
	// That reply's voice is still on its way (fetched, not yet playing).
	const [voiceComing, setVoiceComing] = useState(false)
	const request = useRef(0)
	const speaking = useVoiceSpeaking() === 'reply'

	// The pet stops talking when the app goes away (R9).
	useEffect(() => {
		const subscription = AppState.addEventListener('change', (state) => {
			if (state === 'background') stopVoice('left')
		})
		return () => subscription.remove()
	}, [])

	/**
	 * Plays an answer's voice, ready with the text or following it when slow (R1). When the day's
	 * voice is used up, a toast says so once; the reply stays in the bubble.
	 */
	const play = useCallback(
		(answer: TalkAnswer) => {
			setVoicedLine(answer.voice ? answer.reply : null)
			const mine = ++request.current
			setVoiceComing(answer.voice !== null)
			void answer.voice
				?.then((ready) => playReplyVoice(ready, answer.input))
				.then((said) => {
					if (said === 'out_of_voice') showToast(OUT_OF_VOICE_LINE, 'info')
				})
				.finally(() => {
					// A newer reply's voice owns the flag now.
					if (request.current === mine) setVoiceComing(false)
				})
		},
		[showToast]
	)

	return { voicedLine, voiceComing, speaking, play }
}
