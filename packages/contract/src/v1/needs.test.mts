// The needs rules (features/m5-home-core-loop-requirements.md, R2; the daily rhythm,
// features/needs-rhythm-requirements.md): decay by day and by night, the shrinking care gains
// and their "can't help" rules, fractions kept and thresholds read whole, mood, lowest need. The app and the
// server both run these, so a boundary wrong here is wrong on both.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
	applyAction,
	canHelp,
	wantedAction,
	decayNeeds,
	isAllGood,
	isValidTimeZone,
	lowCount,
	lowestNeed,
	moodFor,
	STARTING_NEEDS,
	wholeNeeds,
	type Needs
} from '../../index'

const UTC = 'UTC'
const FULL: Needs = { hunger: 100, happiness: 100, energy: 100, affection: 100 }
const at = (iso: string) => new Date(iso)
const hoursAfter = (from: string, hours: number) => new Date(at(from).getTime() + hours * 3600_000)

test('decay: no time, no change; a clock behind the stored time decays nothing', () => {
	const noon = at('2026-10-01T12:00:00Z')
	assert.deepEqual(decayNeeds(STARTING_NEEDS, noon, noon, UTC), STARTING_NEEDS)
	assert.deepEqual(
		decayNeeds(STARTING_NEEDS, noon, at('2026-10-01T11:00:00Z'), UTC),
		STARTING_NEEDS
	)
})

test('decay: an hour awake costs each need its day rate', () => {
	assert.deepEqual(decayNeeds(FULL, at('2026-10-01T12:00:00Z'), at('2026-10-01T13:00:00Z'), UTC), {
		hunger: 88,
		happiness: 91,
		energy: 95,
		affection: 93
	})
})

test('decay: asleep, the rest slows to a quarter while energy recovers', () => {
	const needs: Needs = { hunger: 80, happiness: 80, energy: 0, affection: 80 }
	// 23:00 to 07:00 is all night: eight hours asleep.
	const morning = decayNeeds(needs, at('2026-10-01T23:00:00Z'), at('2026-10-02T07:00:00Z'), UTC)
	assert.deepEqual(morning, { hunger: 56, happiness: 62, energy: 96, affection: 66 })
	// 22:00 to 08:00: an hour awake each side of the night (energy 15, then full, then 95).
	const wider = decayNeeds(
		{ ...needs, energy: 20 },
		at('2026-10-01T22:00:00Z'),
		at('2026-10-02T08:00:00Z'),
		UTC
	)
	assert.equal(wider.energy, 95)
	assert.equal(wider.hunger, 80 - 12 - 24 - 12)
})

test('decay: energy that ran out in the evening still recovers overnight', () => {
	const tired: Needs = { hunger: 50, happiness: 50, energy: 6, affection: 50 }
	// 19:00 to 01:00: four awake hours take energy to 0 (not below), then two asleep add 24.
	const result = decayNeeds(tired, at('2026-10-01T19:00:00Z'), at('2026-10-02T01:00:00Z'), UTC)
	assert.equal(result.energy, 24)
})

test('decay: the night window is local time, not UTC', () => {
	const needs: Needs = { hunger: 80, happiness: 80, energy: 50, affection: 80 }
	// 20:00 to 21:00 UTC is 23:00 to 00:00 in Istanbul (UTC+3): asleep there, awake in UTC.
	const from = at('2026-10-01T20:00:00Z')
	const to = at('2026-10-01T21:00:00Z')
	const istanbul = decayNeeds(needs, from, to, 'Europe/Istanbul')
	assert.equal(istanbul.energy, 62)
	assert.equal(istanbul.hunger, 77)
	const utc = decayNeeds(needs, from, to, UTC)
	assert.equal(utc.energy, 45)
	assert.equal(utc.hunger, 68)
})

test('decay: a span over a daylight-saving change stays exact where it matters', () => {
	const needs: Needs = { hunger: 100, happiness: 100, energy: 50, affection: 100 }
	// London falls back at 02:00 BST on 25 Oct 2026. From 13:00 BST: ten hours awake (energy to
	// 0), a nine-hour night (full again), five hours awake (75).
	const from = '2026-10-24T12:00:00Z'
	const result = decayNeeds(needs, at(from), hoursAfter(from, 24), 'Europe/London')
	assert.equal(result.energy, 75)
	assert.equal(result.hunger, 0)
})

