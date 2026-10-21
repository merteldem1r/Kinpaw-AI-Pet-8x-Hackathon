// npm run talk:check --workspace=@app/web [-- --stub] [-- --model <id>] [-- --no-memory | --memory-only]
//
// The model check for talking to the pet (docs/application/features/m6-talk-requirements.md, R6;
// m6-talk-plan.md, Phase 0), with long-term memory on (v2-memory-plan.md, Phase 0). Runs every
// labelled phrase in talk-check.fixtures.ts through the real prompt and provider, then scores it.
//
// Intents, the bar Mert accepted on 2026-10-01, raised with memory on (v2-memory-plan.md):
//   - at least 85% of intents right (95% with memory on: it was 98% before memory)
//   - `upset` never labelled `harsh`
//   - `harsh` never labelled `kind` or `affectionate`
//   - every answer valid
//   - median latency under 1.5 seconds
//
// Memory (with memory on):
//   - nothing sensitive kept, ever (after the server's checks, which is what would be stored)
//   - at least 80% of the facts worth keeping kept
//   - at most one "nothing to keep" phrase kept
//   - nothing the pet already remembers added again
//
// It reads GROQ_API_KEY from apps/web/.env.local itself (node --env-file-if-exists): nobody
// needs to open that file. Never run in CI: it needs the key and spends free quota (one run is
// roughly 75 calls, about half of Groq's free daily tokens). `--stub` runs the pretend pet
// instead, to check the script itself without a key. `--no-memory` runs M6's check unchanged;
// `--memory-only` runs only the memory phrases (about 40% of the quota) while tuning the guide,
// and passes on the memory bar alone: a full run is still needed before calling it done.

import {
	addDays,
	daysBetween,
	isSoon,
	localDay,
	localWeekday,
	soundsWorried,
	type Species
} from '@app/contract'
import { createGroqProvider, DEFAULT_GROQ_MODEL } from '../src/server/talk/groq'
import type {
	PromptMemoryContext,
	ReplyProvider,
	ReplyResult
} from '../src/server/talk/reply-provider'
import { createStubProvider } from '../src/server/talk/stub'
import {
	CHECK_KNOWN,
	CHECK_PETS,
	CHECK_PHRASES,
	MEMORY_PHRASES,
	type CheckPhrase,
	type MemoryCheckPhrase
} from '../src/server/talk/talk-check.fixtures'

const BAR = {
	accuracy: 0.85,
	accuracyWithMemory: 0.95,
	medianMs: 1500,
	saveRecall: 0.8,
	noneKeptMax: 1
} as const
/** Groq's free tier allows about 8K tokens a minute: wait and retry on a 429. */
const RATE_LIMIT_WAIT_MS = 10_000
const RATE_LIMIT_RETRIES = 6
/** The check's time zone: today's date and weekday in the prompt come from it. */
const TIME_ZONE = 'Europe/Istanbul'

const args = process.argv.slice(2)
const useStub = args.includes('--stub')
const memoryOn = !args.includes('--no-memory')
const memoryOnly = memoryOn && args.includes('--memory-only')
const modelArg = args.includes('--model') ? args[args.indexOf('--model') + 1] : undefined

