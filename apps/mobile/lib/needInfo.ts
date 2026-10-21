import {
	ACTION_GAIN,
	DECAY_PER_HOUR,
	FULL_HUNGER,
	LOW_NEED,
	NIGHT_ENDS,
	NIGHT_SLOWDOWN,
	NIGHT_STARTS,
	PLAY_ENERGY_COST,
	SIDE_HAPPINESS,
	SLEEP_ENERGY_PER_HOUR,
	TALK_DAILY_CAP,
	TALK_EFFECTS,
	TALK_FLOOR,
	TOO_SLEEPY_TO_PLAY,
	type Need
} from '@app/contract'

/**
 * What the need sheet on Home says about each need (the spec, "Home" → "Need sheet"): what it
 * is, what lowers it, what raises it, in plain words with the numbers that help you plan. Every
 * number comes from the rules in @app/contract, so the sheet can't drift from the game.
 */

export type NeedLine = { kind: 'down' | 'up' | 'note'; text: string }
export type NeedInfo = { title: string; about: string; lines: NeedLine[] }

const TITLE: Record<Need, string> = {
	hunger: 'Hunger',
	happiness: 'Happiness',
	energy: 'Energy',
	affection: 'Affection'
}

/** "+30", "−8": a change as the pills float it, with a real minus sign. */
export function signed(n: number): string {
	return n >= 0 ? `+${n}` : `−${Math.abs(n)}`
}

/** 23 → "11pm", 7 → "7am", 0 → "midnight". */
export function hourLabel(hour: number): string {
	if (hour === 0) return 'midnight'
	if (hour === 12) return 'noon'
	return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

/** "about 12 every hour, 3 while asleep": a day rate and its night share. */
function dropsLine(need: Exclude<Need, 'energy'>): string {
	const night = DECAY_PER_HOUR[need] * NIGHT_SLOWDOWN
	return `Drops about ${DECAY_PER_HOUR[need]} every hour, ${roughly(night)} while asleep.`
}

/** 2.25 → "2", 1.75 → "2", 3 → "3": "about" numbers, whole. */
function roughly(n: number): string {
	return String(Math.max(1, Math.round(n)))
}

/** "Feed: up to +40, less the fuller it is." */
function upToLine(label: string, base: number): string {
	return `${label}: up to ${signed(base)}, less the fuller it is.`
}

export function needInfo(need: Need, name: string): NeedInfo {
	const low: NeedLine = {
		kind: 'note',
		text: `Below ${LOW_NEED} it's low, and ${name} will let you know.`
	}
	switch (need) {
		case 'hunger':
			return {
				title: TITLE.hunger,
				about: `How full ${name}'s tummy is.`,
				lines: [
					{ kind: 'down', text: dropsLine('hunger') },
					{
						kind: 'up',
						text: `${upToLine('Feed', ACTION_GAIN.feed.base)} Nothing at ${FULL_HUNGER} or more: too full to eat.`
					},
					{ kind: 'note', text: `Talking doesn't change it.` },
					low
				]
			}
		case 'happiness':
			return {
				title: TITLE.happiness,
				about: `How cheerful ${name} feels.`,
				lines: [
					{ kind: 'down', text: dropsLine('happiness') },
					{
						kind: 'down',
						text: `Harsh words: ${signed(TALK_EFFECTS.harsh.happiness)}, but words never take it below ${TALK_FLOOR}.`
					},
					{ kind: 'up', text: upToLine('Play', ACTION_GAIN.play.base) },
					{
						kind: 'up',
						text: `Feed and Pet: up to ${signed(SIDE_HAPPINESS)} each. Kind, playful and loving words: up to ${signed(TALK_DAILY_CAP.happiness)} a day.`
					},
					low
				]
			}
		case 'energy':
			return {
				title: TITLE.energy,
				about: `How rested ${name} is.`,
				lines: [
					{
						kind: 'down',
						text: `Drops about ${DECAY_PER_HOUR.energy} every hour in the day. Play: ${signed(-PLAY_ENERGY_COST)}.`
					},
					{
						kind: 'up',
						text: `${name} sleeps from ${hourLabel(NIGHT_STARTS)} to ${hourLabel(NIGHT_ENDS)}, your time, and gets back about ${SLEEP_ENERGY_PER_HOUR} every hour.`
					},
					{
						kind: 'note',
						text: `Below ${TOO_SLEEPY_TO_PLAY}, too sleepy to play. Talking doesn't change it.`
					},
					low
				]
			}
		case 'affection':
			return {
				title: TITLE.affection,
				about: `How close ${name} feels to you.`,
				lines: [
					{ kind: 'down', text: dropsLine('affection') },
					{ kind: 'up', text: upToLine('Pet', ACTION_GAIN.pet.base) },
					{
						kind: 'up',
						text: `Kind and loving words, and saying sorry: up to ${signed(TALK_DAILY_CAP.affection)} a day.`
					},
					low
				]
			}
	}
}
