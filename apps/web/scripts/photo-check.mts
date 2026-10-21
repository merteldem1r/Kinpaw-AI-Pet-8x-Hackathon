// npm run photo:check --workspace=@app/web -- <photo or folder>… [--stub]
//
// Try the photo reader on your own photos before any screen exists (docs/application/features/
// v2-pet-from-photo-plan.md, Phase 2). Each photo goes through what the route does to it (shrunk,
// metadata stripped) and the real reader (Gemini 2.5 Flash on fal), then prints what it saw:
// the verdict, the pet in words, every attribute, and what a free account would get instead.
//
// It reads FAL_KEY (and PHOTO_MODEL) from apps/web/.env.local itself (node --env-file-if-exists):
// nobody needs to open that file. Nothing is stored, and no limit is counted: this calls the
// reader directly, not the route. Each photo is one paid read (about $0.0005). `--stub` runs the
// pretend reader instead, to check the script itself without a key. Never run in CI.

import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { ATTRIBUTE_KEYS, describeAppearance, freeVersionOf, optionLabel } from '@app/contract'
import { photoConfig } from '../src/server/photo/config'
import { createFalReader } from '../src/server/photo/fal'
import { preparePhoto } from '../src/server/photo/prepare-image'
import type { PhotoReader } from '../src/server/photo/reader'
import { createStubReader } from '../src/server/photo/stub'

const PHOTO_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])

async function photosIn(paths: string[]): Promise<string[]> {
	const found: string[] = []
	for (const path of paths) {
		if ((await stat(path)).isDirectory()) {
			for (const name of (await readdir(path)).sort()) {
				if (PHOTO_EXTENSIONS.has(extname(name).toLowerCase())) found.push(join(path, name))
			}
		} else {
			found.push(path)
		}
	}
	return found
}

function readerFor(stub: boolean): PhotoReader {
	if (stub) return createStubReader()
	const config = photoConfig()
	if (!config.falKey) {
		console.error('FAL_KEY is not set in apps/web/.env.local (or run with --stub).')
		process.exit(1)
	}
	return createFalReader({ apiKey: config.falKey, model: config.model })
}

async function main() {
	const args = process.argv.slice(2)
	const stub = args.includes('--stub')
	const paths = await photosIn(args.filter((arg) => arg !== '--stub'))
	if (paths.length === 0) {
		console.error('Give one or more photos (JPEG, PNG or WebP), or a folder of them.')
		process.exit(1)
	}
	const reader = readerFor(stub)
	console.log(`Reading ${paths.length} photo(s) with ${reader.name} (${reader.model})\n`)

	let tokens = 0
	for (const path of paths) {
		console.log(`── ${path}`)
		const prepared = await preparePhoto((await readFile(path)).toString('base64'))
		if (!prepared.ok) {
			console.log(`   not a photo the route would read (${prepared.reason})\n`)
			continue
		}
		const result = await reader.read(prepared.photo)
		tokens += (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0)
		if (!result.ok) {
			console.log(`   failed: ${result.failure} (${result.detail}), ${result.latencyMs} ms\n`)
			continue
		}
		const { answer } = result
		if (answer.verdict !== 'ok') {
			console.log(`   ${answer.verdict}, ${result.latencyMs} ms\n`)
			continue
		}
		const a = answer.appearance
		console.log(`   ${describeAppearance(a)}  (${result.latencyMs} ms)`)
		for (const key of ATTRIBUTE_KEYS) {
			console.log(`   ${key.padEnd(8)} ${optionLabel(key, a[key], a.species)}`)
		}
		const { swapped } = freeVersionOf(a)
		if (swapped.length > 0) {
			const words = swapped.map(
				(swap) =>
					`${optionLabel(swap.key, swap.from, a.species)} → ${optionLabel(swap.key, swap.to, a.species)}`
			)
			console.log(`   free account gets: ${words.join(', ')}`)
		}
		console.log('')
	}
	console.log(`Tokens used: ${tokens}`)
}

await main()
