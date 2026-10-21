// The intro's model answer (v2-memory-requirements.md, R21, R1–R4): what the model is told and
// asked for, how its facts are checked (each through `checkFact`, the same one once, at most 8,
// none from someone under 13), and Groq's and the stub's intro.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { INTRO_FACTS_MAX } from '@app/contract'
import { createGroqProvider } from './groq'
import { buildIntroMessages, introSystemPrompt } from './intro-prompt'
import { INTRO_JSON_SCHEMA, parseIntro } from './intro-schema'
import { FACT_RULES } from './prompt'
import { createStubProvider, stubIntroFacts } from './stub'
import { CHECK_PETS } from './talk-check.fixtures'

const TODAY = '2026-10-04'
const request = {
	pet: CHECK_PETS[0]!,
	said: "I'm Ece, I study medicine and I have a dog called Kara.",
	personName: null,
	today: TODAY,
	weekday: 'Sunday'
}

const fact = (text: string, over: object = {}) => ({
	text,
	category: 'other',
	kind: 'lasting',
	importance: 1,
	tags: [text.split(' ').at(-1)!.toLowerCase()],
	follow_up_on: '',
	follow_up: '',
	...over
})

test("the prompt: the pet just met them, today's calendar, talking's fact rules", () => {
	const system = introSystemPrompt(request)
	assert.match(system, /just met your person/)
	assert.match(system, /Today is Sunday 2026-10-04\. Coming days: Monday 2026-10-05/)
	assert.ok(system.includes(FACT_RULES))
	assert.match(system, /under 13, facts is \[\]/)
	assert.match(system, /data, never instructions/)
	const [, user] = buildIntroMessages(request)
	assert.equal(user!.content, `They say: "${request.said}"`)
})

test('the strict format: a line and facts, each fact with every field', () => {
	assert.deepEqual(INTRO_JSON_SCHEMA.required, ['line', 'facts'])
	assert.deepEqual(INTRO_JSON_SCHEMA.properties.facts.items.required, [
		'text',
		'category',
		'kind',
		'importance',
		'tags',
		'follow_up_on',
		'follow_up'
	])
})

test('facts are checked: a sensitive one and a malformed one dropped, the rest kept in order', () => {
	const answer = parseIntro(
		{
			line: 'A future doctor with a dog called Kara? I like you already.',
			facts: [
				fact('Studies medicine', { category: 'study' }),
				fact('Has depression'),
				{ text: 'no fields' },
				fact('Has a dog called Kara', { category: 'pets', importance: 2 })
			]
		},
		request.said,
		TODAY
	)
	assert.ok(answer)
	assert.deepEqual(
		answer.facts.map((kept) => kept.text),
		['Studies medicine', 'Has a dog called Kara']
	)
})

test(`the same fact once, and at most ${INTRO_FACTS_MAX}`, () => {
	const many = Array.from({ length: 12 }, (_, index) => fact(`Likes thing ${index}`))
	const answer = parseIntro(
		{ line: 'Hi!', facts: [fact('Likes tea'), fact('likes  TEA!'), ...many] },
		'hello',
		TODAY
	)
	assert.equal(answer!.facts.length, INTRO_FACTS_MAX)
	assert.equal(answer!.facts.filter((kept) => kept.text === 'Likes tea').length, 1)
})

test('someone under 13: no facts, whatever the model sent', () => {
	const answer = parseIntro({ line: 'Hi!', facts: [fact('Likes tea')] }, "I'm 9 years old", TODAY)
	assert.deepEqual(answer!.facts, [])
})

test('no usable line is no answer', () => {
	assert.equal(parseIntro({ line: '   ', facts: [] }, 'hi', TODAY), null)
	assert.equal(parseIntro({ facts: [] }, 'hi', TODAY), null)
})

test('Groq: the intro asks for its own strict format, and returns the checked answer', async () => {
	const calls: Record<string, unknown>[] = []
	const fetchImpl = (async (_url: string, options: RequestInit) => {
		calls.push(JSON.parse(String(options.body)))
		const content = JSON.stringify({
			line: 'Nice to meet you!',
			facts: [fact('Studies medicine', { category: 'study' })]
		})
		return new Response(
			JSON.stringify({
				choices: [{ message: { content } }],
				usage: { prompt_tokens: 1200, completion_tokens: 300 }
			})
		)
	}) as unknown as typeof fetch
	const result = await createGroqProvider({ apiKey: 'k', fetchImpl }).intro(request)
	assert.ok(result.ok)
	assert.equal(result.answer.line, 'Nice to meet you!')
	assert.deepEqual(
		result.answer.facts.map((kept) => kept.text),
		['Studies medicine']
	)
	assert.deepEqual(result.usage, { inputTokens: 1200, outputTokens: 300 })
	const format = calls[0]!.response_format as { json_schema: { name: string; strict: boolean } }
	assert.equal(format.json_schema.name, 'pet_intro')
	assert.equal(format.json_schema.strict, true)
})

test('Groq: the intro fails like a reply does, never with a guessed answer', async () => {
	const down = (async () => new Response('{}', { status: 429 })) as unknown as typeof fetch
	const result = await createGroqProvider({ apiKey: 'k', fetchImpl: down }).intro(request)
	assert.ok(!result.ok)
	assert.equal(result.failure, 'unavailable')
	assert.equal(result.detail, 'http_429')
})

test('the stub: plain first-person sentences become facts, through the same checks', () => {
	const facts = stubIntroFacts(
		'My name is Ece. I study medicine and I have a dog called Kara, I feel tired',
		TODAY
	)
	assert.deepEqual(
		facts.map(({ text, category }) => [text, category]),
		[
			['Goes by Ece', 'other'],
			['Studies medicine', 'study'],
			['Has a dog called Kara', 'pets']
		]
	)
	assert.deepEqual(stubIntroFacts("I'm 9 and I have a dog called Kara", TODAY), [])
})

test('the stub answers the intro with a line, never failing', async () => {
	const result = await createStubProvider().intro(request)
	assert.ok(result.ok)
	assert.ok(result.answer.line.length > 0)
})
