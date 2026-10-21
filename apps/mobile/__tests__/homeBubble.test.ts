/**
 * Home's bubble (kinpaw-screen-spec-v1.md, "Home" and "Talking (on Home)"): which line it shows,
 * in priority order, and what sits under it.
 */
import { homeBubble, type HomeBubbleState } from '@/lib/homeBubble'
import { INTRO_OFFER_LINE, needsLine, TALK_LINES } from '@/lib/petLines'

const needs = { hunger: 80, happiness: 80, energy: 80, affection: 80 }

const state = (over: Partial<HomeBubbleState> = {}): HomeBubbleState => ({
	name: 'Mochi',
	species: 'cat',
	needs,
	talk: { status: 'idle' },
	said: null,
	greetingLine: null,
	offeringIntro: false,
	memoryNote: null,
	askingNotes: null,
	voicedLine: null,
	speakingReply: false,
	voiceComing: false,
	listening: false,
	...over
})

const note = { reply: 'How did the exam go?', factId: 'f1', kind: 'recalled' as const }
const ask = { line: 'Yum, thank you!', attempt: 1 as const }

describe('the line, first that applies', () => {
	it('is the needs line when nothing else is going on', () => {
		const bubble = homeBubble(state())
		expect(bubble.line).toBe(needsLine(needs, 'cat'))
		expect(bubble.action).toBeNull()
	})

	it('is "I missed you" over the needs line', () => {
		expect(homeBubble(state({ greetingLine: 'You came back!' })).line).toBe('You came back!')
	})

	it('is the intro offer over "I missed you", with its button', () => {
		const bubble = homeBubble(state({ greetingLine: 'You came back!', offeringIntro: true }))
		expect(bubble.line).toBe(INTRO_OFFER_LINE)
		expect(bubble.action).toEqual({ kind: 'intro' })
	})

	it('is what the pet just said over the offer, which then waits', () => {
		const bubble = homeBubble(state({ offeringIntro: true, said: 'Purr.' }))
		expect(bubble.line).toBe('Purr.')
		expect(bubble.action).toBeNull()
	})

	it('is why a message failed over everything, with Try again', () => {
		const failed = homeBubble(
			state({
				said: 'Purr.',
				offeringIntro: true,
				talk: { status: 'failed', words: 'hi', failure: 'dozed_off' }
			})
		)
		expect(failed.line).toBe(TALK_LINES.dozedOff('Mochi'))
		expect(failed.action).toEqual({ kind: 'retry' })

		const offline = homeBubble(
			state({ talk: { status: 'failed', words: 'hi', failure: 'not_connected' } })
		)
		expect(offline.line).toBe(TALK_LINES.notConnected)
	})

	it('shows typing paws while the pet thinks', () => {
		expect(homeBubble(state({ talk: { status: 'thinking', words: 'hi' } })).thinking).toBe(true)
		expect(homeBubble(state()).thinking).toBe(false)
	})
})

describe('what belongs to a line', () => {
	it('shows the memory note only while its reply is the line', () => {
		expect(homeBubble(state({ memoryNote: note, said: note.reply })).action).toEqual({
			kind: 'memory',
			note
		})
		expect(homeBubble(state({ memoryNote: note, said: 'Purr.' })).action).toBeNull()
		expect(
			homeBubble(
				state({ memoryNote: note, said: note.reply, talk: { status: 'thinking', words: 'x' } })
			).action
		).toBeNull()
	})

	it('shows the notes ask only under its care line, and never with a memory note', () => {
		expect(homeBubble(state({ askingNotes: ask, said: ask.line })).ask).toEqual(ask)
		expect(homeBubble(state({ askingNotes: ask, said: 'Purr.' })).ask).toBeNull()
		expect(
			homeBubble(
				state({
					askingNotes: ask,
					said: ask.line,
					memoryNote: { ...note, reply: ask.line }
				})
			).ask
		).toBeNull()
	})

	it('shows the voice only on the reply it was made for', () => {
		const reply = { said: 'Hello!', voicedLine: 'Hello!' }
		expect(homeBubble(state({ ...reply, speakingReply: true })).voice).toBe('speaking')
		expect(homeBubble(state({ ...reply, voiceComing: true })).voice).toBe('preparing')
		expect(homeBubble(state({ ...reply, voiceComing: true, listening: true })).voice).toBeNull()
		expect(
			homeBubble(state({ said: 'Purr.', voicedLine: 'Hello!', speakingReply: true })).voice
		).toBeNull()
		expect(homeBubble(state({ voicedLine: null, speakingReply: true })).voice).toBeNull()
	})
})
