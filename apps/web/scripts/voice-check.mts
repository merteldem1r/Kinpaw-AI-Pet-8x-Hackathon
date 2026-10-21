// npm run voice:check --workspace=@app/web -- [--provider minimax|inworld] [--only cat|dog]
//                                             [--line "words"]
//
// Hear the pet's voices and compare the speech models before choosing (docs/application/features/
// v2-voice-plan.md, Phase 0). For each species and preset, the same line goes through MiniMax
// Speech 2.8 Turbo and Inworld TTS-1.5 Max on fal (or only the one named), then it prints each
// voice, how long it took, what it cost and the audio's URL to open and listen to. Tune the voices
// in src/server/voice/voices.ts by ear; pick the model with VOICE_PROVIDER.
//
// It reads FAL_KEY from apps/web/.env.local itself (node --env-file-if-exists): nobody needs to
// open that file. Nothing is stored or counted. A full run is 16 paid calls, about $0.05. Never
// run in CI.

import { PRESET_IDS, SPECIES } from '@app/contract'
import {
	createFalVoice,
	VOICE_PROVIDERS,
	type VoiceProviderName
} from '../src/server/voice/provider'
import { INWORLD_PLAYBACK_RATE } from '../src/server/voice/voices'

const DEFAULT_LINE = "You're back! I kept your spot warm. Did you bring me a snack?"
/** fal's list prices, per 1,000 characters, checked 2026-10-06. */
const PRICE_PER_1K: Record<VoiceProviderName, number> = { minimax: 0.06, inworld: 0.01 }

function argument(name: string): string | undefined {
	const at = process.argv.indexOf(name)
	return at === -1 ? undefined : process.argv[at + 1]
}

const apiKey = process.env.FAL_KEY?.trim()
if (!apiKey) {
	console.error('FAL_KEY is not set in apps/web/.env.local.')
	process.exit(1)
}
const only = argument('--only')
const asked = argument('--provider')
const providers = VOICE_PROVIDERS.filter((name) => !asked || name === asked)
const line = argument('--line') ?? DEFAULT_LINE
const voices = providers.map((name) => ({ name, voice: createFalVoice(name, { apiKey }) }))

console.log(`Speaking "${line}" (${line.length} characters)`)
for (const { name } of voices) {
	const cost = ((line.length / 1000) * PRICE_PER_1K[name]).toFixed(4)
	console.log(`  ${name}: about $${cost} a line like this`)
}
if (providers.includes('inworld')) {
	console.log(
		`  inworld's links are as recorded: the app plays them ${INWORLD_PLAYBACK_RATE}× faster, higher.`
	)
}
console.log('')

for (const species of SPECIES.filter((s) => !only || s === only)) {
	for (const preset of PRESET_IDS) {
		console.log(`── ${species} ${preset}`)
		for (const { name, voice } of voices) {
			const result = await voice.speak({ text: line, species, preset, emotion: 'happy' })
			const label = `   ${name.padEnd(8)} ${voice.voiceFor(species, preset)}`
			if (!result.ok) {
				console.log(`${label}\n            failed: ${result.failure} (${result.detail})`)
				continue
			}
			console.log(`${label}, ${result.latencyMs} ms\n            ${result.audioUrl}`)
		}
		console.log('')
	}
}
