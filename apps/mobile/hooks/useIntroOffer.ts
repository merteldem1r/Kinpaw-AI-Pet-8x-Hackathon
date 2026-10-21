import { useCallback, useEffect, useState } from 'react'
import { useIntroDue } from '@/hooks/useIntro'
import { introOffered, markIntroOffered, useIntroAfterSave } from '@/lib/introOffer'

// "Tell me about you" offered in Home's bubble (v2-memory-requirements.md, R18): for a pet from
// before the intro, once on this phone, while the step is still open on the server. A pet just
// saved gets the intro straight away from the root layout instead, so there is no offer then.

/**
 * `focused`: Home is showing; `petId`: the pet, once there is one. `offering` is true while the
 * offer is the bubble's to make; `end()` withdraws it (Home left, or the offer taken).
 */
export function useIntroOffer(focused: boolean, petId: string | undefined) {
	const introDue = useIntroDue(petId !== undefined)
	const introAfterSave = useIntroAfterSave()
	const [offering, setOffering] = useState(false)

	useEffect(() => {
		if (!focused || !introDue || offering || !petId || introAfterSave !== null) return
		let live = true
		void introOffered(petId).then((done) => {
			if (!live || done) return
			setOffering(true)
			void markIntroOffered(petId)
		})
		return () => {
			live = false
		}
	}, [focused, introDue, offering, petId, introAfterSave])

	const end = useCallback(() => setOffering(false), [])

	return { offering: offering && introDue, end }
}
