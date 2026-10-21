import { useEffect, useMemo, useState } from 'react'
import { AppState } from 'react-native'
import { decayNeeds, wholeNeeds, type Needs, type Pet } from '@app/contract'
import { deviceTimeZone } from '@/lib/timeZone'

/** How often an open Home recomputes the needs it shows. */
const TICK_MS = 60_000

/**
 * The needs to show for a pet: what the server stored, decayed to now in the
 * phone's time zone, with the same function the server runs before an action.
 * Recomputed once a minute while mounted and whenever the app comes back to the
 * foreground, so a phone left open overnight wakes up to an honest pet. Whole numbers: the
 * server stores fractions, people see them rounded (needs-rhythm R11).
 */
export function usePetNeeds(pet: Pet | null | undefined): Needs | null {
	const [now, setNow] = useState(() => new Date())

	useEffect(() => {
		const tick = setInterval(() => setNow(new Date()), TICK_MS)
		const subscription = AppState.addEventListener('change', (state) => {
			if (state === 'active') setNow(new Date())
		})
		return () => {
			clearInterval(tick)
			subscription.remove()
		}
	}, [])

	return useMemo(() => {
		if (!pet) return null
		const { updated_at, ...stored } = pet.needs
		return wholeNeeds(decayNeeds(stored, new Date(updated_at), now, deviceTimeZone()))
	}, [pet, now])
}
