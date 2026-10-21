# Needs rhythm — requirements

> **Status: built 2026-10-02** (Phases 1–3 of the plan; the migration applied by Mert). Next:
> Mert plays it for a day and tunes the starting values (open question 2).
>
> Decided with Mert, 2026-10-02. Plan: [needs-rhythm-plan.md](needs-rhythm-plan.md). It changes
> the rules M5 set ([m5-home-core-loop-requirements.md](m5-home-core-loop-requirements.md),
> Decision 1) and the screen spec's "Shared logic → Needs". Where they disagree, this is newer.

## What is there today

- **The rules live once, in `packages/contract/src/v1/needs.ts`**, and both sides run them: the
  app to show the needs (`hooks/usePetNeeds.ts`, `hooks/usePetAction.ts`), the server before it
  stores a change (`changeNeeds` in `apps/web/src/server/db/pets.ts`, used by Feed / Play / Pet
  and by a talk reply). Talking's rules are in `talk.ts` (`applyTalk`, `TALK_DAILY_CAP`).
- **Decay is computed, never scheduled.** `pet_needs` holds four integers and `updated_at`.
  Nothing runs in the background: whoever reads the pet decays the stored values to now
  (`decayNeeds`), walking the local night window for energy, then rounds to whole numbers.
- **Rates:** hunger −4/h, happiness −3/h, affection −3/h, energy −3/h by day and +8/h asleep
  (23:00–07:00 local). The other three fall at the same rate day and night.
- **Actions:** Feed hunger +30 (happiness +5), nothing at hunger ≥ 90; Play happiness +25,
  energy −8, nothing below energy 15; Pet affection +20 (happiness +5). Flat, no cooldowns.
- **Live on screen:** an open Home recomputes once a minute and on returning to the app. At
  −4/h a bar moves one point every 15 minutes, so it looks still.
- **The wire:** `GET /api/app/v1/pet` sends the stored needs and `updated_at`
  (`storedNeedsSchema`, integers), never decayed; the app decays them itself.

## Problem

1. **One visit a day is enough.** A fed pet takes 17.5 hours to get hungry and 23 to get sad or
   lonely, so nothing pulls you back during the day, and the "someone missed me" feeling never
   arrives.
2. **Two or three taps fill any bar.** Feed +30 from low is nearly full; there's nothing to look
   after.
3. **Night is like day.** Faster rates alone would wake you to a starving, sad pet every
   morning: sleeping would be punished.
4. **Rounding throws decay away.** Each change stores whole numbers stamped "now", so any decay
   under half a point since the last change is lost. At the new rates, tapping something every
   two minutes would stop hunger falling at all.

## Success criteria

- A pet cared for at about 8:00, 13:00, 18:00 and 22:30 is never low for long; one left from
  breakfast to dinner is hungry and has missed you.
- Filling a low need to full takes about four taps, each visibly smaller than the last.
- The morning pet wants breakfast; it isn't starving.
- The app and the server still agree to the point, and decay is never lost to rounding.
- **Measured by** what is already recorded: care days and visits per day (`home_viewed`,
  `pet_action_taken`, first-party `pet_action_taken` rows), and `home_viewed.low_count` (how
  often people arrive to a pet that needs them). No new event.

## Requirements

### Decay: a daily rhythm

R1. **Day rates** (07:00–23:00 local): hunger −12/h, happiness −9/h, affection −7/h, energy
−5/h. From full, hunger is low (below 30) after about 6 hours, happiness about 8, affection
about 10; energy reaches 30 (sleepy) around 21:00 from a full morning.

R2. **Night** (23:00–07:00 local, the existing window): hunger, happiness and affection fall at
a quarter of their day rate (−3, −2.25, −1.75 per hour); energy recovers +12/h, so 8 hours of
sleep fills it from about 4. A night costs hunger about 24: fed at bedtime, the pet wakes near
75, ready for breakfast.

R3. The walk stays as today: window by window, at most an hour a step, local time from the
phone's zone, clamped to 0–100 as it goes, capped at 7 days back. Only the rates change, and
now every need, not just energy, has a day rate and a night rate.

### Actions: each tap gives less

