import { z } from 'zod'
import { log } from '@/server/lib/logger'
import { parsePhotoAnswer } from './answer-schema'
import { photoPrompt } from './catalog-prompt'
import { DEFAULT_PHOTO_MODEL } from './config'
import {
	NO_PHOTO_USAGE,
	type PhotoReader,
	type PhotoReadResult,
	type PhotoUsage,
	type PreparedPhoto
} from './reader'

// The photo reader on fal.ai (v2-pet-from-photo-requirements.md, R6): fal's OpenRouter vision
// endpoint, called with plain fetch, synchronously. The photo goes inline as a data URI, so it is
// never uploaded to fal's storage (checked live on 2026-10-04: 200, about 2 s, $0.0004 a read).
// The endpoint has no schema mode: the answer is asked for as JSON and checked by
// parsePhotoAnswer, with one more try when it can't be used.
//
// Nothing about the photo or the answer is ever logged: failures log the status and a reason.

const ENDPOINT = 'https://fal.run/openrouter/router/vision'
/** The server gives up after this; the phone waits a little longer (25 s) for the whole route. */
const FAL_TIMEOUT_MS = 15_000
/** One more try only when the first left the phone time to wait for it. */
export const RETRY_WITHIN_MS = 6_000
/** Room for "seen" and ten ids. */
const MAX_TOKENS = 500

const responseSchema = z.object({
	output: z.string(),
	usage: z
		.object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() })
		.optional()
})

export type FalOptions = {
	apiKey: string
	model?: string
	timeoutMs?: number
	/** Injected in tests. */
	fetchImpl?: typeof fetch
}

export function createFalReader({
	apiKey,
	model = DEFAULT_PHOTO_MODEL,
	timeoutMs = FAL_TIMEOUT_MS,
	fetchImpl = fetch
}: FalOptions): PhotoReader {
	async function read(photo: PreparedPhoto): Promise<PhotoReadResult> {
		const first = await attempt(photo)
		if (first.ok || first.failure !== 'invalid' || first.latencyMs > RETRY_WITHIN_MS) return first
		const second = await attempt(photo)
		return { ...second, latencyMs: first.latencyMs + second.latencyMs }
	}

	async function attempt(photo: PreparedPhoto): Promise<PhotoReadResult> {
		const started = performance.now()
		const elapsed = () => Math.round(performance.now() - started)
		const fail = (
			failure: 'unavailable' | 'invalid',
			detail: string,
			usage: PhotoUsage = NO_PHOTO_USAGE
		): PhotoReadResult => {
			log.warn('photo read failed', { source: 'photo', provider: 'fal', model, failure, detail })
			return { ok: false, failure, detail, usage, latencyMs: elapsed() }
		}

		const { system, user } = photoPrompt()
		let response: Response
		try {
			response = await fetchImpl(ENDPOINT, {
				method: 'POST',
				headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model,
					system_prompt: system,
					prompt: user,
					image_urls: [`data:${photo.mime};base64,${photo.base64}`],
					temperature: 0,
					max_tokens: MAX_TOKENS
				}),
				signal: AbortSignal.timeout(timeoutMs)
			})
		} catch (error) {
			const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
			return fail('unavailable', timedOut ? 'timeout' : 'network')
		}

		if (!response.ok) {
			// A bad or revoked key is a setup problem, not a passing outage: say so loudly.
			if (response.status === 401 || response.status === 403) {
				log.error('fal refused the key', { source: 'photo', status: response.status })
			}
			// 422 is fal refusing our request (the model id, the input): ours, not the network's.
			return fail(response.status === 422 ? 'invalid' : 'unavailable', `http_${response.status}`)
		}

		const body = responseSchema.safeParse(await response.json().catch(() => null))
		if (!body.success) return fail('invalid', 'response_shape')
		const usage: PhotoUsage = {
			inputTokens: body.data.usage?.prompt_tokens ?? null,
			outputTokens: body.data.usage?.completion_tokens ?? null
		}
		const answer = parsePhotoAnswer(body.data.output)
		if (!answer) return fail('invalid', 'answer', usage)
		return { ok: true, answer, usage, latencyMs: elapsed() }
	}

	return { name: 'fal', model, read }
}
