/**
 * Create your pet — before the pet is saved: Start, then a photo (read into a pet) or Build
 * (Make your own), Name, Personality, then Meet (docs/application/UI/kinpaw-screen-spec-v1.md). The root layout
 * shows this group only while signed out; the draft (contexts/PetDraftContext)
 * carries the choices between steps and across launches.
 */
import { Stack } from 'expo-router'
import { useColors } from '@/contexts/ThemeContext'

export default function CreateLayout() {
	const c = useColors()
	return (
		<Stack
			screenOptions={{
				headerShown: false,
				// Each step has its own Back; a swipe would skip the draft's step bookkeeping.
				gestureEnabled: false,
				animation: 'fade',
				contentStyle: { backgroundColor: c.bg }
			}}
		>
			<Stack.Screen name="start" />
			<Stack.Screen name="photo" />
			<Stack.Screen name="build" />
			<Stack.Screen name="name" />
			<Stack.Screen name="personality" />
			<Stack.Screen name="meet" />
		</Stack>
	)
}
