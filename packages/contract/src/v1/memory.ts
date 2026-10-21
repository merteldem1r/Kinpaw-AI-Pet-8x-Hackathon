import { z } from 'zod'
import { isoDate, isoDateTime } from './common'
import { timeZoneSchema } from './needs'

// Long-term memory (docs/application/features/v2-memory-requirements.md): short facts about the
// person that the pet keeps and brings back. A fact is never what was said: the model writes it
// in the third person ("Has an exam on Friday"), and the server checks it with these rules before
// keeping it. The lists are here, not in database enums, so a new category ships without a
// migration.

/** What a fact is about (R2). No category exists for anything sensitive (R3). */
export const MEMORY_CATEGORIES = [
	'study',
	'work',
	'family',
	'pets',
	'hobbies',
	'place',
	'likes',
	'goals',
	'other'
] as const
export const memoryCategorySchema = z.enum(MEMORY_CATEGORIES)
export type MemoryCategory = z.infer<typeof memoryCategorySchema>

/** `lasting`: true until it changes (a sister's name). `event`: asked about once, then dropped (R7). */
export const MEMORY_KINDS = ['lasting', 'event'] as const
export const memoryKindSchema = z.enum(MEMORY_KINDS)
export type MemoryKind = z.infer<typeof memoryKindSchema>

/** Where a fact came from: a talk reply, or "Tell me about you". */
export const MEMORY_SOURCES = ['talk', 'intro'] as const
export type MemorySource = (typeof MEMORY_SOURCES)[number]

/** 0 small, 1 normal, 2 big: people, animals, life events. */
export const MEMORY_IMPORTANCE = [0, 1, 2] as const
export type MemoryImportance = (typeof MEMORY_IMPORTANCE)[number]

/** The longest fact, and the longest follow-up question, in characters (R1, R27). */
export const MEMORY_TEXT_MAX = 80
/** Tags per fact, and the longest tag (R2). */
export const MEMORY_TAGS_MAX = 6
export const MEMORY_TAG_MAX = 24
/** An event's follow-up is at most this many days ahead (R2). */
export const FOLLOW_UP_MAX_DAYS = 60
/** An event with no date given is followed up this many days after it was told. */
export const FOLLOW_UP_DEFAULT_DAYS = 7

/** Facts kept per pet (R5), and how many reach the model with each message (R9). */
export const MEMORY_CAP_FREE = 30
export const MEMORY_CAP_PLUS = 100
export const MEMORY_IN_PROMPT = 6

/**
 * A fact just kept, in a talk reply (R15): the app shows "Mochi will remember that" and can open
 * the list on it. Only the fact's id and words, never the tags or scores.
 */
export const rememberedSchema = z.object({
	id: z.uuid(),
	text: z.string().min(1).max(MEMORY_TEXT_MAX)
})
export type Remembered = z.infer<typeof rememberedSchema>

/** A fact as the model proposes it and the server keeps it, after `checkFact`. */
export type NewMemory = {
	text: string
	/** The question to ask when an event is due ("How did the exam go?"); null for lasting facts. */
	followUp: string | null
	category: MemoryCategory
	kind: MemoryKind
	importance: MemoryImportance
	tags: string[]
	/** YYYY-MM-DD, the local day after which an event is due; null for lasting facts. */
	followUpOn: string | null
}

/** Whitespace collapsed and trimmed: how a fact is stored. */
export const tidyFact = (text: string) => text.replace(/\s+/g, ' ').trim()

/** How two facts are compared for duplicates (R6): case, punctuation and spacing ignored. */
export function normaliseFact(text: string): string {
	return tidyFact(text)
		.toLowerCase()
		.replace(/[^\p{L}\p{N} ]/gu, '')
		.replace(/\s+/g, ' ')
		.trim()
}

