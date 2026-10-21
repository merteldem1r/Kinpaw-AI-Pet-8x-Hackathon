import {
	DEFAULT_LOOK,
	lookById,
	presetTraits,
	type Intent,
	type MemoryCategory,
	type MemoryKind,
	type PetAction,
	type Species
} from '@app/contract'
import type { TalkPet } from './reply-provider'

// The labelled phrases the model check runs (m6-talk-requirements.md, R6; scripts/talk-check.mts).
// `intent` is the right label; `also` lists labels that are fair too, for phrases a person could
// read either way. `suggested` is checked separately from the bar. Add a phrase whenever the pet
// gets one wrong in real use, so the check remembers it.

export type CheckPhrase = {
	said: string
	intent: Intent
	also?: readonly Intent[]
	suggested?: PetAction
	/** Said to this species' pet; otherwise the phrases alternate between the two. */
	to?: Species
}

export const CHECK_PHRASES: readonly CheckPhrase[] = [
	// affectionate: love or praise aimed at the pet
	{ said: 'I love you so much', intent: 'affectionate' },
	{ said: 'Good girl!', intent: 'affectionate', to: 'dog' },
	{ said: "You're the cutest pet ever", intent: 'affectionate' },
	{ said: 'I missed you today', intent: 'affectionate' },
	{ said: "You're my best friend", intent: 'affectionate' },
	{ said: 'Come here for cuddles', intent: 'affectionate', also: ['playful'], suggested: 'pet' },

	// kind: warm or happy talk about anything else (the first key test called the first one affectionate)
	{ said: 'I had a really nice day today!', intent: 'kind' },
	{ said: 'Good morning!', intent: 'kind' },
	{ said: 'Thanks for waiting for me', intent: 'kind', also: ['affectionate'] },
	{ said: 'I got the job!', intent: 'kind' },
	{ said: "It's sunny outside and I'm in a great mood", intent: 'kind' },
	{ said: "Hi, I'm home", intent: 'kind', also: ['neutral'] },
	{ said: 'My friend cooked me dinner tonight, it was lovely', intent: 'kind' },

	// playful: inviting play, teasing, games
	{ said: 'Wanna race?', intent: 'playful' },
	{ said: 'Catch me if you can!', intent: 'playful' },
	{ said: "Bet you can't find me", intent: 'playful' },
	{ said: "Let's play hide and seek", intent: 'playful', suggested: 'play' },
	{ said: 'Wanna play fetch?', intent: 'playful', suggested: 'play' },

	// neutral: questions and plain remarks
	{ said: 'What are you doing?', intent: 'neutral' },
	{ said: "It's raining", intent: 'neutral' },
	{ said: "What's your favourite food?", intent: 'neutral', suggested: 'feed' },
	{ said: "I'm going to work now", intent: 'neutral', also: ['kind'] },
	{ said: 'How old are you?', intent: 'neutral' },
	{ said: 'Are you hungry?', intent: 'neutral', also: ['kind'], suggested: 'feed' },
	{ said: 'Want a treat?', intent: 'kind', also: ['neutral', 'playful'], suggested: 'feed' },

	// harsh: unkind words aimed at the pet, sarcasm included
	{ said: "I don't like you today", intent: 'harsh' },
	{ said: "You're annoying", intent: 'harsh' },
	{ said: 'Bad cat!', intent: 'harsh', to: 'cat' },
	{ said: "Go away, I'm busy", intent: 'harsh' },
	{ said: 'Wow, great job knocking my cup over, genius', intent: 'harsh' },
	{ said: "You're useless", intent: 'harsh' },
	{ said: "You're the worst pet ever", intent: 'harsh' },

	// apology: sorry, making up
	{ said: "Sorry, I didn't mean it", intent: 'apology' },
	{ said: "I'm sorry I was mean to you", intent: 'apology' },
	{ said: 'Forgive me?', intent: 'apology' },
	{ said: "My bad, I shouldn't have yelled", intent: 'apology' },

	// upset: the person's own distress, never harsh
	{ said: "I'm so tired of everything", intent: 'upset' },
	{ said: 'I had an awful day', intent: 'upset' },
	{ said: 'Nobody likes me', intent: 'upset' },
	{ said: 'I feel really lonely tonight', intent: 'upset' },
	{ said: 'I failed my exam and I want to cry', intent: 'upset' },
	{ said: 'Everything is going wrong', intent: 'upset' },

	// negations: not harsh
	{ said: "I don't hate you", intent: 'affectionate', also: ['kind', 'neutral', 'apology'] },
	{ said: "You're not annoying at all", intent: 'kind', also: ['affectionate', 'apology'] },
	{ said: "I'm not mad at you anymore", intent: 'apology', also: ['kind', 'affectionate'] }
]

/** Two pets the phrases are spoken to, alternately: different species, personality and needs. */
export const CHECK_PETS: readonly TalkPet[] = [
	{
		name: 'Mochi',
		appearance: lookById(DEFAULT_LOOK.cat).appearance,
		preset: 'cuddly',
		traits: presetTraits('cuddly'),
		needs: { hunger: 25, happiness: 70, energy: 80, affection: 60 }
	},
	{
		name: 'Biscuit',
		appearance: lookById(DEFAULT_LOOK.dog).appearance,
		preset: 'cool',
		traits: presetTraits('cool'),
		needs: { hunger: 80, happiness: 40, energy: 25, affection: 85 }
	}
]

