import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo } from 'react-native'
import { track } from '@/lib/analytics'
import { haptic } from '@/lib/haptics'
import type { NotesAsk } from '@/lib/homeBubble'
import { markAsked, mayAsk, requestNotes } from '@/lib/notifications'
import { NOTES_LINES, notesAsk } from '@/lib/petLines'

// The pet asking to send its daily notes (v2-notifications-requirements.md, R13–R14): never at
// launch, only under the reaction to a care the server confirmed, once, or once more later. The
// ask belongs to that reaction: when the bubble moves on, it goes, and doesn't come back with it.

type Options = {
	/** The pet's name; undefined while there is no pet. */
	name: string | undefined
	/** What the bubble says now, and how to change it (Home's line). */
	said: string | null
	setSaid: (line: string) => void
}

export function useNotesAsk({ name, said, setSaid }: Options) {
	const [asking, setAsking] = useState<NotesAsk | null>(null)
	// The last care reaction, and what the bubble says now, for a confirmation that lands later.
	const careLine = useRef<string | null>(null)
	const saidNow = useRef(said)
	saidNow.current = said
	// Asked (or not allowed to ask) this visit: no more checks until the app starts again.
	const settled = useRef(false)
	const checking = useRef(false)

	/** A care's reaction is now the line: the ask, if it comes, goes under this one. */
	const cared = useCallback((line: string) => {
		careLine.current = line
	}, [])

	/** The server confirmed a care: ask, if the pet may and its reaction is still the line. */
	const confirmed = useCallback(async () => {
		const line = careLine.current
		if (!name || !line || settled.current || checking.current) return
		checking.current = true
		try {
			if (!(await mayAsk())) {
				settled.current = true
				return
			}
			// Moved on since (another tap, a reply): the next confirmed care asks instead.
			if (saidNow.current !== line) return
			const attempt = await markAsked()
			settled.current = true
			track('notification_prompt_shown', { attempt })
			setAsking({ line, attempt })
			AccessibilityInfo.announceForAccessibility(notesAsk(name))
		} finally {
			checking.current = false
		}
	}, [name])

	// Moving on (another tap, a reply) drops the ask: reaction lines repeat, and an ask shown
	// once must not come back with its line.
	useEffect(() => {
		if (asking && said !== asking.line) setAsking(null)
	}, [said, asking])

	/** Yes asks iOS for permission; Not now leaves it for later. The pet answers either way. */
	const answer = useCallback(
		async (yes: boolean) => {
			const ask = asking
			if (!ask) return
			setAsking(null)
			track('notification_prompt_answered', {
				answer: yes ? 'yes' : 'not_now',
				attempt: ask.attempt
			})
			if (!yes) {
				setSaid(NOTES_LINES.notNow)
				return
			}
			const allowed = await requestNotes('bubble')
			if (allowed) haptic.success()
			setSaid(allowed ? NOTES_LINES.allowed : NOTES_LINES.refused)
		},
		[asking, setSaid]
	)

	return { asking, cared, confirmed, answer }
}