// The sensitive words (R3, R4). The prompt tells the model never to keep these; this is the net
// under it, run on the fact and its tags whatever the model said. Kept narrow on purpose, since a
// false match throws away a good fact: "works at a hospital" and "a therapist" are jobs.
//
// Prefixes match the start of a word ("depress" catches "depressed", "depression"); whole words
// match only themselves ("age" must not catch "agency", "owe" must not catch "owen").
const SENSITIVE_PREFIXES = [
	// health, physical and mental
	'depress',
	'anxiety',
	'bipolar',
	'adhd',
	'autis',
	'suicid',
	'self-harm',
	'self harm',
	'diagnos',
	'cancer',
	'diabet',
	'pregnan',
	'miscarr',
	'disabilit',
	'disorder',
	'medication',
	'antidepress',
	'chemo',
	'illness',
	'panic attack',
	// religion
	'muslim',
	'islam',
	'christian',
	'catholic',
	'jewish',
	'judaism',
	'hindu',
	'buddhis',
	'atheis',
	'religio',
	'mosque',
	'synagogue',
	'ramadan',
	// politics
	'politic',
	'election',
	'democrat',
	'republican',
	'socialis',
	'communis',
	// sexuality and gender identity
	'lesbian',
	'bisexual',
	'queer',
	'transgender',
	'sexual',
	// ethnicity
	'ethnic',
	'racial',
	// money
	'debt',
	'mortgage',
	'salar',
	'bankrupt'
]
const SENSITIVE_WORDS = [
	'therapy',
	'vote',
	'voted',
	'voting',
	'gay',
	'came out',
	'coming out',
	'owe',
	'owes',
	'loan',
	'loans',
	'income',
	// age (R4)
	'age',
	'aged',
	'years old',
	'year old'
]
const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SENSITIVE = new RegExp(
	`\\b(?:${SENSITIVE_PREFIXES.map(escape).join('|')})|\\b(?:${SENSITIVE_WORDS.map(escape).join('|')})\\b`,
	'i'
)
/** An email address, or a run of six or more digits (a phone or account number). */
const CONTACT = /\S+@\S+\.\S+|(?:\d[\s-]?){6,}/

/** True when a fact (or one of its tags) touches something never kept (R3, R4). */
export function isSensitive(text: string, tags: readonly string[] = []): boolean {
	return [text, ...tags].some((part) => SENSITIVE.test(part) || CONTACT.test(part))
}

