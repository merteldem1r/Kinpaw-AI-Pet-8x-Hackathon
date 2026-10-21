/**
 * The pet's recorded lines (v2 voice, "Before Home"): every line of assets/voice/lines.json is
 * recorded in each of the eight voices, so no screen asks for a clip that isn't shipped. Run
 * `npm run voice:samples --workspace=@app/web` after changing a line.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PRESET_IDS, SPECIES } from '@app/contract'

const DIR = join(__dirname, '../assets/voice')
const lines = JSON.parse(readFileSync(join(DIR, 'lines.json'), 'utf8')) as {
	meet: Record<string, string>
	custom: string
	hello: Record<string, string>
}

it('has a line for every preset', () => {
	for (const preset of PRESET_IDS) {
		expect(lines.meet[preset]).toBeTruthy()
		expect(lines.hello[preset]).toBeTruthy()
	}
	expect(lines.custom).toBeTruthy()
})

it('has every clip, in every voice', () => {
	const missing = SPECIES.flatMap((species) =>
		PRESET_IDS.flatMap((preset) =>
			['hello', 'meet', 'custom']
				.map((line) => `${species}-${preset}-${line}.m4a`)
				.filter((file) => !existsSync(join(DIR, file)))
		)
	)
	expect(missing).toEqual([])
})
