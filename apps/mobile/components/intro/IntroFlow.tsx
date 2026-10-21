/**
 * "Tell me about you", the flow — the pet asks to know its person (docs/application/UI/
 * kinpaw-screen-spec-v1.md, "Tell me about you (v2)"; features/v2-memory-requirements.md,
 * R18–R25). One page to tell it: the pet asks, they talk (each recording adds to the words) or
 * type, edit freely, and send when ready. Then the result: the pet, big, with what it will
 * remember floating around it. Opened once after the pet is saved, once from Home for a pet from
 * before, and from the pet's page while it is open. Skip is there until they send.
 *
 * This decides which page shows: TellPage (its state in useIntroTell, its words in lib/introPage)
 * or ResultPage; listening is useVoice's, the server call useIntro's. It is shown two
 * ways: as the `/intro` screen (app/intro.tsx), and, right after a new pet is saved, by Home
 * itself over everything, since a navigation during the switch from sign-in to Home was lost.
 */
import { useState } from 'react'
import type { Pet } from '@app/contract'
import { ResultPage } from '@/components/intro/ResultPage'
import { TellPage } from '@/components/intro/TellPage'
import { useIntro } from '@/hooks/useIntro'
import type { IntroResult } from '@/hooks/useIntroTell'
import { useMountEffect } from '@/hooks/useMountEffect'
import { usePet } from '@/hooks/usePet'
import { track } from '@/lib/analytics'
import { stopVoice } from '@/lib/petVoice'

export type IntroEntry = 'after_signup' | 'existing_pet' | 'pet_details'

export function IntroFlow({
	entry,
	pet: given,
	onClose
}: {
	entry: IntroEntry
	/** The pet, when it isn't in the cache yet (the intro right after saving, before Home). */
	pet?: Pet
	onClose: () => void
}) {
	const cached = usePet().data
	const pet = given ?? cached ?? undefined
	const name = pet?.name ?? 'your pet'
	const intro = useIntro()
	const [result, setResult] = useState<IntroResult | null>(null)

	useMountEffect(() => {
		track('intro_viewed', { entry })
		// Going home quiets the pet's answer if it is still talking.
		return () => stopVoice('left')
	})

	return result ? (
		<ResultPage name={name} pet={pet} result={result} onDone={onClose} />
	) : (
		<TellPage
			name={name}
			pet={pet}
			intro={intro}
			onResult={setResult}
			onSkip={(step) => {
				void intro.skip(step)
				onClose()
			}}
			onLater={onClose}
		/>
	)
}
