/**
 * What the pet says in its daily notes (docs/application/features/v2-notifications-requirements.md,
 * R9–R11; the full bank is in the screen spec, "Notes from Mochi"). The title is the pet's name and
 * the body is one of these, in the pet's voice, from the need that sent the note. Day 1 notices;
 * days 2 and 3 miss you a little more, never with guilt: no starving, crying or "you forgot me".
 *
 * `{you}` is the first word of the person's name, as a friend would say it: a line with it is used
 * only when the name is set and that word is short. Every line fits a lock screen's two lines.
 */
import { NEEDS, SPECIES, type Need, type Species } from '@app/contract'
import type { NudgeDay } from '@/lib/nudge'

type Line = string | Record<Species, string>

type Tier = 'first' | 'later'

const LINES: Record<Need, Record<Tier, readonly Line[]>> = {
	hunger: {
		first: [
			'My bowl is looking very empty. Just saying.',
			{
				cat: "I've been staring at my bowl. It hasn't filled itself.",
				dog: "I've checked my bowl four times. Still empty."
			},
			"{you}, is it snack o'clock? Asking for me."
		],
		later: [
			'Saved you a seat at dinner. Mostly for me.',
			'Still dreaming about snacks. And you. Mostly you.',
			'{you}, my tummy says hi. So do I.'
		]
	},
	happiness: {
		first: [
			"It's a bit quiet here. Want to play?",
			{
				cat: 'I found a very good string. It needs two.',
				dog: 'I found the best stick. It needs two.'
			},
			"{you}, I've got a game idea. Come see?"
		],
		later: [
			"I'm saving my best game for when you're back.",
			'Still here, still hoping for a game.',
			'{you}, I practised a new trick for you.'
		]
	},
	energy: {
		first: [
			'Feeling a little sleepy. Come tuck me in?',
			{
				cat: "Found a sunny spot for a nap. There's room for you.",
				dog: 'My bed is all fluffed up. Come see me before my nap?'
			},
			'{you}, I could use a cozy nap. Keep me company?'
		],
		later: [
			'Had a long nap. I dreamt about you.',
			{
				cat: 'Curled up and thinking of you.',
				dog: 'Curled up by the door, thinking of you.'
			},
			'{you}, I saved you half the blanket.'
		]
	},
	affection: {
		first: [
			'I saved you the warm spot.',
			'I keep thinking about you. Come say hi?',
			"{you}! I missed you. That's all."
		],
		later: [
			'Still keeping your spot warm.',
			"No rush. I'll be right here when you're back.",
			'Thinking of you, {you}.'
		]
	}
}

export type NoteLine = {
	title: string
	body: string
	/** Which line it was, kept with the schedule so the next note picks another (R11). */
	key: string
}

export type NoteNames = {
	pet: string
	/** The person's display name, when set. */
	you?: string | null
}

const YOU = '{you}'
/** A first name longer than this reads as a handle, not a name: those notes leave it out. */
export const NOTE_NAME_MAX = 20

/** What `{you}` becomes: the first word of the person's name, or null. */
export function noteName(displayName: string | null | undefined): string | null {
	const first = displayName?.trim().split(/\s+/)[0] ?? ''
	return first.length > 0 && first.length <= NOTE_NAME_MAX ? first : null
}

/**
 * The note for a need, species and day. Lines with `{you}` are skipped without a name; the line
 * after `lastKey` among the rest is picked, so the same line never comes twice in a row.
 */
export function pickLine(
	need: Need,
	species: Species,
	day: NudgeDay,
	names: NoteNames,
	lastKey: string | null
): NoteLine {
	const tier: Tier = day === 1 ? 'first' : 'later'
	const you = noteName(names.you)
	const candidates = LINES[need][tier]
		.map((line, index) => ({
			key: `${need}.${tier}.${index}`,
			text: typeof line === 'string' ? line : line[species]
		}))
		.filter(({ text }) => you != null || !text.includes(YOU))
	const last = candidates.findIndex(({ key }) => key === lastKey)
	const chosen = candidates[(last + 1) % candidates.length]
	return {
		title: names.pet,
		body: you == null ? chosen.text : chosen.text.replace(YOU, you),
		key: chosen.key
	}
}

/** Every line in the bank, for the tests and the screen spec. */
export function allLines(): { key: string; species: Species; text: string }[] {
	const out: { key: string; species: Species; text: string }[] = []
	for (const need of NEEDS) {
		for (const tier of ['first', 'later'] as const) {
			LINES[need][tier].forEach((line, index) => {
				for (const species of SPECIES) {
					out.push({
						key: `${need}.${tier}.${index}`,
						species,
						text: typeof line === 'string' ? line : line[species]
					})
				}
			})
		}
	}
	return out
}
