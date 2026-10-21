import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import type { GreetingResponse } from '@app/contract'
import { api, errorCode } from '@/lib/api'
import { log } from '@/lib/logger'
import { notesState, takeOpenedNudge } from '@/lib/notifications'
import { deviceTimeZone } from '@/lib/timeZone'

/**
 * iOS reports a tapped note at about the moment the app turns active, sometimes just after. The
 * greeting waits this long first, so a tap is kept before the call that counts it (R16).
 */
const SETTLE_MS = 400

/**
 * "I missed you" (docs/application/features/v2-memory-requirements.md, R26–R28): asks the server
 * once per foreground how long the person was away and whether a remembered event is due
 * (POST /api/app/v1/pet/greeting). It asks only while Home shows (`focused`), so a return that
 * lands on another tab is greeted when Home appears. The server moves the time away and marks a
 * question asked, so the answer is used once: `clear` drops it when Home stops showing it.
 *
 * The same call counts the pet's notes (v2-notifications-requirements.md, R16–R17): the note that
 * opened the app, if one did, and whether notes can reach this person. A failed call is no
 * greeting and an open lost, never retried and never an error on screen (R18): Home says its
 * needs line as before.
 */
export function useGreeting(enabled: boolean, focused: boolean) {
	const [greeting, setGreeting] = useState<GreetingResponse | null>(null)
	// Bumped on each return from the background: a new foreground, a new greeting.
	const [foreground, setForeground] = useState(0)
	const asked = useRef(false)

	useEffect(() => {
		const subscription = AppState.addEventListener('change', (state) => {
			if (state === 'background') {
				asked.current = false
				setGreeting(null)
			} else if (state === 'active' && !asked.current) {
				setForeground((n) => n + 1)
			}
		})
		return () => subscription.remove()
	}, [])

	useEffect(() => {
		if (!enabled || !focused || asked.current) return
		asked.current = true
		let sent = false
		const timer = setTimeout(() => {
			sent = true
			void greet().then((answer) => {
				// Kept even if Home blurred meanwhile: the server has already marked the question
				// asked, so dropping a late answer would lose it. Home shows it when it appears again.
				if (answer) setGreeting(answer)
			})
		}, SETTLE_MS)
		return () => {
			clearTimeout(timer)
			// Left before it was sent: this foreground still gets its greeting.
			if (!sent) asked.current = false
		}
	}, [enabled, focused, foreground])

	const clear = useCallback(() => setGreeting(null), [])
	return { greeting, clear }
}

async function greet(): Promise<GreetingResponse | null> {
	const note = takeOpenedNudge()
	try {
		return await api('petGreeting', {
			body: {
				time_zone: deviceTimeZone(),
				notifications: await notesState(),
				...(note && { via: 'notification' as const, day: note.day, need: note.need })
			}
		})
	} catch (error) {
		log.warn('The greeting could not be fetched', { code: errorCode(error) })
		return null
	}
}
