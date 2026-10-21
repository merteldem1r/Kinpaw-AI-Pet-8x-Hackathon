import {
	isAllGood,
	lowestNeed,
	type Need,
	type Needs,
	type PetAction,
	type PresetId,
	type Species
} from '@app/contract'

/*
 * What the pets say on the landing page. Each line is the app's own, copied
 * from where the app keeps it, so the site never puts words in a pet's mouth
 * that the app would not say:
 *
 * - the care and need lines from apps/mobile/lib/petLines.ts (REACTIONS, CANT_HELP, BY_NEED)
 * - the voiced lines from apps/mobile/assets/voice/lines.json, whose recordings
 *   are copied to public/voice (re-copy them when a line changes there)
 *
 * The site cannot import the app's module (it reads the phone's clock and
 * notification code), so a line changed there is changed here by hand.
 */

/** Day 1 opens on a pet whose affection is low. */
export const MISSED_YOU_LINE = "You're back! I kept your spot warm."

/**
 * What Home says when nothing has just happened, from the lowest need (or the
 * all-good row): the narrator's header over the sky and the pet's bubble (the
 * app's BY_NEED).
 */
const BY_NEED: Record<
	Need | 'allGood',
	{ header: (name: string) => string; bubble: string | Record<Species, string> }
> = {
	affection: { header: (name) => `${name} missed you`, bubble: MISSED_YOU_LINE },
	hunger: {
		header: (name) => `${name}'s tummy is rumbling`,
		bubble: "Is it dinner o'clock? Asking for me."
	},
	energy: {
		header: (name) => `${name}'s getting sleepy`,
		bubble: 'Stay a minute? I am almost asleep.'
	},
	happiness: {
		header: (name) => `${name}'s a little bored`,
		bubble: "I've counted every dust bunny. Play with me?"
	},
	allGood: {
		header: (name) => `${name}'s happy you're here`,
		bubble: {
			cat: "Best evening ever. Don't tell the other cats.",
			dog: "Best evening ever. My tail won't stop."
		}
	}
}

function lineFor(needs: Needs) {
	return BY_NEED[isAllGood(needs) ? 'allGood' : lowestNeed(needs)]
}

/** The pet's bubble when nothing has just happened, as the app's `needsLine`. */
export function needsLine(needs: Needs, species: Species): string {
	const { bubble } = lineFor(needs)
	return typeof bubble === 'string' ? bubble : bubble[species]
}

/** The narrator's line over the sky, as the app's `headerLine`. */
export function headerLine(needs: Needs, name: string): string {
	return lineFor(needs).header(name)
}

const REACTIONS: Record<PetAction, readonly string[]> = {
	feed: ['Mmm. Crunchy. Thank you.', 'Best. Dinner. Ever.', 'You remembered the good kind!'],
	play: ['Again! Again!', 'I almost caught it. Almost.', "You're terrible at hiding. I love it."],
	pet: ['Mmm. Right there.', 'Okay. You can stay.', 'I purred so loud the neighbours heard.']
}

/** The `n`th reaction to an action, cycling through its lines. */
export function reactionLine(action: PetAction, n: number): string {
	const lines = REACTIONS[action]
	return lines[n % lines.length]!
}

/** What the pet says when an action can't help. Pet always helps. */
export const CANT_HELP: Record<Exclude<PetAction, 'pet'>, string> = {
	feed: "I couldn't eat another bite.",
	play: 'Too sleepy to play. Tomorrow?'
}

/** Each personality's own line, recorded in each of the eight voices. */
export const HELLO_LINES: Record<PresetId, string> = {
	cuddly: "Hi! I'm soft, sleepy and all yours.",
	curious: "Ooh, what's in there? Can I look?",
	cool: "Hey. I'm pretty chill. Mostly.",
	loyal: "Wherever you go, I'm coming too."
}

/** A voice's id: its file in public/voice, and the `voice` on `voice_sample_played`. */
export function voiceId(species: Species, preset: PresetId): string {
	return `${species}-${preset}`
}

/** The recording of a personality's line in one of the eight voices. */
export function helloClip(species: Species, preset: PresetId): string {
	return `/voice/${voiceId(species, preset)}-hello.m4a`
}

/*
 * The week's scripted talk (days 3 and 7). A replay, not a live reply: in the
 * app each answer is written by the model. The pet's two lines are recorded in
 * Mochi's voice by `npm run voice:site` into public/voice/site.
 */
export const WEEK_TALK = {
	said: 'I have my exam on Friday. A bit nervous.',
	reply: "Friday? You'll do great. I'll keep the warm spot ready for after.",
	replyClip: '/voice/site/day3-reply.m4a',
	fact: 'Has an exam on Friday',
	/** What the pet already knew, in the list the new fact joins: facts the app itself kept (public/app/remembers.webp). */
	known: ['Drinks coffee black', 'Has a sister named Ece'],
	missed: 'I missed you! How did the exam go?',
	missedClip: '/voice/site/day7-missed.m4a'
} as const

/** Mochi's voice: a cat, and the personality the week gives it. */
export const MOCHI_VOICE = { species: 'cat', preset: 'cuddly' } as const satisfies {
	species: Species
	preset: PresetId
}
