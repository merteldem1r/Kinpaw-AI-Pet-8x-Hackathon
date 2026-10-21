import { z } from 'zod'
import type { PresetId, Species } from '@app/contract'
import { log } from '@/server/lib/logger'
import { INWORLD_PLAYBACK_RATE, INWORLD_VOICES, MINIMAX_VOICES, type Emotion } from './voices'

// The pet's spoken voice on fal.ai (docs/application/features/v2-voice-requirements.md), called
// with plain fetch, synchronously, like the photo reader. fal keeps the audio file and answers
// with its URL, which the phone plays. Two models behind one interface, chosen by VOICE_PROVIDER:
//
// - `inworld` (the default since 2026-10-06): Inworld TTS-1.5 Max, $0.01 per 1,000 characters
//   (about $0.001 a reply). A voice and nothing else; the phone plays it at
//   INWORLD_PLAYBACK_RATE without pitch correction, so the pet sounds small. Chosen by Mert for
//   the cost ($5 a month for a heavy Plus user was too much).
// - `minimax`: MiniMax Speech 2.8 Turbo, $0.06 per 1,000 characters (about $0.006 a reply). A
//   pitch, a speed and an emotion per call; six times the price.
//
// Nothing about the words is ever logged: failures log the status and a reason.

/** The phone gives up a little later (15 s): a voice later than this is no longer "a beat". */
const VOICE_TIMEOUT_MS = 10_000

export type SpeakRequest = { text: string; species: Species; preset: PresetId; emotion: Emotion }

export type SpeakResult =
	| { ok: true; audioUrl: string; durationMs: number; playbackRate: number; latencyMs: number }
	| { ok: false; failure: 'unavailable' | 'invalid'; detail: string; latencyMs: number }

export type VoiceProvider = {
	name: string
	model: string
	/** The voice it would use for this pet, for the check script. */
	voiceFor(species: Species, preset: PresetId): string
	speak(request: SpeakRequest): Promise<SpeakResult>
}

export const VOICE_PROVIDERS = ['minimax', 'inworld'] as const
export type VoiceProviderName = (typeof VOICE_PROVIDERS)[number]

export type FalVoiceOptions = {
	apiKey: string
	timeoutMs?: number
	/** Injected in tests. */
	fetchImpl?: typeof fetch
}

/** What differs between the models: the endpoint, the request, and reading the answer. */
type Model = {
	model: string
	/** How much faster the phone plays it (without pitch correction). */
	playbackRate: number
	voiceFor(species: Species, preset: PresetId): string
	input(request: SpeakRequest): Record<string, unknown>
	answer: z.ZodType<{ audioUrl: string; durationMs: number }>
}

const MODELS: Record<VoiceProviderName, Model> = {
	minimax: {
		model: 'minimax/speech-2.8-turbo',
		playbackRate: 1,
		voiceFor: (species, preset) => {
			const voice = MINIMAX_VOICES[species][preset]
			return `${voice.id}, pitch ${voice.pitch}, speed ${voice.speed}`
		},
		input: ({ text, species, preset, emotion }) => {
			const voice = MINIMAX_VOICES[species][preset]
			return {
				prompt: text,
				voice_setting: { voice_id: voice.id, pitch: voice.pitch, speed: voice.speed, emotion },
				language_boost: 'auto',
				output_format: 'url'
			}
		},
		answer: z
			.object({
				audio: z.object({ url: z.url() }),
				duration_ms: z.number().int().min(0).optional()
			})
			.transform((body) => ({ audioUrl: body.audio.url, durationMs: body.duration_ms ?? 0 }))
	},
	inworld: {
		model: 'inworld-tts',
		playbackRate: INWORLD_PLAYBACK_RATE,
		voiceFor: (species, preset) => INWORLD_VOICES[species][preset],
		// 24 kHz: Inworld answers a WAV, and half the default rate halves what the phone downloads.
		input: ({ text, species, preset }) => ({
			text,
			voice: INWORLD_VOICES[species][preset],
			sample_rate_hertz: 24_000
		}),
		answer: z
			.object({ audio: z.object({ url: z.url() }) })
			.transform((body) => ({ audioUrl: body.audio.url, durationMs: 0 }))
	}
}

export function createFalVoice(
	name: VoiceProviderName,
	{ apiKey, timeoutMs = VOICE_TIMEOUT_MS, fetchImpl = fetch }: FalVoiceOptions
): VoiceProvider {
	const { model, playbackRate, voiceFor, input, answer } = MODELS[name]
	const endpoint = `https://fal.run/fal-ai/${model}`

	async function speak(request: SpeakRequest): Promise<SpeakResult> {
		const started = performance.now()
		const elapsed = () => Math.round(performance.now() - started)
		const fail = (failure: 'unavailable' | 'invalid', detail: string): SpeakResult => {
			log.warn('voice failed', { source: 'voice', provider: 'fal', model, failure, detail })
			return { ok: false, failure, detail, latencyMs: elapsed() }
		}

		let response: Response
		try {
			response = await fetchImpl(endpoint, {
				method: 'POST',
				headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
				body: JSON.stringify(input(request)),
				signal: AbortSignal.timeout(timeoutMs)
			})
		} catch (error) {
			const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
			return fail('unavailable', timedOut ? 'timeout' : 'network')
		}

		if (!response.ok) {
			// A bad or revoked key is a setup problem, not a passing outage: say so loudly.
			if (response.status === 401 || response.status === 403) {
				log.error('fal refused the key', { source: 'voice', status: response.status })
			}
			return fail(response.status === 422 ? 'invalid' : 'unavailable', `http_${response.status}`)
		}

		const body = answer.safeParse(await response.json().catch(() => null))
		if (!body.success) return fail('invalid', 'response_shape')
		return { ok: true, ...body.data, playbackRate, latencyMs: elapsed() }
	}

	return { name: 'fal', model, voiceFor, speak }
}

/** VOICE_PROVIDER as set, or Inworld when unset or unknown. */
export function voiceProviderName(): VoiceProviderName {
	const set = process.env.VOICE_PROVIDER?.trim()
	return set === 'minimax' ? 'minimax' : 'inworld'
}

/**
 * fal when FAL_KEY is set (the same key as the photo read); otherwise none, in every
 * environment: a pretend voice has nothing to play, so the route answers `not_configured` and the
 * phone keeps the text.
 */
export function voiceProvider(): VoiceProvider | null {
	const apiKey = process.env.FAL_KEY?.trim()
	return apiKey ? createFalVoice(voiceProviderName(), { apiKey }) : null
}
