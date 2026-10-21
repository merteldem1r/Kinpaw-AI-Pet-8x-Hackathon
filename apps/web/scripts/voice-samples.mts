// npm run voice:samples --workspace=@app/web -- [--only cat|dog]
//
// Records the pet's fixed lines in each of its eight voices, once, into the app
// (docs/application/features/v2-voice-requirements.md, "Before Home"): the personality page's
// line for each preset, Meet's first line for each preset, and Meet's line for a pet with its
// own mix of traits. They ship as files and play with no request, before there is an account.
//
// The lines are apps/mobile/assets/voice/lines.json; the files go next to it as
// {species}-{preset}-{hello|meet|custom}.m4a. Change a line, then run this again. The voice is
// the current model's (VOICE_PROVIDER), with its playback rate baked in, so the app plays the
// file as it is. Needs ffmpeg. Reads FAL_KEY from apps/web/.env.local itself. 24 paid calls,
// about $0.01 on Inworld. Never run in CI.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PRESET_IDS, SPECIES, type PresetId } from '@app/contract'
import { createFalVoice, voiceProviderName } from '../src/server/voice/provider'

type Lines = { meet: Record<PresetId, string>; custom: string; hello: Record<PresetId, string> }

const OUT = join(import.meta.dirname, '../../mobile/assets/voice')
const lines = JSON.parse(readFileSync(join(OUT, 'lines.json'), 'utf8')) as Lines

const apiKey = process.env.FAL_KEY?.trim()
if (!apiKey) {
	console.error('FAL_KEY is not set in apps/web/.env.local.')
	process.exit(1)
}
const onlyAt = process.argv.indexOf('--only')
const only = onlyAt === -1 ? undefined : process.argv[onlyAt + 1]
const provider = voiceProviderName()
const voice = createFalVoice(provider, { apiKey })
const work = mkdtempSync(join(tmpdir(), 'kinpaw-voice-'))

console.log(`Recording the pet's lines with ${voice.model} into apps/mobile/assets/voice\n`)
try {
	for (const species of SPECIES.filter((s) => !only || s === only)) {
		for (const preset of PRESET_IDS) {
			const takes = { hello: lines.hello[preset], meet: lines.meet[preset], custom: lines.custom }
			for (const [kind, text] of Object.entries(takes)) {
				const name = `${species}-${preset}-${kind}.m4a`
				const result = await voice.speak({ text, species, preset, emotion: 'happy' })
				if (!result.ok) throw new Error(`${name}: ${result.failure} (${result.detail})`)
				const raw = join(work, 'raw')
				writeFileSync(raw, Buffer.from(await (await fetch(result.audioUrl)).arrayBuffer()))
				// The rate as the app would play it (varispeed: higher and quicker), then small AAC.
				const rate = result.playbackRate
				const filters = rate === 1 ? [] : ['-af', `asetrate=24000*${rate},aresample=24000`]
				execFileSync('ffmpeg', [
					'-loglevel',
					'error',
					'-y',
					'-i',
					raw,
					...filters,
					'-ac',
					'1',
					'-c:a',
					'aac',
					'-b:a',
					'48k',
					join(OUT, name)
				])
				console.log(`  ${name}  "${text}"`)
			}
		}
	}
} finally {
	rmSync(work, { recursive: true, force: true })
}
