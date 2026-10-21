// npm run voice:site --workspace=@app/web
//
// Records the two lines Mochi says on the landing page's week (src/lib/pet-lines.ts,
// WEEK_TALK: the reply on day 3 and "I missed you" on day 7) into public/voice/site, in
// Mochi's own voice: the same provider, voice and playback rate the app's `POST /pet/voice`
// uses, so the site sounds like the app. Change a line there, then run this again.
//
// The other clips on the site (public/voice/*.m4a) are the app's own recordings, copied from
// apps/mobile/assets/voice; `npm run voice:samples` makes those.
//
// Needs ffmpeg. Reads FAL_KEY from apps/web/.env.local itself. Two paid calls, about $0.002
// on Inworld. Never run in CI.

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MOCHI_VOICE, WEEK_TALK } from '../src/lib/pet-lines'
import { createFalVoice, voiceProviderName } from '../src/server/voice/provider'

const PUBLIC = join(import.meta.dirname, '../public')
const TAKES = [
	{ file: WEEK_TALK.replyClip, text: WEEK_TALK.reply },
	{ file: WEEK_TALK.missedClip, text: WEEK_TALK.missed }
]

const apiKey = process.env.FAL_KEY?.trim()
if (!apiKey) {
	console.error('FAL_KEY is not set in apps/web/.env.local.')
	process.exit(1)
}
const voice = createFalVoice(voiceProviderName(), { apiKey })
const work = mkdtempSync(join(tmpdir(), 'kinpaw-voice-'))

console.log(`Recording the week's lines with ${voice.model} into apps/web/public/voice/site\n`)
try {
	for (const { file, text } of TAKES) {
		const result = await voice.speak({ text, ...MOCHI_VOICE, emotion: 'happy' })
		if (!result.ok) throw new Error(`${file}: ${result.failure} (${result.detail})`)
		const raw = join(work, 'raw')
		writeFileSync(raw, Buffer.from(await (await fetch(result.audioUrl)).arrayBuffer()))
		// The rate as the app would play it (varispeed: higher and quicker), then small AAC.
		const rate = result.playbackRate
		const filters = rate === 1 ? [] : ['-af', `asetrate=24000*${rate},aresample=24000`]
		const out = join(PUBLIC, file)
		mkdirSync(join(out, '..'), { recursive: true })
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
			out
		])
		console.log(`  ${file}  "${text}"`)
	}
} finally {
	rmSync(work, { recursive: true, force: true })
}
