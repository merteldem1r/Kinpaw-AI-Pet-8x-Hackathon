import { HomeRoom } from './HomeRoom'

/*
 * Talking to the pet on Home (spec "Talking (on Home)", M6): what you said in the chip above
 * the mic, and Mochi's answer in its bubble, in the personality you gave it. A sample exchange
 * in the voice the prompt asks for (warm, a little sassy, one or two short sentences).
 */
export function TalkingScreen() {
	return (
		<HomeRoom
			header="Mochi is happy"
			bubble="Missed you? I sat by the door for four hours. Totally normal."
			mood="happy"
			needs={{ hunger: 58, happiness: 82, energy: 72, affection: 64 }}
			words="Did you miss me today?"
		/>
	)
}