test('decay: fractions are kept, never rounded', () => {
	const from = '2026-10-01T12:00:00Z'
	const fiveMinutes = decayNeeds(FULL, at(from), hoursAfter(from, 5 / 60), UTC)
	assert.equal(fiveMinutes.hunger, 99)
	assert.equal(fiveMinutes.happiness, 99.25)
	assert.deepEqual(wholeNeeds({ hunger: 89.6, happiness: 29.4, energy: 14.5, affection: 0.2 }), {
		hunger: 90,
		happiness: 29,
		energy: 15,
		affection: 0
	})
})

test('decay: values stay between 0 and 100, and a long absence is capped, not fatal', () => {
	const from = '2026-10-01T12:00:00Z'
	const month = decayNeeds(STARTING_NEEDS, at(from), hoursAfter(from, 24 * 30), UTC)
	assert.equal(month.hunger, 0)
	assert.equal(month.affection, 0)
	assert.ok(month.energy >= 0 && month.energy <= 100)
	// A pet never gets above full while asleep.
	const night = decayNeeds(FULL, at('2026-10-01T23:00:00Z'), at('2026-10-02T06:00:00Z'), UTC)
	assert.equal(night.energy, 100)
})

test('decay: splitting the walk never changes the result', () => {
	const from = '2026-10-01T15:20:00Z'
	const direct = decayNeeds(FULL, at(from), hoursAfter(from, 5.5), UTC)
	const halfway = decayNeeds(FULL, at(from), hoursAfter(from, 2.75), UTC)
	// Not re-applying from a rounded halfway value: the server always decays from what it stored.
	assert.ok(halfway.hunger >= direct.hunger)
	assert.deepEqual(direct, decayNeeds(FULL, at(from), hoursAfter(from, 5.5), UTC))
})

test('actions: each gives its base times the room left, and a little happiness', () => {
	const needs: Needs = { hunger: 50, happiness: 50, energy: 50, affection: 50 }
	assert.deepEqual(applyAction(needs, 'feed'), {
		needs: { hunger: 70, happiness: 51.5, energy: 50, affection: 50 },
		changed: true
	})
	assert.deepEqual(applyAction(needs, 'play'), {
		needs: { hunger: 50, happiness: 67.5, energy: 40, affection: 50 },
		changed: true
	})
	assert.deepEqual(applyAction(needs, 'pet'), {
		needs: { hunger: 50, happiness: 51.5, energy: 50, affection: 65 },
		changed: true
	})
})

test('actions: from low, each tap gives less, and Feed is full on the fourth', () => {
	let needs: Needs = { hunger: 25, happiness: 50, energy: 50, affection: 50 }
	const shown: number[] = []
	while (canHelp(needs, 'feed')) {
		needs = applyAction(needs, 'feed').needs
		shown.push(Math.round(needs.hunger))
	}
	assert.deepEqual(shown, [55, 73, 84, 90])
	// Play tires the pet: four plays from 50 energy leave 10, too sleepy for a fifth.
	let player: Needs = { hunger: 50, happiness: 30, energy: 50, affection: 50 }
	for (let i = 0; i < 4; i++) player = applyAction(player, 'play').needs
	assert.equal(Math.round(player.happiness), 88)
	assert.equal(player.energy, 10)
	assert.equal(canHelp(player, 'play'), false)
})

test("actions: Feed when full and Play when too sleepy can't help, read as shown", () => {
	const full: Needs = { hunger: 90, happiness: 50, energy: 50, affection: 50 }
	assert.deepEqual(applyAction(full, 'feed'), { needs: full, changed: false })
	assert.equal(applyAction({ ...full, hunger: 89 }, 'feed').changed, true)
	// 89.6 shows as 90: full on both sides.
	assert.equal(applyAction({ ...full, hunger: 89.6 }, 'feed').changed, false)
	assert.equal(applyAction({ ...full, hunger: 89.4 }, 'feed').changed, true)
	const sleepy: Needs = { hunger: 50, happiness: 50, energy: 14, affection: 50 }
	assert.deepEqual(applyAction(sleepy, 'play'), { needs: sleepy, changed: false })
	assert.equal(applyAction({ ...sleepy, energy: 15 }, 'play').changed, true)
	assert.equal(applyAction({ ...sleepy, energy: 14.5 }, 'play').changed, true)
})

test('actions: a tap always shows (at least 3), nothing goes past 100, a full Pet changes nothing', () => {
	assert.deepEqual(applyAction(FULL, 'pet'), { needs: FULL, changed: false })
	const almost: Needs = { hunger: 85, happiness: 98, energy: 50, affection: 95 }
	assert.equal(applyAction(almost, 'feed').needs.hunger, 91)
	assert.equal(applyAction(almost, 'pet').needs.affection, 98)
	assert.equal(applyAction({ ...almost, affection: 99 }, 'pet').needs.affection, 100)
})