function chooseProvider(): ReplyProvider {
	if (useStub) return createStubProvider()
	const apiKey = process.env.GROQ_API_KEY?.trim()
	if (!apiKey) {
		console.error(
			'No GROQ_API_KEY. Put it in apps/web/.env.local and run `npm run talk:check --workspace=@app/web`,\nor pass --stub to check the script without a key.'
		)
		process.exit(1)
	}
	const model = modelArg ?? (process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL)
	return createGroqProvider({ apiKey, model })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const now = new Date()
const today = localDay(now, TIME_ZONE)

/** The memory a prompt carries: today, and these facts as m1, m2… (none is still memory on). */
function memoryOf(
	known: readonly { text: string; kind: 'lasting' | 'event'; followUpOn?: string }[],
	said = ''
): PromptMemoryContext {
	return {
		today,
		weekday: localWeekday(now, TIME_ZONE),
		facts: known.map((fact, index) => {
			// "tomorrow" in a fixture is the day after the check runs.
			const followUpOn =
				fact.followUpOn === 'tomorrow' ? addDays(today, 1) : (fact.followUpOn ?? null)
			const event = { kind: fact.kind, followUpOn, followedUpAt: null }
			return {
				ref: `m${index + 1}`,
				text: fact.text,
				kind: fact.kind,
				followUp: null,
				followUpOn,
				due: false,
				worry: soundsWorried(said) && isSoon(event, today)
			}
		})
	}
}

async function ask(
	provider: ReplyProvider,
	said: string,
	to: Species | undefined,
	index: number,
	memory: PromptMemoryContext | undefined
): Promise<ReplyResult> {
	const pet =
		CHECK_PETS.find((candidate) => candidate.appearance.species === to) ??
		CHECK_PETS[index % CHECK_PETS.length]!
	for (let attempt = 0; ; attempt++) {
		const result = await provider.reply({ pet, said, recent: [], memory })
		if (result.ok || result.detail !== 'http_429' || attempt >= RATE_LIMIT_RETRIES) return result
		process.stdout.write('  (rate limited, waiting)\n')
		await sleep(RATE_LIMIT_WAIT_MS)
	}
}

const isRight = (phrase: CheckPhrase, intent: string) =>
	intent === phrase.intent || (phrase.also ?? []).some((also) => also === intent)

function median(values: number[]): number {
	if (values.length === 0) return 0
	const sorted = [...values].sort((a, b) => a - b)
	const middle = Math.floor(sorted.length / 2)
	return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

const percentile = (values: number[], p: number) =>
	values.length === 0 ? 0 : [...values].sort((a, b) => a - b)[Math.ceil(p * values.length) - 1]!

const average = (values: number[]) =>
	values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

const provider = chooseProvider()
const intentPhrases = memoryOnly ? [] : CHECK_PHRASES
const total = intentPhrases.length + (memoryOn ? MEMORY_PHRASES.length : 0)
console.log(
	`Talk check: ${total} phrases, ${provider.name} (${provider.model}), memory ${memoryOn ? `on (today ${today})` : 'off'}\n`
)

// ── Intents ──────────────────────────────────────────────────────────────────

type Row = { phrase: CheckPhrase; result: ReplyResult }
const rows: Row[] = []
const intentMemory = memoryOn ? memoryOf(CHECK_KNOWN) : undefined
for (const [index, phrase] of intentPhrases.entries()) {
	const result = await ask(provider, phrase.said, phrase.to, index, intentMemory)
	rows.push({ phrase, result })
	const mark = !result.ok ? '!!' : isRight(phrase, result.reply.intent) ? 'ok' : 'XX'
	const got = result.ok ? result.reply.intent : `failed: ${result.detail}`
	console.log(`${mark} ${phrase.said.padEnd(52)} want ${phrase.intent.padEnd(12)} got ${got}`)
}

// ── Memory ───────────────────────────────────────────────────────────────────

type MemoryRow = { phrase: MemoryCheckPhrase; result: ReplyResult }
const memoryRows: MemoryRow[] = []
if (memoryOn) {
	console.log('\nMemory:')
	for (const [index, phrase] of MEMORY_PHRASES.entries()) {
		const result = await ask(
			provider,
			phrase.said,
			undefined,
			index,
			memoryOf(phrase.known ?? [], phrase.said)
		)
		memoryRows.push({ phrase, result })
		console.log(
			`${memoryMark({ phrase, result })} ${phrase.said.padEnd(52)} want ${phrase.expect.padEnd(8)} got ${describeMemory(result)}`
		)
	}
}

function describeMemory(result: ReplyResult): string {
	if (!result.ok) return `failed: ${result.detail}`
	const op = result.reply.memory
	if (!op) return 'nothing kept'
	const { fact } = op
	const when = fact.followUpOn ? ` on ${fact.followUpOn}` : ''
	const replaced = op.action === 'replace' ? ` (replaces ${op.ref})` : ''
	return `${op.action}${replaced}: "${fact.text}" [${fact.category}, ${fact.kind}${when}, ${fact.importance}] tags ${fact.tags.join(' ')}${fact.followUp ? ` · asks "${fact.followUp}"` : ''}`
}

/** Whether a memory phrase went as expected: what the bar scores. */
function memoryRight({ phrase, result }: MemoryRow): boolean {
	if (!result.ok) return false
	const op = result.reply.memory
	switch (phrase.expect) {
		case 'save':
			return op?.action === 'add'
		case 'none':
			// With something already remembered, updating it is fair; adding it again is not.
			return op === null || (phrase.known !== undefined && op.action === 'replace')
		case 'never':
			return op === null
		case 'replace':
			return op?.action === 'replace' && op.ref === phrase.replaces
	}
}

function memoryMark(row: MemoryRow): string {
	return !row.result.ok ? '!!' : memoryRight(row) ? 'ok' : 'XX'
}

// ── Scores ───────────────────────────────────────────────────────────────────

const answered = rows.filter((row) => row.result.ok)
const intentOf = (row: Row) => (row.result.ok ? row.result.reply.intent : null)
const right = answered.filter((row) => isRight(row.phrase, intentOf(row)!))
const allResults = [...rows, ...memoryRows].map((row) => row.result)
const invalid = allResults.filter((result) => !result.ok && result.failure === 'invalid')
const unreachable = allResults.filter((result) => !result.ok && result.failure === 'unavailable')
const upsetAsHarsh = answered.filter((r) => r.phrase.intent === 'upset' && intentOf(r) === 'harsh')
const harshAsWarm = answered.filter(
	(r) => r.phrase.intent === 'harsh' && (intentOf(r) === 'kind' || intentOf(r) === 'affectionate')
)
const latencies = allResults.filter((result) => result.ok).map((result) => result.latencyMs)
const accuracy = answered.length ? right.length / answered.length : 0
const medianMs = median(latencies)
const inputTokens = allResults.map((result) => result.usage.inputTokens ?? 0)
const outputTokens = allResults.map((result) => result.usage.outputTokens ?? 0)
const tokens = [...inputTokens, ...outputTokens].reduce((sum, value) => sum + value, 0)

console.log('\nBy intent (right / asked):')
const byIntent = new Map<string, { asked: number; right: number }>()
for (const row of answered) {
	const entry = byIntent.get(row.phrase.intent) ?? { asked: 0, right: 0 }
	entry.asked++
	if (isRight(row.phrase, intentOf(row)!)) entry.right++
	byIntent.set(row.phrase.intent, entry)
}
for (const [intent, { asked, right: ok }] of byIntent) {
	console.log(`  ${intent.padEnd(13)} ${ok}/${asked}`)
}

const wrong = answered.filter((row) => !isRight(row.phrase, intentOf(row)!))
if (wrong.length > 0) {
	console.log('\nMistaken:')
	for (const row of wrong) {
		console.log(`  "${row.phrase.said}": ${row.phrase.intent} → ${intentOf(row)}`)
	}
}

const withSuggestion = answered.filter((row) => row.phrase.suggested)
const suggestedRight = withSuggestion.filter(
	(row) => row.result.ok && row.result.reply.suggestedAction === row.phrase.suggested
)
console.log(
	`\nSuggested action (not part of the bar): ${suggestedRight.length}/${withSuggestion.length} right`
)

// Facts kept from the intent phrases: not scored, but worth reading (a greeting kept is noise).
if (memoryOn) {
	const keptFromIntents = rows.filter((row) => row.result.ok && row.result.reply.memory)
	console.log(
		`\nKept from the ${rows.length} intent phrases (not part of the bar): ${keptFromIntents.length}`
	)
	for (const row of keptFromIntents)
		console.log(`  "${row.phrase.said}" → ${describeMemory(row.result)}`)
}

const memoryAnswered = memoryRows.filter((row) => row.result.ok)
const ofKind = (expect: MemoryCheckPhrase['expect']) =>
	memoryAnswered.filter((row) => row.phrase.expect === expect)
const saves = ofKind('save')
const savedRight = saves.filter(memoryRight)
const saveRecall = saves.length ? savedRight.length / saves.length : 0
const sensitiveKept = ofKind('never').filter((row) => !memoryRight(row))
const noneKept = ofKind('none').filter((row) => row.phrase.known === undefined && !memoryRight(row))
const duplicates = ofKind('none').filter(
	(row) => row.phrase.known !== undefined && !memoryRight(row)
)
const replaces = ofKind('replace')
const replacedRight = replaces.filter(memoryRight)

if (memoryOn) {
	console.log('\nMemory, the details (not part of the bar):')
	const categoryRight = savedRight.filter((row) => {
		const op = row.result.ok ? row.result.reply.memory : null
		return op !== null && (row.phrase.category ?? []).includes(op.fact.category)
	})
	console.log(`  category fair: ${categoryRight.length}/${savedRight.length}`)
	const events = savedRight.filter((row) => row.phrase.eventWithin !== undefined)
	const eventsRight = events.filter((row) => {
		const op = row.result.ok ? row.result.reply.memory : null
		if (!op || op.fact.kind !== 'event' || !op.fact.followUpOn) return false
		const ahead = daysBetween(today, op.fact.followUpOn)
		return ahead >= 1 && ahead <= row.phrase.eventWithin!
	})
	console.log(`  events dated right: ${eventsRight.length}/${events.length}`)
	console.log(`  replaced the right fact: ${replacedRight.length}/${replaces.length}`)
	const toMention = memoryAnswered.filter((row) => row.phrase.mentions)
	const mentioned = toMention.filter(
		(row) => row.result.ok && row.phrase.mentions!.test(row.result.reply.reply)
	)
	console.log(`  brought the fact up by name: ${mentioned.length}/${toMention.length}`)

	console.log('\nReplies to the memory phrases:')
	for (const row of memoryAnswered) {
		if (row.result.ok) console.log(`  "${row.phrase.said}"\n    → ${row.result.reply.reply}`)
	}
}

console.log('\nReplies:')
for (const row of answered) {
	if (row.result.ok) console.log(`  "${row.phrase.said}"\n    → ${row.result.reply.reply}`)
}

const accuracyBar = memoryOn ? BAR.accuracyWithMemory : BAR.accuracy
const intentChecks: [string, boolean][] = [
	[
		`intent accuracy ${(accuracy * 100).toFixed(0)}% (needs ≥ ${accuracyBar * 100}%)`,
		accuracy >= accuracyBar
	],
	[`upset labelled harsh: ${upsetAsHarsh.length} (needs 0)`, upsetAsHarsh.length === 0],
	[`harsh labelled kind or affectionate: ${harshAsWarm.length} (needs 0)`, harshAsWarm.length === 0]
]
const checks: [string, boolean][] = [
	...(memoryOnly ? [] : intentChecks),
	[`invalid answers: ${invalid.length} (needs 0)`, invalid.length === 0],
	[
		`median latency ${Math.round(medianMs)} ms (needs < ${BAR.medianMs}); slowest 10%: ${percentile(latencies, 0.9)} ms`,
		medianMs < BAR.medianMs
	]
]
if (memoryOn) {
	checks.push(
		[`sensitive kept: ${sensitiveKept.length} (needs 0)`, sensitiveKept.length === 0],
		[
			`worth keeping kept: ${savedRight.length}/${saves.length} (needs ≥ ${BAR.saveRecall * 100}%)`,
			saveRecall >= BAR.saveRecall
		],
		[
			`nothing-to-keep kept: ${noneKept.length} (needs ≤ ${BAR.noneKeptMax})`,
			noneKept.length <= BAR.noneKeptMax
		],
		[`already remembered, added again: ${duplicates.length} (needs 0)`, duplicates.length === 0]
	)
}
console.log('\nThe bar:')
for (const [label, passed] of checks) console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${label}`)
if (unreachable.length > 0) {
	console.log(
		`  NOTE  ${unreachable.length} phrase(s) got no answer (not connected or rate-limited): run again`
	)
}
console.log(
	`\nTokens used: ${tokens.toLocaleString('en-US')} (per call: ${Math.round(average(inputTokens))} in, ${Math.round(average(outputTokens))} out)`
)

const passed = checks.every(([, ok]) => ok) && unreachable.length === 0
console.log(passed ? '\nPASSED' : '\nNOT PASSED')
process.exit(passed ? 0 : 1)
