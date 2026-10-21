/**
 * "Tell me about you" as a screen (docs/application/UI/kinpaw-screen-spec-v1.md, "Tell me about you
 * (v2)"): opened from Home's one-time offer and from the pet's page. Right after a new pet is
 * saved, Home shows the same flow itself (components/intro/IntroFlow.tsx).
 */
import { router, useLocalSearchParams } from 'expo-router'
import { IntroFlow, type IntroEntry } from '@/components/intro/IntroFlow'

const ENTRIES: readonly IntroEntry[] = ['after_signup', 'existing_pet', 'pet_details']

export default function IntroScreen() {
	const params = useLocalSearchParams<{ entry?: string }>()
	const entry = ENTRIES.find((e) => e === params.entry) ?? 'pet_details'

	function leave() {
		if (router.canGoBack()) router.back()
		else router.replace('/(tabs)')
	}

	return <IntroFlow entry={entry} onClose={leave} />
}