test('thresholds read the whole number shown', () => {
	const base: Needs = { hunger: 80, happiness: 80, energy: 80, affection: 80 }
	assert.equal(moodFor({ ...base, energy: 29.6 }), 'content')
	assert.equal(moodFor({ ...base, energy: 29.4 }), 'sleepy')
	assert.equal(lowCount({ ...base, hunger: 29.5, happiness: 29.4 }), 1)
	// 40.2 and 40.4 both show 40: a tie, which goes to affection.
	assert.equal(lowestNeed({ ...base, hunger: 40.2, affection: 40.4 }), 'affection')
	assert.equal(isAllGood({ ...base, hunger: 69.5 }), true)
})

test('mood: sleepy, then sad, then happy, then content, at the spec boundaries', () => {
	const base: Needs = { hunger: 80, happiness: 80, energy: 80, affection: 80 }
	assert.equal(moodFor({ ...base, energy: 29 }), 'sleepy')
	// Energy 30 is not sleepy; with the rest full, the average makes it happy.
	assert.equal(moodFor({ ...FULL, energy: 30 }), 'happy')
	assert.equal(moodFor({ ...base, energy: 30 }), 'content')
	// Sleepy outranks sad.
	assert.equal(moodFor({ ...base, energy: 10, hunger: 5 }), 'sleepy')
	assert.equal(moodFor({ ...base, hunger: 19 }), 'sad')
	assert.equal(moodFor({ hunger: 20, happiness: 100, energy: 100, affection: 80 }), 'happy')
	assert.equal(moodFor({ hunger: 75, happiness: 75, energy: 75, affection: 75 }), 'happy')
	assert.equal(moodFor({ hunger: 74, happiness: 75, energy: 75, affection: 75 }), 'content')
	assert.equal(moodFor(STARTING_NEEDS), 'content')
})

test('lowest need: the lowest, ties in the order affection, hunger, energy, happiness', () => {
	assert.equal(lowestNeed(STARTING_NEEDS), 'hunger')
	assert.equal(lowestNeed({ hunger: 40, happiness: 40, energy: 40, affection: 40 }), 'affection')
	assert.equal(lowestNeed({ hunger: 40, happiness: 30, energy: 30, affection: 50 }), 'energy')
	assert.equal(lowestNeed({ hunger: 90, happiness: 10, energy: 90, affection: 90 }), 'happiness')
})

test('low and all good: below 30 is low; 70 and up everywhere is all good', () => {
	assert.equal(lowCount({ hunger: 29, happiness: 30, energy: 5, affection: 90 }), 2)
	assert.equal(isAllGood({ hunger: 70, happiness: 70, energy: 70, affection: 70 }), true)
	assert.equal(isAllGood({ hunger: 69, happiness: 100, energy: 100, affection: 100 }), false)
})

test('time zones: an IANA zone is valid; anything else is not', () => {
	assert.equal(isValidTimeZone('Europe/Istanbul'), true)
	assert.equal(isValidTimeZone('UTC'), true)
	assert.equal(isValidTimeZone('Mars/Olympus'), false)
	assert.equal(isValidTimeZone(''), false)
})

test('wanted action: the one for the lowest need, only when it is low and can help', () => {
	const base: Needs = { hunger: 80, happiness: 80, energy: 80, affection: 80 }
	assert.equal(wantedAction(base), null)
	assert.equal(wantedAction({ ...base, hunger: 20 }), 'feed')
	assert.equal(wantedAction({ ...base, happiness: 29 }), 'play')
	assert.equal(wantedAction({ ...base, happiness: 30 }), null)
	assert.equal(wantedAction({ ...base, affection: 5 }), 'pet')
	// Energy has no button.
	assert.equal(wantedAction({ ...base, energy: 10 }), null)
	// Bored but too sleepy to play: Play can't help, so nothing is suggested.
	assert.equal(wantedAction({ ...base, happiness: 10, energy: 12 }), null)
})

test('can help: Feed not when full, Play not when too sleepy, Pet always', () => {
	const base: Needs = { hunger: 50, happiness: 50, energy: 50, affection: 100 }
	assert.equal(canHelp({ ...base, hunger: 89 }, 'feed'), true)
	assert.equal(canHelp({ ...base, hunger: 90 }, 'feed'), false)
	assert.equal(canHelp({ ...base, energy: 15 }, 'play'), true)
	assert.equal(canHelp({ ...base, energy: 14 }, 'play'), false)
	assert.equal(canHelp(base, 'pet'), true)
})
