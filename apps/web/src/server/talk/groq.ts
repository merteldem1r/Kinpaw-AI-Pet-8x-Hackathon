import { z } from 'zod'
import { log } from '@/server/lib/logger'
import { buildIntroMessages } from './intro-prompt'
import { INTRO_JSON_SCHEMA, parseIntro } from './intro-schema'
import { buildMessages, type ChatMessage } from './prompt'
import {
	NO_USAGE,
	type IntroRequest,
	type IntroResult,
	type ReplyProvider,
	type ReplyRequest,
	type ReplyResult,
	type ReplyUsage
} from './reply-provider'
import { parsePetReply, PET_REPLY_JSON_SCHEMA, petReplyWithMemorySchema } from './reply-schema'

// The pet's replies from Groq's free tier (docs/memory/ai-provider-deferred.md): an
// OpenAI-compatible chat endpoint, called with plain fetch. The answer is held to
// PET_REPLY_JSON_SCHEMA by Groq's strict mode, then checked again by parsePetReply.
//
// Nothing said, and no reply, is ever logged: failures log the status and a reason only.

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
/**
 * gpt-oss-120b since 2026-10-03 (v2-memory-plan.md, Phase 0): with long-term memory it updates a
 * fact that changed, which gpt-oss-20b never did, and labelled every intent right.
 */
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'
/** The server gives up after this; the phone waits a little longer (20s) for the whole route. */
const GROQ_TIMEOUT_MS = 10_000
/** Room for gpt-oss's short reasoning plus a 200-character reply and, with memory on, one fact. */
const MAX_COMPLETION_TOKENS = 600
/** The intro's answer: the reasoning, a line and up to 8 facts of about 60 tokens each. */
const INTRO_MAX_COMPLETION_TOKENS = 1_200

/**
 * Groq's error code when the model's answer didn't pass Groq's own check against the schema. It
 * happens now and then with strict mode (seen once live on 2026-10-03, never in the check
 * runs), and Groq's advice is to try again.
 */
const SCHEMA_REJECTED = 'json_validate_failed'
/** One more try only when the first left the phone time to wait for it (it waits 20s). */
export const RETRY_WITHIN_MS = 5_000

/** A 400's error code, logged so a refused request can be told apart. Never its message. */
const errorBodySchema = z.object({ error: z.object({ code: z.string().regex(/^[a-z_]{1,40}$/) }) })

const responseSchema = z.object({
	choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
	usage: z
		.object({ prompt_tokens: z.number().optional(), completion_tokens: z.number().optional() })
		.optional()
})

function usageOf(body: z.infer<typeof responseSchema>): ReplyUsage {
	return {
		inputTokens: body.usage?.prompt_tokens ?? null,
		outputTokens: body.usage?.completion_tokens ?? null
	}
}

export type GroqOptions = {
	apiKey: string
	model?: string
	timeoutMs?: number
	/** Injected in tests. */
	fetchImpl?: typeof fetch
}

export function createGroqProvider({
	apiKey,
	model = DEFAULT_GROQ_MODEL,
	timeoutMs = GROQ_TIMEOUT_MS,
	fetchImpl = fetch
}: GroqOptions): ReplyProvider {
	type Call<T> = {
		/** Which answer this is, in the logs. */
		purpose: 'talk' | 'intro'
		messages: ChatMessage[]
		schema: object
		maxTokens: number
		/** The model's JSON as our answer, or null when it isn't one we can use. */
		parse: (content: unknown) => T | null
	}
	type CallResult<T> =
		| { ok: true; value: T; usage: ReplyUsage; latencyMs: number }
		| Extract<ReplyResult, { ok: false }>

	/**
	 * One answer in a strict shape. A request Groq refused because the model's answer failed its
	 * schema check is tried once more, when there is time; anything else is answered as it came.
	 */
	async function complete<T>(call: Call<T>): Promise<CallResult<T>> {
		const first = await attempt(call)
		if (
			first.ok ||
			first.detail !== `http_400:${SCHEMA_REJECTED}` ||
			first.latencyMs > RETRY_WITHIN_MS
		) {
			return first
		}
		const second = await attempt(call)
		return { ...second, latencyMs: first.latencyMs + second.latencyMs }
	}

	async function attempt<T>({
		purpose,
		messages,
		schema,
		maxTokens,
		parse
	}: Call<T>): Promise<CallResult<T>> {
		const started = performance.now()
		const elapsed = () => Math.round(performance.now() - started)
		const fail = (
			failure: 'unavailable' | 'invalid',
			detail: string,
			usage: ReplyUsage = NO_USAGE
		): CallResult<T> => {
			log.warn('talk reply failed', {
				source: 'talk',
				provider: 'groq',
				model,
				purpose,
				failure,
				detail
			})
			return { ok: false, failure, detail, usage, latencyMs: elapsed() }
		}

		let response: Response
		try {
			response = await fetchImpl(ENDPOINT, {
				method: 'POST',
				headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model,
					messages,
					reasoning_effort: 'low',
					max_completion_tokens: maxTokens,
					response_format: {
						type: 'json_schema',
						json_schema: {
							name: purpose === 'talk' ? 'pet_reply' : 'pet_intro',
							strict: true,
							schema
						}
					}
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
				log.error('groq refused the key', { source: 'talk', status: response.status })
			}
			// 400 means our request (or Groq's schema check) failed: the model's fault or ours, not
			// the network's. Its code says which. Everything else (429 rate limit, 5xx) is "not
			// connected".
			if (response.status === 400) {
				const refused = errorBodySchema.safeParse(await response.json().catch(() => null))
				return fail('invalid', refused.success ? `http_400:${refused.data.error.code}` : 'http_400')
			}
			return fail('unavailable', `http_${response.status}`)
		}

		const body = responseSchema.safeParse(await response.json().catch(() => null))
		if (!body.success) return fail('invalid', 'response_shape')
		const usage = usageOf(body.data)

		let content: unknown
		try {
			content = JSON.parse(body.data.choices[0]!.message.content ?? '')
		} catch {
			return fail('invalid', 'not_json', usage)
		}
		const value = parse(content)
		if (value === null) return fail('invalid', 'schema', usage)
		return { ok: true, value, usage, latencyMs: elapsed() }
	}

	/** The pet's reply to a message. */
	async function reply(request: ReplyRequest): Promise<ReplyResult> {
		// Memory on (v2-memory-requirements.md, R12): the bigger answer shape, with `replaces`
		// limited to the refs this prompt shows.
		const refs = request.memory?.facts.map((fact) => fact.ref) ?? []
		const result = await complete({
			purpose: 'talk',
			messages: buildMessages(request),
			schema: request.memory ? petReplyWithMemorySchema(refs) : PET_REPLY_JSON_SCHEMA,
			maxTokens: MAX_COMPLETION_TOKENS,
			parse: (content) =>
				parsePetReply(
					content,
					request.memory ? { today: request.memory.today, refs, said: request.said } : undefined
				)
		})
		if (!result.ok) return result
		const { value, ...rest } = result
		return { ...rest, reply: value }
	}

	/** "Tell me about you": the pet's first reaction and the facts to keep (R21). */
	async function intro(request: IntroRequest): Promise<IntroResult> {
		const result = await complete({
			purpose: 'intro',
			messages: buildIntroMessages(request),
			schema: INTRO_JSON_SCHEMA,
			maxTokens: INTRO_MAX_COMPLETION_TOKENS,
			parse: (content) => parseIntro(content, request.said, request.today)
		})
		if (!result.ok) return result
		const { value, ...rest } = result
		return { ...rest, answer: value }
	}

	return { name: 'groq', model, reply, intro }
}