R4. **A tap gives less the fuller the need is.** The gain to a need is its base times the room
left: `base × (100 − value) / 100`, never less than 3 (so a tap always shows) and never past 100. Bases: Feed → hunger 40; Play → happiness 35; Pet → affection 30.

R5. **The small side gains shrink the same way, with no minimum:** Feed and Pet each add
happiness `3 × room / 100`. Play still costs energy a flat −10 (was −8), so playing tires the
pet out: five plays cost half its energy.

R6. **What it feels like** (from a low need; each line is one tap):

| Tap | Feed (hunger from 25) | Play (happiness from 30) | Pet (affection from 30) |
| --- | --------------------- | ------------------------ | ----------------------- |
| 1   | +30 → 55              | +24.5 → 54, energy −10   | +21 → 51                |
| 2   | +18 → 73              | +16 → 70, energy −10     | +15 → 66                |
| 3   | +11 → 84              | +10 → 81, energy −10     | +10 → 76                |
| 4   | +6.5 → 90, then full  | +7 → 88, energy −10      | +7 → 83                 |

R7. "Can't help" stays as it is: Feed does nothing at hunger 90 or more, Play nothing below
energy 15, Pet always helps. No cooldowns and no daily caps on care (product.md stands);
the shrinking gains are the limit.

### Talking

R8. Talking's daily caps rise to match the faster day: happiness +25 a day (was +15), affection
+30 (was +20). The intent table, the floor at 30 and the 10-a-day limit stay.

### Precision: nothing lost to rounding

R9. **The server stores the needs as fractional numbers** (`pet_needs` hunger, happiness,
energy, affection become `double precision`, Prisma `Float`; existing integers convert as they
are). `decayNeeds`, `applyAction` and `applyTalk` work in fractions and no longer round.

R10. **The wire carries the fractions.** `storedNeedsSchema` accepts any number from 0 to 100,
not only integers, so the app decays exactly what the server stored and the two agree. This
loosens a `v1` shape; no store build calls `v1` yet (localhost only), so it is safe now and
would not be after launch.

R11. **People only ever see whole numbers.** The app rounds once, where it shows the needs
(`usePetNeeds`): the pills, the need sheet, VoiceOver, the header and bubble lines, the events'
properties. The talk prompt gets whole numbers too.

R12. **Every threshold reads the whole number shown**: low (below 30), full (90), too sleepy
(below 15), mood, the lowest need, all good. So a pill that shows 90 always means Feed is full,
on both sides, and a stored 89.6 can't be "full" on screen and "hungry" on the server.

### What people read

R13. The need sheet (`apps/mobile/lib/needInfo.ts`) says the new rules in the same plain words
with light numbers, still read from the contract: "Drops about 12 every hour, 3 while asleep."
· "Feed: up to +40, less the fuller it is. Nothing at 90 or more." Energy: "sleeps from 11pm to
7am and gets back about 12 every hour." Its tests follow.

R14. The screen spec's "Shared logic → Needs" (the action table, "integers 0–100") and
product.md's needs bullets are updated to these rules, with the date.

R15. The live update stays once a minute and on returning to the app: at −12/h a bar now moves
a point every 5 minutes, which reads as alive without a faster timer.

## Events

None new. `pet_action_taken`'s `need_changed` keeps its meaning (any need moved);
`home_viewed`'s `lowest_need` and `low_count` read the whole numbers shown (R11–R12). The
first-party `pet_action_taken` row is unchanged. Nothing the Play Stats API reports reads
`pet_needs`.

## Out of scope

- "Too soon" freshness (open question 1), streaks, a care log (`ideas.md`).
- Notifications ("someone missed me", v2): the rhythm gives them a moment worth sending; this
  milestone doesn't send them.
- Tuning the talk intent table itself; changing the starting needs (60 / 80 / 80 / 70).
- Showing fractions anywhere.

## Open questions

1. **Should repeating the same action soon also give less?** _Answered by Mert, 2026-10-02:
   no, not now. Nothing remembers recent actions; people care as much as they want, and the
   fuller-is-less rule (R4) is the only limit._
2. **The bases** (Feed 40, Play 35, Pet 30, minimum 3) and the side gains are starting values to
   tune after a day of play, like the rates were.