/** "I'm 9", "I am 12 years old": someone saying they are under 13, from whom nothing is kept (R4). */
const STATED_AGE =
	/\b(?:i'?m|i am)\s+(\d{1,2})(?:\s*(?:years?(?:\s*old)?|yrs?|y\/?o)\b|\s+(?:and|but|so|now)\b|\s*$|\s*[.!,])/i

export function saysUnder13(said: string): boolean {
	const match = STATED_AGE.exec(said)
	return match !== null && Number(match[1]) < 13
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Whole days from one YYYY-MM-DD to another. */
export function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/** A YYYY-MM-DD `days` after another. */
export function addDays(day: string, days: number): string {
	return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

const weekdayFormatters = new Map<string, Intl.DateTimeFormat>()

/** The weekday at `at` in `timeZone`, in English ("Saturday"): the prompt's "today" (R11). */
export function localWeekday(at: Date, timeZone: string): string {
	let formatter = weekdayFormatters.get(timeZone)
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' })
		weekdayFormatters.set(timeZone, formatter)
	}
	return formatter.format(at)
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * The days after `today`, with their weekdays: the prompt's calendar, so the model looks "Friday"
 * up instead of counting (the first check got it wrong).
 */
export function nextDays(today: string, count: number): { date: string; weekday: string }[] {
	return Array.from({ length: count }, (_, index) => {
		const date = addDays(today, index + 1)
		return { date, weekday: weekdayOf(date) }
	})
}

/** The weekday of a YYYY-MM-DD, in English ("Sunday"). */
export const weekdayOf = (day: string) => WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()]!

/** What the model proposed for one fact, before any check: the raw fields of its answer. */
export type ProposedMemory = {
	text: string
	follow_up: string
	category: MemoryCategory
	kind: MemoryKind
	importance: number
	tags: readonly string[]
	follow_up_on: string
}

/**
 * A proposed fact as the server keeps it, or null when it can't be kept (R1–R4, R13): empty or
 * too long, sensitive, or an importance outside 0–2. Tags are lowercased, trimmed, deduplicated
 * and capped. An event gets a follow-up date from tomorrow to FOLLOW_UP_MAX_DAYS ahead
 * (FOLLOW_UP_DEFAULT_DAYS when none was given or it has passed); one further ahead becomes a
 * lasting fact. A lasting fact has no follow-up.
 */
export function checkFact(proposed: ProposedMemory, today: string): NewMemory | null {
	const text = tidyFact(proposed.text)
	if (!text || text.length > MEMORY_TEXT_MAX) return null
	if (!MEMORY_IMPORTANCE.includes(proposed.importance as MemoryImportance)) return null

	const tags = [
		...new Set(
			proposed.tags
				.map((tag) => tag.trim().toLowerCase())
				.filter((tag) => tag.length > 0 && tag.length <= MEMORY_TAG_MAX)
		)
	].slice(0, MEMORY_TAGS_MAX)
	if (tags.length === 0) return null
	if (isSensitive(text, tags)) return null

	if (proposed.kind === 'lasting') {
		return {
			text,
			followUp: null,
			category: proposed.category,
			kind: 'lasting',
			importance: proposed.importance as MemoryImportance,
			tags,
			followUpOn: null
		}
	}

	// An event further ahead than FOLLOW_UP_MAX_DAYS ("a marathon in April") is kept as a lasting
	// fact: there is nothing to ask about yet. No date, or a day that has passed: the default.
	const given = proposed.follow_up_on.trim()
	const ahead = DATE.test(given) ? daysBetween(today, given) : NaN
	if (ahead > FOLLOW_UP_MAX_DAYS) {
		return checkFact({ ...proposed, kind: 'lasting', follow_up: '', follow_up_on: '' }, today)
	}
	const followUpOn = ahead >= 1 ? given : addDays(today, FOLLOW_UP_DEFAULT_DAYS)
	const question = tidyFact(proposed.follow_up)
	const followUp =
		question && question.length <= MEMORY_TEXT_MAX && !isSensitive(question) ? question : null
	return {
		text,
		followUp,
		category: proposed.category,
		kind: 'event',
		importance: proposed.importance as MemoryImportance,
		tags,
		followUpOn
	}
}

// ── Choosing what the model sees (R9) and what goes when full (R5, R7) ────────────────────────

/**
 * Words of worry or nerves. With an event coming up, they are most likely about it: the model
 * didn't make that link on its own ("I'm a bit nervous today", the exam tomorrow; Mert's first
 * live try, 2026-10-03), so the server does.
 */
const WORRIED =
	/\b(nervous|worried|worry|worrying|anxious|scared|afraid|stressed|stress|tense|panicking|dreading|can'?t sleep)\b/i

export const soundsWorried = (said: string) => WORRIED.test(said)

/** An event up to this many days ahead counts as "coming up" for a worried message. */
export const SOON_DAYS = 2

/** An event today or in the next SOON_DAYS days, not yet asked about. */
export function isSoon(
	fact: Pick<ScoredFact, 'kind' | 'followUpOn' | 'followedUpAt'>,
	today: string
): boolean {
	if (fact.kind !== 'event' || fact.followUpOn === null || fact.followedUpAt !== null) return false
	const ahead = daysBetween(today, fact.followUpOn)
	return ahead >= 0 && ahead <= SOON_DAYS
}

/**
 * The event a worried message is most likely about (null when it isn't worried, or nothing is
 * coming up): the nearest one, then the most important.
 */
export function likelyWorry<T extends ScoredFact>(
	facts: readonly T[],
	said: string,
	today: string
): T | null {
	if (!soundsWorried(said)) return null
	const soon = facts.filter((fact) => isSoon(fact, today))
	soon.sort((a, b) => a.followUpOn!.localeCompare(b.followUpOn!) || b.importance - a.importance)
	return soon[0] ?? null
}

/** The score's weights (R9): one place to tune them. */
export const MEMORY_SCORE = {
	/** Per tag found in what was just said, for at most `tagMatchesMax` tags. */
	tagMatch: 5,
	tagMatchesMax: 2,
	/** An event whose day has come and that hasn't been asked about. */
	due: 4,
	/** Not used for `unusedDays`. */
	unused: 1,
	unusedDays: 3,
	/** Used within `recentMinutes`: the pet doesn't bring the same thing up every message. */
	recent: -3,
	recentMinutes: 60
} as const

/** An event is deleted this many days after its date, followed up or not (R7). */
export const EVENT_KEEP_DAYS = 14

/** What scoring reads from a kept fact. */
export type ScoredFact = {
	tags: readonly string[]
	kind: MemoryKind
	importance: number
	/** YYYY-MM-DD, events only. */
	followUpOn: string | null
	followedUpAt: Date | null
	lastUsedAt: Date | null
	createdAt: Date
}

/** The words of what was said, lowercase, letters and digits only. */
function wordsOf(said: string): string[] {
	return said.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
}

/** A tag is said when one of its words matches, allowing a plural on either side ("exam", "exams"). */
function tagSaid(tag: string, words: readonly string[], padded: string): boolean {
	if (tag.includes(' ')) return padded.includes(` ${tag} `)
	return words.some((word) => word === tag || word === `${tag}s` || `${word}s` === tag)
}

/** An event whose day has come and that hasn't been followed up (R7, R9). */
export function isDue(
	fact: Pick<ScoredFact, 'kind' | 'followUpOn' | 'followedUpAt'>,
	today: string
): boolean {
	return (
		fact.kind === 'event' &&
		fact.followUpOn !== null &&
		fact.followUpOn <= today &&
		fact.followedUpAt === null
	)
}

/** An event more than EVENT_KEEP_DAYS past its day: deleted, never shown (R7). */
export function isExpired(fact: Pick<ScoredFact, 'kind' | 'followUpOn'>, today: string): boolean {
	return (
		fact.kind === 'event' &&
		fact.followUpOn !== null &&
		daysBetween(fact.followUpOn, today) > EVENT_KEEP_DAYS
	)
}

/**
 * How much a fact belongs in the prompt for what was just said (R9). With nothing said it
 * measures what a fact is worth keeping, which decides what goes when the memory is full (R5).
 */
export function scoreMemory(fact: ScoredFact, said: string, today: string, now: Date): number {
	const words = wordsOf(said)
	const padded = ` ${words.join(' ')} `
	const matches = fact.tags.filter((tag) => tagSaid(tag, words, padded)).length
	const usedAgo = fact.lastUsedAt ? now.getTime() - fact.lastUsedAt.getTime() : Infinity
	// Worried, with this event coming up: as good as being named.
	const worry = soundsWorried(said) && isSoon(fact, today) ? MEMORY_SCORE.tagMatch : 0
	return (
		worry +
		Math.min(matches, MEMORY_SCORE.tagMatchesMax) * MEMORY_SCORE.tagMatch +
		(isDue(fact, today) ? MEMORY_SCORE.due : 0) +
		fact.importance +
		(usedAgo >= MEMORY_SCORE.unusedDays * 86_400_000 ? MEMORY_SCORE.unused : 0) +
		(usedAgo < MEMORY_SCORE.recentMinutes * 60_000 ? MEMORY_SCORE.recent : 0)
	)
}

/** Short or common words that say nothing about which fact a reply is about. */
const PLAIN_WORDS = new Set([
	'has',
	'have',
	'with',
	'that',
	'this',
	'from',
	'called',
	'named',
	'their',
	'they',
	'about',
	'will',
	'been',
	'into',
	'likes',
	'loves'
])

/**
 * Whether a reply really brings a fact up (R15b): one of its tags, or a word of four letters or
 * more from its text, appears in the reply. The model says which note it used; this keeps a
 * reply that only claims it from lighting "From Mochi's memory".
 */
export function mentionsFact(
	reply: string,
	fact: { text: string; tags: readonly string[] }
): boolean {
	const words = wordsOf(reply)
	const padded = ` ${words.join(' ')} `
	const textWords = wordsOf(fact.text).filter((word) => word.length >= 4 && !PLAIN_WORDS.has(word))
	return [...fact.tags, ...textWords].some((tag) => tagSaid(tag, words, padded))
}

/**
 * The facts for this message, best first, at most `count` (R9): not expired, by score, ties to
 * the newer fact. Not "the newest six": that would forget a sister after six new facts.
 */
export function pickMemories<T extends ScoredFact>(
	facts: readonly T[],
	said: string,
	today: string,
	now: Date,
	count: number = MEMORY_IN_PROMPT
): T[] {
	return facts
		.filter((fact) => !isExpired(fact, today))
		.map((fact) => ({ fact, score: scoreMemory(fact, said, today, now) }))
		.sort((a, b) => b.score - a.score || b.fact.createdAt.getTime() - a.fact.createdAt.getTime())
		.slice(0, count)
		.map(({ fact }) => fact)
}

/**
 * Which facts go to make room for `incoming` new ones under `cap` (R5, R8): the lowest worth
 * (scored with nothing said), ties to the older fact. Empty when there is room.
 */
export function memoriesToEvict<T extends ScoredFact>(
	facts: readonly T[],
	cap: number,
	incoming: number,
	today: string,
	now: Date
): T[] {
	const over = facts.length + incoming - cap
	if (over <= 0) return []
	return facts
		.map((fact) => ({ fact, score: scoreMemory(fact, '', today, now) }))
		.sort((a, b) => a.score - b.score || a.fact.createdAt.getTime() - b.fact.createdAt.getTime())
		.slice(0, over)
		.map(({ fact }) => fact)
}

// ── GET /api/app/v1/pet/memories and DELETE /api/app/v1/pet/memories/:id (R16–R17) ─────────────

/** One fact as "Mochi remembers…" shows it: its words and labels, never its tags or scores. */
export const memoryItemSchema = z.object({
	id: z.uuid(),
	text: z.string().min(1).max(MEMORY_TEXT_MAX),
	category: memoryCategorySchema,
	kind: memoryKindSchema,
	/** YYYY-MM-DD, events only. */
	follow_up_on: isoDate.nullable(),
	source: z.enum(MEMORY_SOURCES),
	created_at: isoDateTime
})
export type MemoryItem = z.infer<typeof memoryItemSchema>

/** The most facts one page brings (R16): the full list pages through them, newest first. */
export const MEMORY_PAGE_MAX = 20
/** The longest search, in characters: a fact is at most 80. */
export const MEMORY_SEARCH_MAX = 60

/**
 * The person's local day decides which events have expired (R7). `q` searches the fact's words
 * and its tags (empty is no search). `cursor` is the previous page's `next_cursor`: an opaque
 * place in the list, so a fact deleted between pages never makes the next one skip or repeat.
 */
export const petMemoriesQuery = z
	.object({
		time_zone: timeZoneSchema,
		q: z.string().trim().max(MEMORY_SEARCH_MAX).optional(),
		cursor: z.string().min(1).max(120).optional(),
		limit: z.coerce.number().int().min(1).max(MEMORY_PAGE_MAX).optional()
	})
	.strict()

/**
 * One page of what the pet remembers, newest first. `total` is everything it remembers (the
 * "12 of 30"), `matched` what the search found (the same as `total` with no search), `cap` how
 * much it can keep (30, or 100 with Plus), and `next_cursor` the next page, or null at the end.
 */
export const petMemoriesResponse = z.object({
	memories: z.array(memoryItemSchema),
	cap: z.number().int().positive(),
	total: z.number().int().min(0),
	matched: z.number().int().min(0),
	next_cursor: z.string().nullable()
})
export type PetMemoriesResponse = z.infer<typeof petMemoriesResponse>

export const deletePetMemoryParams = z.object({ id: z.uuid() }).strict()
/** Where the person deleted it: "Mochi remembers…", or a ✕ on the intro's chips (R23). */
export const deletePetMemoryQuery = z.object({ from: z.enum(['list', 'intro']) }).strict()
export const deletePetMemoryResponse = z.object({ ok: z.literal(true) })