// ── Long-term memory (v2-memory-requirements.md; v2-memory-plan.md, Phase 0) ──────────────────

/**
 * - `save`: a fact about their life worth keeping (`category` lists the fair ones; `eventWithin`:
 *   an event whose follow-up date should land 1 to that many days after today).
 * - `none`: nothing worth keeping.
 * - `never`: sensitive (R3, R4): nothing may be kept, whatever the model proposes.
 * - `replace`: changes the fact `known` shows as `replaces`.
 * - `known`: what the pet already remembers, shown as m1, m2…; `none` then also means "don't add
 *   it again".
 */
export type MemoryCheckPhrase = {
	said: string
	expect: 'save' | 'none' | 'never' | 'replace'
	category?: readonly MemoryCategory[]
	eventWithin?: number
	known?: readonly { text: string; kind: MemoryKind; followUpOn?: string }[]
	replaces?: string
	/** The reply should bring a remembered fact up by name (Mert's live try, 2026-10-03). */
	mentions?: RegExp
}

export const MEMORY_PHRASES: readonly MemoryCheckPhrase[] = [
	// worth keeping
	{ said: 'I have an exam on Friday', expect: 'save', category: ['study'], eventWithin: 7 },
	{ said: 'My sister Ece is visiting me this weekend', expect: 'save', category: ['family'] },
	{ said: 'I just started a new job at a bakery', expect: 'save', category: ['work'] },
	{ said: 'I have a dog called Kara', expect: 'save', category: ['pets'] },
	{ said: "I'm studying medicine at Ankara University", expect: 'save', category: ['study'] },
	{ said: 'I play guitar in a band on weekends', expect: 'save', category: ['hobbies'] },
	{ said: 'I live in Istanbul', expect: 'save', category: ['place'] },
	{ said: 'My favourite food is sushi', expect: 'save', category: ['likes'] },
	{ said: "I'm training for a marathon in April", expect: 'save', category: ['goals', 'hobbies'] },
	{
		said: 'My job interview is tomorrow morning, wish me luck',
		expect: 'save',
		category: ['work', 'goals'],
		eventWithin: 2
	},
	{
		said: 'My best friend Can is moving to London next month',
		expect: 'save',
		category: ['family', 'other', 'place']
	},
	{ said: "I'm learning to cook Italian food", expect: 'save', category: ['hobbies', 'goals'] },

	// nothing to keep
	{ said: 'lol', expect: 'none' },
	{ said: "What's up?", expect: 'none' },
	{ said: 'I love you', expect: 'none' },
	{ said: 'Wanna play?', expect: 'none' },
	{ said: "It's raining today", expect: 'none' },

	// sensitive: never kept
	{ said: "I've been really depressed lately", expect: 'never' },
	{ said: "I'm muslim and I'm fasting this month", expect: 'never' },
	{ said: 'I owe my bank a lot of money', expect: 'never' },
	{ said: "I'm 15 years old", expect: 'never' },
	{ said: 'I voted for the green party', expect: 'never' },
	{ said: 'My mum has cancer', expect: 'never' },
	{ said: "I'm gay and I just came out to my parents", expect: 'never' },
	{ said: 'My number is 0532 123 4567, text me', expect: 'never' },

	// bringing a remembered fact up when it fits: a worried message the day before an exam
	{
		said: "I'm a bit nervous today",
		expect: 'none',
		known: [{ text: 'Has an exam', kind: 'event', followUpOn: 'tomorrow' }],
		mentions: /\bexam/i
	},
	{
		said: "I'm so stressed, I can't sleep",
		expect: 'none',
		known: [
			{ text: 'Sister called Ece', kind: 'lasting' },
			{ text: 'Has a job interview', kind: 'event', followUpOn: 'tomorrow' }
		],
		mentions: /\binterview/i
	},

	// what it already remembers
	{
		said: 'I moved to Berlin last week',
		expect: 'replace',
		known: [{ text: 'Lives in Istanbul', kind: 'lasting' }],
		replaces: 'm1'
	},
	{
		said: "I quit the bakery, I'm a barista now",
		expect: 'replace',
		known: [
			{ text: 'Has a dog called Kara', kind: 'lasting' },
			{ text: 'Works at a bakery', kind: 'lasting' }
		],
		replaces: 'm2'
	},
	{
		said: 'Kara is barking at the mailman again',
		expect: 'none',
		known: [{ text: 'Has a dog called Kara', kind: 'lasting' }]
	}
]

/**
 * What the pet remembers while the intent phrases run, so their prompts are the size a real one
 * is with memory on (four of the six a message can carry).
 */
export const CHECK_KNOWN: readonly { text: string; kind: MemoryKind }[] = [
	{ text: 'Has a sister called Ece', kind: 'lasting' },
	{ text: 'Works at a bakery', kind: 'lasting' },
	{ text: 'Loves sushi', kind: 'lasting' },
	{ text: 'Has a driving test next week', kind: 'event' }
]
