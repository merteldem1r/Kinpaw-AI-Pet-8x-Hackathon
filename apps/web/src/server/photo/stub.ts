import { createHash } from 'node:crypto'
import { randomAppearance, SPECIES } from '@app/contract'
import type { PhotoAnswer } from './answer-schema'
import { NO_PHOTO_USAGE, type PhotoReader, type PhotoReadResult } from './reader'

// A pretend reader for tests, CI and development without a key (v2-pet-from-photo-requirements.md,
// R6): it never looks at the photo and never leaves the machine. Each photo gets its own pet, the
// same one every time (seeded by the photo's bytes), Plus options included, so every screen, the
// swaps and the note can be built and shown. Tests pass a fixed answer instead.

export function createStubReader(fixed?: PhotoAnswer): PhotoReader {
	return {
		name: 'stub',
		model: 'stub',
		async read(photo): Promise<PhotoReadResult> {
			return {
				ok: true,
				answer: fixed ?? answerFor(photo.base64),
				usage: NO_PHOTO_USAGE,
				latencyMs: 0
			}
		}
	}
}

function answerFor(base64: string): PhotoAnswer {
	let seed = createHash('sha256').update(base64).digest().readUInt32BE(0) || 1
	const random = () => {
		seed = (seed * 16807) % 2147483647
		return (seed - 1) / 2147483646
	}
	const species = SPECIES[Math.floor(random() * SPECIES.length)]!
	return { verdict: 'ok', appearance: randomAppearance(species, { includePremium: true, random }) }
}
