import {
	checkFact,
	type Intent,
	type MemoryCategory,
	type NewMemory,
	type PetAction,
	saysUnder13,
	type Species
} from '@app/contract'
import { introFacts } from './intro-schema'
import type {
	IntroRequest,
	IntroResult,
	MemoryOp,
	ReplyProvider,
	ReplyRequest,
	ReplyResult
} from './reply-provider'
import { NO_USAGE } from './reply-provider'

// A pretend pet for tests, CI and development without a key (m6-talk-requirements.md, R1–R2):
// keyword rules pick the intent and a canned, in-character reply. It never fails and never
// leaves the machine. Not a model: good enough to build and demo every screen, not to judge one.

const RULES: readonly { intent: Intent; words: RegExp }[] = [
	{ intent: 'apology', words: /\b(sorry|apologi[sz]e|didn'?t mean)\b/i },
	{ intent: 'upset', words: /\b(sad|tired of|awful|lonely|stressed|nobody|cry|hurt(ing)?)\b/i },
	{
		intent: 'harsh',
		words: /\b(hate|annoying|don'?t like you|bad (cat|dog|boy|girl)|stupid|ugly)\b/i
	},
	{
		intent: 'affectionate',
		words: /\b(love you|good (boy|girl|kitty|pup)|cutest|missed you|adore)\b/i
	},
	{ intent: 'playful', words: /\b(play|race|catch|game|chase|hide|fetch)\b/i },
	{
		intent: 'kind',
		words: /\b(nice|great|good (day|morning|night)|thanks?|thank you|happy|hello|hi)\b/i
	}
]

/** "I don't hate you" is not harsh: a negation right before the harsh word cancels it. */
const NEGATED_HARSH = /\b(don'?t|do not|never|not)\s+(hate|dislike|annoying|mad)\b/i

const REPLIES: Record<Intent, Record<Species, readonly string[]>> = {
	affectionate: {
		cat: [
			'I love you too. Obviously. Now scratch my chin.',
			"You're my favourite human. Don't let it go to your head."
		],
		dog: [
			'I love you SO much! My tail is going wild!',
			"You're the best person in the whole world. I checked."
		]
	},
	kind: {
		cat: [
			"That's lovely. Tell me more while I sit on your hand.",
			'Mm, good. I approve of good days.'
		],
		dog: [
			'Yay! Good days are the best days! Tell me everything!',
			"That makes me so happy! Let's celebrate with a snack?"
		]
	},
	playful: {
		cat: [
			'Oh, it is ON. I will pounce from under the couch.',
			"Ready when you are. I'm already crouching."
		],
		dog: ["YES! Let's go! I'm already running in circles!", 'Throw it! Throw it! Throw it!']
	},
	neutral: {
		cat: [
			'Just watching a very suspicious dust bunny. You?',
			"Thinking about naps. It's a full-time job."
		],
		dog: [
			'Sniffing things! Lots of things! What are you doing?',
			"Waiting for you, mostly. It's my favourite thing."
		]
	},
	harsh: {
		cat: [
			"Hmph. That stung a little. I'll forgive you after a treat.",
			"Well. I'm sitting with my back to you now. Briefly."
		],
		dog: [
			'Oh... okay. I still love you, though. Always.',
			"That made my ears droop. But I'm still here for you."
		]
	},
	apology: {
		cat: [
			"Fine. You're forgiven. Mostly. Chin scratches seal it.",
			"Apology accepted. I've already forgotten. Almost."
		],
		dog: [
			"It's okay! I forgive you! I already forgot! Hug?",
			'All better! I could never stay sad at you.'
		]
	},
	upset: {
		cat: [
			"Come here. I'll sit on you until it feels a little better.",
			"That sounds hard. I'm right here, purring at you."
		],
		dog: [
			"I'm right here. Let me lean on you for a while.",
			"That sounds really hard. I'm not going anywhere."
		]
	}
}

const SUGGESTIONS: readonly { action: PetAction; words: RegExp }[] = [
	{ action: 'feed', words: /\b(food|hungry|eat|dinner|treat|snack|breakfast)\b/i },
	{ action: 'play', words: /\b(play|game|fetch|race|chase)\b/i },
	{ action: 'pet', words: /\b(cuddle|pet|scratch|hug|snuggle)\b/i }
]

export function stubIntent(said: string): Intent {
	for (const { intent, words } of RULES) {
		if (intent === 'harsh' && NEGATED_HARSH.test(said)) continue
		if (words.test(said)) return intent
	}
	return 'neutral'
}

/**
 * With memory on, "remember that I have a dog called Kara" keeps "I have a dog called Kara" as a
 * lasting fact, through the same checks as the model's (v2-memory-requirements.md, R13), so
 * tests and development exercise saving without a model. Anything else keeps nothing.
 */
const REMEMBER = /\bremember (?:that )?(.+)$/i

export function stubMemory(said: string, memory: ReplyRequest['memory']): MemoryOp | null {
	const match = memory ? REMEMBER.exec(said.trim()) : null
	if (!memory || !match || saysUnder13(said)) return null
	const text = match[1]!.replace(/[.!?]+$/, '')
	const tags = text
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((word) => word.length > 3)
		.slice(0, 4)
	const fact = checkFact(
		{
			text: text.charAt(0).toUpperCase() + text.slice(1),
			follow_up: '',
			category: 'other',
			kind: 'lasting',
			importance: 1,
			tags,
			follow_up_on: ''
		},
		memory.today
	)
	return fact ? { action: 'add', fact } : null
}

/**
 * The intro without a model: plain first-person sentences become facts ("I have a dog called
 * Kara" keeps "Has a dog called Kara", "my name is Ece" keeps "Goes by Ece"), through the same
 * checks as the model's. Anything else keeps nothing.
 */
const INTRO_VERBS: readonly { said: RegExp; verb: string; category: MemoryCategory }[] = [
	{ said: /^(?:my name is|i'?m called|call me) (.+)$/i, verb: 'Goes by', category: 'other' },
	{ said: /^i have (.+)$/i, verb: 'Has', category: 'other' },
	{ said: /^i study (.+)$/i, verb: 'Studies', category: 'study' },
	{ said: /^i work (.+)$/i, verb: 'Works', category: 'work' },
	{ said: /^i live (.+)$/i, verb: 'Lives', category: 'place' },
	{ said: /^i (?:like|love) (.+)$/i, verb: 'Likes', category: 'likes' },
	{ said: /^i play (.+)$/i, verb: 'Plays', category: 'hobbies' }
]

export function stubIntroFacts(said: string, today: string): NewMemory[] {
	const proposed = said
		.split(/[.!?;,]+|\band\b/i)
		.map((clause) => clause.trim())
		.flatMap((clause) => {
			const rule = INTRO_VERBS.find(({ said: pattern }) => pattern.test(clause))
			if (!rule) return []
			const rest = rule.said.exec(clause)![1]!
			const tags = rest
				.toLowerCase()
				.split(/[^\p{L}\p{N}]+/u)
				.filter((word) => word.length > 2)
				.slice(0, 4)
			const category = /\b(dog|cat|puppy|kitten|pet)\b/i.test(rest) ? 'pets' : rule.category
			return [
				{
					text: `${rule.verb} ${rest}`,
					follow_up: '',
					category,
					kind: 'lasting',
					importance: category === 'pets' ? 2 : 1,
					tags,
					follow_up_on: ''
				}
			]
		})
	return introFacts(proposed, said, today)
}

export function createStubProvider(): ReplyProvider {
	async function reply({ pet, said, memory }: ReplyRequest): Promise<ReplyResult> {
		const intent = stubIntent(said)
		const lines = REPLIES[intent][pet.appearance.species]
		return {
			ok: true,
			reply: {
				reply: lines[said.length % lines.length]!,
				intent,
				suggestedAction: SUGGESTIONS.find(({ words }) => words.test(said))?.action ?? null,
				memory: stubMemory(said, memory)
			},
			usage: NO_USAGE,
			latencyMs: 0
		}
	}
	async function intro({ pet, said, today }: IntroRequest): Promise<IntroResult> {
		const facts = stubIntroFacts(said, today)
		const line =
			pet.appearance.species === 'cat'
				? 'Hmm, I like you already. I will remember all of that.'
				: "I'm so happy to know you! I'll remember everything!"
		return { ok: true, answer: { line, facts }, usage: NO_USAGE, latencyMs: 0 }
	}

	return { name: 'stub', model: 'stub', reply, intro }
}
