import { HomeRoom } from './HomeRoom'

/*
 * The app's home tab, My pet, on a Wednesday evening: Mochi missing you. Affection is the
 * lowest need and low, so the header, the bubble and the wanted tile (Pet) all come from it, as
 * the app's rules pick them (spec "Header and bubble lines").
 */
export function HomeScreen() {
	return (
		<HomeRoom
			header="Mochi missed you"
			bubble="You're back! I kept your spot warm."
			needs={{ hunger: 58, happiness: 64, energy: 72, affection: 22 }}
			wanted={{ action: 'pet', badge: 'Missed you' }}
		/>
	)
}
