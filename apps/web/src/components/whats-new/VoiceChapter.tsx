import { chapterTitle } from './Contents'
import { Chapter, Facts, Opening, Para, Points, Said, Sub, type Fact } from './parts'

// docs/application/updates/v2.md, "Mochi speaks".
const COST: readonly Fact[] = [
	{ value: 'About $0.001', label: 'to make one spoken reply' },
	{ value: 'About 2 seconds', label: 'to make one' },
	{ value: 'Under $1', label: 'a month, even for a heavy Kinpaw Plus user' },
	{ value: '1.15×', label: 'playback speed, without pitch correction, so the pet sounds small' }
]

/** Mochi speaks: the pet's replies in one of eight voices. */
export function VoiceChapter() {
	return (
		<Chapter id="voice" title={chapterTitle('voice')}>
			<Opening>
				When the pet answers you, it says the reply out loud, in a voice that fits it. There are
				eight voices, chosen by cat or dog and by personality.
			</Opening>

			<Sub>How a reply gets its voice</Sub>
			<Points>
				<li>
					The server picks the voice from the pet and asks Inworld TTS-1.5 Max, on fal.ai, to speak
					the reply.
				</li>
				<li>
					Only a reply the server has just counted can be spoken, and only once. A voice that fails
					or hits a limit leaves the text as it was.
				</li>
				<li>
					Free accounts get 5 spoken replies a day and Kinpaw Plus 20. The whole app stops at 1,000
					a day, as a safety switch.
				</li>
				<li>
					It plays through the speaker. Speak to the pet and it answers aloud even with the silent
					switch on, as Siri does. Type, and it follows the switch. It is not played while VoiceOver
					is on.
				</li>
				<li>
					<Said>Mochi&rsquo;s voice</Said> in Settings is on by default. Turned off, nothing is sent
					to the speech service.
				</li>
			</Points>

			<Sub>What it costs</Sub>
			<Facts items={COST} className="mt-5" />
			<Para>
				MiniMax Speech 2.8 Turbo, which has pitch and emotion, was the first pick. It costs six
				times as much, so it stays one setting away and is not the default.
			</Para>

			<Sub>Before the first conversation</Sub>
			<Para>
				The personality step says that the personality shapes the voice, and tapping one plays it.
				The pet says its first line out loud when you meet it, and it speaks its answer in{' '}
				<Said>Tell me about you</Said>. The lines that never change are recorded once and shipped
				inside the app, so they cost nothing per play and work before you sign in.
			</Para>
		</Chapter>
	)
}
