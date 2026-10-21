/**
 * Everything Home says (docs/application/UI/kinpaw-screen-spec-v1.md, "Header
 * and bubble lines", "Needs" and "Home"). The narrator header and the pet's
 * bubble come from the lowest need, or the all-good row when every need is 70
 * or more; Feed, Play and Pet answer with their reaction lines. Cat and dog
 * differ where the spec says so. `{name}` is always the pet's name.
 */
import {
	isAllGood,
	lowestNeed,
	type AwayBucket,
	type Need,
	type Needs,
	type PetAction,
	type Species
} from '@app/contract'
import type { SkyPhase, Zone } from '@app/brand'
import { noteName } from '@/lib/notificationLines'
import { phaseAt } from '@/lib/sky'

type Line = { header: (name: string) => string; bubble: string | Record<Species, string> }

const BY_NEED: Record<Need | 'allGood', Line> = {
	affection: {
		header: (name) => `${name} missed you`,
		bubble: "You're back! I kept your spot warm."
	},
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

function lineFor(needs: Needs): Line {
	return BY_NEED[isAllGood(needs) ? 'allGood' : lowestNeed(needs)]
}

/** The narrator's line over the sky (serif). */
export function headerLine(needs: Needs, name: string): string {
	return lineFor(needs).header(name)
}

/** What the pet says in its bubble when nothing has just happened. */
export function needsLine(needs: Needs, species: Species): string {
	const { bubble } = lineFor(needs)
	return typeof bubble === 'string' ? bubble : bubble[species]
}

const REACTIONS: Record<PetAction, readonly (string | Record<Species, string>)[]> = {
	feed: ['Mmm. Crunchy. Thank you.', 'Best. Dinner. Ever.', 'You remembered the good kind!'],
	play: ['Again! Again!', 'I almost caught it. Almost.', "You're terrible at hiding. I love it."],
	pet: [
		'Mmm. Right there.',
		'Okay. You can stay.',
		{ cat: 'I purred so loud the neighbours heard.', dog: 'My whole back half is wagging.' }
	]
}

/** The `n`th reaction to an action, cycling through its lines. */
export function reactionLine(action: PetAction, species: Species, n: number): string {
	const lines = REACTIONS[action]
	const line = lines[n % lines.length]!
	return typeof line === 'string' ? line : line[species]
}

/** What the pet says when an action can't help. Pet always helps. */
export const CANT_HELP: Record<Exclude<PetAction, 'pet'>, string> = {
	feed: "I couldn't eat another bite.",
	play: 'Too sleepy to play. Tomorrow?'
}

export function cantHelpLine(action: PetAction, species: Species, n: number): string {
	return action === 'pet' ? reactionLine(action, species, n) : CANT_HELP[action]
}

const TAP_LINES = [
	'Hi. Hi. Hi.',
	"What? I'm just looking at you.",
	'You smell like outside.',
	'I was very good while you were gone.'
] as const

/** A random line for tapping the pet, never the one it just said. */
export function tapLine(previous: string | null, random: () => number = Math.random): string {
	const pool = TAP_LINES.filter((line) => line !== previous)
	return pool[Math.floor(random() * pool.length)]!
}

/**
 * What the pet says when it is touched somewhere other than its back (v3-pet-looks-
 * requirements.md, R7): each spot its own lines, a belly by species. Its back keeps TAP_LINES.
 */
const TOUCH_LINES: Record<Exclude<Zone, 'back'>, Record<Species, readonly string[]>> = {
	head: both(['Pat. Pat. Again.', 'My head is the best spot. Correct.', 'You can stay there.']),
	chin: both([
		'Oh. Oh, that spot.',
		'Higher. No, lower. There.',
		'Chin scratches are my love language.'
	]),
	nose: both(['Boop! ...Achoo.', 'Hey, that was my nose.', 'Boop me again. I dare you.']),
	ear: both(['That tickles!', 'Ears are for hearing you, you know.', 'Hehe. Flick.']),
	belly: {
		cat: [
			'Hehe. No. Hehe. Yes.',
			'This is a trap. You fell for it.',
			'Belly is for looking. Mostly.'
		],
		dog: ['Hehe! The belly!', 'Belly rubs! Finally!', 'Yes. Yes. This is my whole life now.']
	},
	paw: both(['High five!', 'Paw. For you.', 'We did it. Whatever it was.']),
	tail: both(['That is my tail. I need that.', 'Hey! I was using that.', 'My tail says hi.'])
}

function both(lines: readonly string[]): Record<Species, readonly string[]> {
	return { cat: lines, dog: lines }
}

/** A line for a tap on `zone`, never the one it just said; its back gets the hello lines. */
export function touchLine(
	zone: Zone,
	species: Species,
	previous: string | null,
	random: () => number = Math.random
): string {
	if (zone === 'back') return tapLine(previous, random)
	const pool = TOUCH_LINES[zone][species].filter((line) => line !== previous)
	return pool[Math.floor(random() * pool.length)]!
}

const STROKE_LINES: Record<Species, readonly string[]> = {
	cat: ['Prrrrrr.', 'Right there. Yes. There.', "Don't stop. Okay, you can stop. No, don't."],
	dog: ['Best. Human. Ever.', 'My leg is doing the thing!', 'More. Forever. Please.']
}

/** A chin scratch and a belly rub have their own; a stroke on the head or back the usual. */
const STROKE_LINES_ON: Record<'chin' | 'belly', Record<Species, readonly string[]>> = {
	chin: {
		cat: ['Prrr. Chin scratches. Prrr.', 'I am melting. Keep going.', 'This is the good spot.'],
		dog: ['My chin! You found it!', 'Oh, that is the spot.', 'Keep. Going. Please.']
	},
	belly: {
		cat: ['Okay. Only a little. Okay, a lot.', 'You may rub the belly. Today only.', 'Hehe. Hehe.'],
		dog: ['My leg is doing the thing!', 'Belly rub! Best day!', 'Do not stop. Ever.']
	}
}

/** What the pet says while it is being stroked, in turn, for where the stroke began. */
export function strokeLine(
	species: Species,
	n: number,
	zone: 'head' | 'chin' | 'belly' | 'back' = 'head'
): string {
	const lines =
		zone === 'chin' || zone === 'belly' ? STROKE_LINES_ON[zone][species] : STROKE_LINES[species]
	return lines[n % lines.length]!
}

const HUG_LINES = ['Squeeze. Mm.', 'I needed that.', "Don't let go yet."] as const

/** A line for a hug, never the one it just said. */
export function hugLine(previous: string | null, random: () => number = Math.random): string {
	const pool = HUG_LINES.filter((line) => line !== previous)
	return pool[Math.floor(random() * pool.length)]!
}

const IDLE_LINES = [
	'Psst. Still there?',
	"I'm doing nothing. Want to do nothing together?",
	"I counted the stars. You weren't here for it.",
	'Look at me. No, really look.'
] as const

/** A line for when nobody has touched anything for a while, never the one it just said. */
export function idleLine(previous: string | null, random: () => number = Math.random): string {
	const pool = IDLE_LINES.filter((line) => line !== previous)
	return pool[Math.floor(random() * pool.length)]!
}

/** What the pet says when its sun or moon is tapped (the spec's "Mochi's line on tap"). */
export const SKY_LINES: Record<SkyPhase, string> = {
	morning: "The sun's up. That means breakfast, right?",
	afternoon: 'Perfect nap weather. Just saying.',
	evening: "The sky's going orange. My favourite colour. Obviously.",
	night: "Don't tell anyone, but I talk to the moon."
}

export const ACTION_FAILED_LINE = 'Oops, I dropped it. Try again?'

/**
 * The pet's answer after it asks to send its notes (v2-notifications R13; the spec, "Notes from
 * Mochi"): yes and allowed, yes but iOS refused, and Not now. Never a guilt line.
 */
export const NOTES_LINES = {
	allowed: "Yay! I'll send you a note when I miss you.",
	refused: "That's okay. I'll keep your spot warm here.",
	notNow: 'Okay! Maybe another time.'
} as const

/** The question under the care reaction: from the person's side, as decided (R13). */
export const notesAsk = (name: string) => `Tell me when ${name} misses you?`

/**
 * What the bubble says when talking doesn't get a reply (the spec, "Talking (on Home)"). The
 * pet's own reply comes from the server; these are only for the moments it can't.
 */
export const TALK_LINES = {
	/** The reply failed or took too long. */
	dozedOff: (name: string) => `${name} dozed off mid-thought… try again?`,
	/** The pet's voice (the model) can't be reached right now. */
	notConnected: "I'm a bit sleepy… try again in a moment?",
	/** A free account with nothing left today. */
	talkedOut: "I'm all talked out for today. Let's talk more tomorrow?",
	/** The mic heard nothing: nothing was sent or counted. */
	nothingHeard: 'Hm? Say that again?',
	/** The phone couldn't listen at all (the recognizer failed): typing still works. */
	couldNotHear: "I couldn't hear you just now. Try again, or type?"
} as const

/**
 * The pet's voice for the day is used up (v2-voice R5: 5 voiced replies free, 20 with Plus):
 * said once a day, as a toast, so the reply stays in the bubble. Talking goes on in text.
 */
export const OUT_OF_VOICE_LINE = "I'm out of voice for today. I'll keep writing!"

export const errorLines = (name: string) => ({
	header: `Hmm, ${name}'s hiding`,
	title: `Couldn't reach ${name}`,
	body: `${name}'s fine, just out of sight. Check your connection and try again.`
})

const WEEKDAYS = [
	'Sunday',
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday'
] as const

/** Home's eyebrow: the weekday and the part of day, e.g. "Wednesday night". */
export function eyebrowLine(date: Date): string {
	return `${WEEKDAYS[date.getDay()]} ${phaseAt(date)}`
}

/**
 * Home's one-time offer of "Tell me about you" to a pet from before it (the spec, "Tell me about
 * you (v2)", Entry points); the bubble's row opens it.
 */
export const INTRO_OFFER_LINE = "I don't know much about you yet. Will you tell me?"

/**
 * "I missed you" (v2-memory-requirements.md, R26–R27): the bubble's first line after time away,
 * by how long (the server's bucket). Cozy, never guilt: it missed you, it never waited alone.
 * `{you}` is the person's first name, as in the notes (`noteName`); without one, those lines are
 * skipped. Under 6 hours there is no return line: Home as usual.
 */
const RETURN_LINES: Record<
	Exclude<AwayBucket, 'none'>,
	readonly (string | Record<Species, string>)[]
> = {
	'6-24h': [
		'There you are! I kept your spot warm.',
		{
			cat: "Oh, you're back. I wasn't watching the door. Much.",
			dog: "You're back! I heard your steps before you got here."
		},
		'{you}! I saved you the comfy side.'
	],
	'1-3d': [
		"You're back! I missed you. Not even pretending.",
		{
			cat: "Look who's here. I missed you. Don't tell anyone.",
			dog: "You're back! My tail hasn't stopped since I saw you."
		},
		'{you}! I missed you. Tell me everything?'
	],
	'3d+': [
		'You came back! I kept everything just how you left it.',
		{
			cat: 'There you are. I kept your spot warm the whole time.',
			dog: "You're home! I saved up all my wags for you."
		},
		"{you}! I missed you so much. I'm so happy you're here."
	]
}

/** Before a remembered event's question ("How did the exam go?"), by time away. */
const ASK_LEADS: Record<AwayBucket, { named: string; plain: string }> = {
	none: { named: 'Oh, {you}! ', plain: 'Oh, hi! ' },
	'6-24h': { named: "You're back, {you}! ", plain: "You're back! " },
	'1-3d': { named: 'I missed you, {you}! ', plain: 'I missed you! ' },
	'3d+': { named: 'You came back, {you}! ', plain: 'You came back! ' }
}

const YOU = '{you}'

/**
 * The pet's return line, or null when there is none (under 6 hours and nothing to ask). A due
 * question wins: it is the line that says "it remembered me". `displayName` is the profile's.
 */
export function returnLine(
	away: AwayBucket,
	question: string | null,
	species: Species,
	displayName: string | null | undefined,
	random: () => number = Math.random
): string | null {
	const you = noteName(displayName)
	if (question) {
		const lead = ASK_LEADS[away]
		return you ? lead.named.replace(YOU, you) + question : lead.plain + question
	}
	if (away === 'none') return null
	const pool = RETURN_LINES[away]
		.map((line) => (typeof line === 'string' ? line : line[species]))
		.filter((line) => you !== null || !line.includes(YOU))
	const line = pool[Math.floor(random() * pool.length)]!
	return you ? line.replace(YOU, you) : line
}
