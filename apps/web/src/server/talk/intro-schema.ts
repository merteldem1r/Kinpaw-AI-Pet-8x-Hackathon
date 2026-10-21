import { z } from 'zod'
import {
	checkFact,
	INTRO_FACTS_MAX,
	normaliseFact,
	saysUnder13,
	type NewMemory
} from '@app/contract'
import type { IntroAnswer } from './reply-provider'
import { FACT_PROPERTIES, FACT_REQUIRED, rawFactSchema, tidyReply } from './reply-schema'

// The shape the intro's answer must take (v2-memory-requirements.md, R21): the JSON schema Groq
// enforces while it writes, and the check we run on what comes back anyway. Each fact goes
// through `checkFact`, like talking's; a bad fact is dropped and the rest stand. Strict mode
// can't cap an array's length, so the cap is applied here.

export const INTRO_JSON_SCHEMA = {
	type: 'object',
	properties: {
		line: { type: 'string' },
		facts: {
			type: 'array',
			items: {
				type: 'object',
				properties: FACT_PROPERTIES,
				required: FACT_REQUIRED,
				additionalProperties: false
			}
		}
	},
	required: ['line', 'facts'],
	additionalProperties: false
} as const

const rawIntroSchema = z.object({ line: z.string(), facts: z.array(z.unknown()) })

/**
 * The facts to keep from the model's list: each checked (R1–R4), the same fact once, at most
 * INTRO_FACTS_MAX, in the model's order (most important first). None from someone who says they
 * are under 13 (R4).
 */
export function introFacts(raw: readonly unknown[], said: string, today: string): NewMemory[] {
	if (saysUnder13(said)) return []
	const seen = new Set<string>()
	const facts: NewMemory[] = []
	for (const item of raw) {
		const parsed = rawFactSchema.safeParse(item)
		const fact = parsed.success ? checkFact(parsed.data, today) : null
		if (!fact || seen.has(normaliseFact(fact.text))) continue
		seen.add(normaliseFact(fact.text))
		facts.push(fact)
		if (facts.length === INTRO_FACTS_MAX) break
	}
	return facts
}

/** The model's answer (parsed JSON) as the intro's, or null when it has no usable line. */
export function parseIntro(raw: unknown, said: string, today: string): IntroAnswer | null {
	const parsed = rawIntroSchema.safeParse(raw)
	if (!parsed.success) return null
	const line = tidyReply(parsed.data.line)
	if (!line) return null
	return { line, facts: introFacts(parsed.data.facts, said, today) }
}
