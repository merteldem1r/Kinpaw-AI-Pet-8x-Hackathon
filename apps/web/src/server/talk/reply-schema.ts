import { z } from 'zod'
import {
	actionSchema,
	checkFact,
	INTENTS,
	intentSchema,
	MEMORY_CATEGORIES,
	MEMORY_IMPORTANCE,
	MEMORY_KINDS,
	memoryCategorySchema,
	memoryKindSchema,
	saysUnder13,
	TALK_REPLY_MAX
} from '@app/contract'
import type { MemoryOp, PetReply } from './reply-provider'

// The one shape the model must answer in (m6-talk-requirements.md, R5): the JSON schema Groq
// enforces while it writes, and the Zod check we run on what comes back anyway. Both live here
// so they can't drift apart. "No suggestion" is the word `none` rather than a null, which
// strict schema modes handle more reliably than nullable enums.
//
// With long-term memory on (v2-memory-requirements.md, R12) the answer gains a `memory` object.
// Strict mode wants every key, so "nothing to remember" is `action: "none"` with empty fields.
// The memory part is checked on its own: a bad one is dropped and the reply stands (R13).

const NO_SUGGESTION = 'none'
const SUGGESTIONS = [...actionSchema.options, NO_SUGGESTION] as const
const MEMORY_ACTIONS = ['none', 'add', 'replace'] as const
/** `replaces` when the memory doesn't replace anything. */
const NO_REF = ''

const REPLY_PROPERTIES = {
	reply: { type: 'string' },
	intent: { type: 'string', enum: [...INTENTS] },
	suggested_action: { type: 'string', enum: [...SUGGESTIONS] }
} as const

/** One fact's fields in a strict response format: talking's memory and the intro's facts. */
export const FACT_PROPERTIES = {
	text: { type: 'string' },
	category: { type: 'string', enum: [...MEMORY_CATEGORIES] },
	kind: { type: 'string', enum: [...MEMORY_KINDS] },
	importance: { type: 'integer', enum: [...MEMORY_IMPORTANCE] },
	tags: { type: 'array', items: { type: 'string' } },
	follow_up_on: { type: 'string' },
	follow_up: { type: 'string' }
} as const
export const FACT_REQUIRED = Object.keys(FACT_PROPERTIES) as (keyof typeof FACT_PROPERTIES)[]

/** Sent to the model as the response format (strict: no other keys, every key required). */
export const PET_REPLY_JSON_SCHEMA = {
	type: 'object',
	properties: REPLY_PROPERTIES,
	required: ['reply', 'intent', 'suggested_action'],
	additionalProperties: false
} as const

/**
 * The response format with memory on. `replaces` can only be one of the refs this prompt showed
 * (or empty), so the model can't name a fact it wasn't given.
 */
export function petReplyWithMemorySchema(refs: readonly string[]) {
	return {
		type: 'object',
		properties: {
			...REPLY_PROPERTIES,
			recalled: { type: 'string', enum: [NO_REF, ...refs] },
			memory: {
				type: 'object',
				properties: {
					action: { type: 'string', enum: [...MEMORY_ACTIONS] },
					replaces: { type: 'string', enum: [NO_REF, ...refs] },
					...FACT_PROPERTIES
				},
				required: ['action', 'replaces', ...FACT_REQUIRED],
				additionalProperties: false
			}
		},
		required: ['reply', 'intent', 'suggested_action', 'recalled', 'memory'],
		additionalProperties: false
	} as const
}

const rawReplySchema = z.object({
	reply: z.string(),
	intent: intentSchema,
	suggested_action: z.enum(SUGGESTIONS)
})

/** One fact as the model writes it, before `checkFact`: shared with the intro (intro-schema.ts). */
export const rawFactSchema = z.object({
	text: z.string(),
	category: memoryCategorySchema,
	kind: memoryKindSchema,
	importance: z.number(),
	tags: z.array(z.string()),
	follow_up_on: z.string(),
	follow_up: z.string()
})

const rawMemorySchema = rawFactSchema.extend({
	action: z.enum(MEMORY_ACTIONS),
	replaces: z.string()
})

const SENTENCE_END = /[.!?…](?=["')\]]*(\s|$))/g

/**
 * The reply as the bubble shows it: whitespace collapsed, wrapping quotes removed, and anything
 * past TALK_REPLY_MAX cut at the last sentence that fits (or the last word, with an ellipsis).
 */
export function tidyReply(text: string): string {
	let reply = text.replace(/\s+/g, ' ').trim()
	if (/^["“].*["”]$/.test(reply)) reply = reply.slice(1, -1).trim()
	if (reply.length <= TALK_REPLY_MAX) return reply

	const head = reply.slice(0, TALK_REPLY_MAX)
	let cut = 0
	for (const match of head.matchAll(SENTENCE_END)) cut = match.index + match[0].length
	if (cut > 0) return head.slice(0, cut).trim()
	const lastSpace = head.lastIndexOf(' ', TALK_REPLY_MAX - 1)
	return `${head.slice(0, lastSpace > 0 ? lastSpace : TALK_REPLY_MAX - 1).trim()}…`
}

/** What parsing needs to check a memory: memory is on when this is given. */
export type MemoryParse = {
	/** YYYY-MM-DD in the person's time zone, for the follow-up date. */
	today: string
	/** The refs the prompt showed: the only ones a replace may name. */
	refs: readonly string[]
	/** What was just said: someone saying they are under 13 has nothing kept (R4). */
	said: string
}

/**
 * The memory part of an answer as an operation to apply, or null: nothing to keep, a shape we
 * can't use, a replace naming a fact the prompt didn't show, or a fact `checkFact` refuses.
 */
export function parseMemoryOp(raw: unknown, { today, refs, said }: MemoryParse): MemoryOp | null {
	const parsed = rawMemorySchema.safeParse(raw)
	if (!parsed.success || parsed.data.action === 'none') return null
	if (saysUnder13(said)) return null
	const fact = checkFact(parsed.data, today)
	if (!fact) return null
	if (parsed.data.action === 'add') return { action: 'add', fact }
	const ref = parsed.data.replaces
	return ref !== NO_REF && refs.includes(ref) ? { action: 'replace', ref, fact } : null
}

/**
 * The model's answer (parsed JSON) as a reply, or null when it isn't one we can use. With
 * `memory`, the answer's memory part is checked too; a bad one leaves `memory` null and never
 * fails the reply.
 */
export function parsePetReply(raw: unknown, memory?: MemoryParse): PetReply | null {
	const parsed = rawReplySchema.safeParse(raw)
	if (!parsed.success) return null
	const reply = tidyReply(parsed.data.reply)
	if (!reply) return null
	const { intent, suggested_action } = parsed.data
	const fields =
		memory && typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
	const recalled = typeof fields.recalled === 'string' ? fields.recalled : NO_REF
	return {
		reply,
		intent,
		suggestedAction: suggested_action === NO_SUGGESTION ? null : suggested_action,
		memory: memory ? parseMemoryOp(fields.memory ?? null, memory) : null,
		recalled: memory && memory.refs.includes(recalled) ? recalled : null
	}
}
