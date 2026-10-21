import type { PhotoConfig } from './config'
import { createFalReader } from './fal'
import type { PhotoReader } from './reader'
import { createStubReader } from './stub'

// Which reader looks at the photo (v2-pet-from-photo-requirements.md, R6): fal when its key is
// set; the stub in development and tests without one; nothing in production without one, so the
// photo routes answer `not_configured` instead of a pretend pet.

export function photoReader(config: PhotoConfig): PhotoReader | null {
	if (config.falKey) return createFalReader({ apiKey: config.falKey, model: config.model })
	return process.env.NODE_ENV === 'production' ? null : createStubReader()
}
