# Website motion — requirements

> **Status: built 2026-10-08**, round 1 (R1–R10, committed in `c28d830`) and round 2 (R11–R16,
> after Mert's look: day 6 became the friends, day 4 fuller, more life everywhere). Decided with Mert, 2026-10-08, after a review said the landing
> page could feel more dynamic, modern and better in its transitions. Plan:
> [website-motion-plan.md](website-motion-plan.md). The page's structure and brief stay as they
> are ([`docs/memory/website-seven-days.md`](../../memory/website-seven-days.md),
> `apps/web/.impeccable/surfaces/`); this changes how it moves.

## What is there today

- **One entrance for everything.** 25 `<Reveal>`s, each the same fade and rise, once. After a
  block has arrived nothing on the page answers the scroll.
- **The week cuts from day to day.** Each day is its own `<Scene>` with a still gradient
  (`src/lib/sky.ts`); a light day meets a night on a hard band (day 2 into day 3). The sun or moon
  is a still disc and the clouds do not move.
- **Days 4 and 6 are a line on the page's ground**, the quietest part of a page about time passing.
- **Every pet is a still drawing** (`PetSvg`): it breathes, but never blinks, looks or arrives;
  a mood change on day 1 is a cut.
- **`motion` is installed and wraps the page, and nothing uses it** while the app is not live
  (its one user, `Magnetic`, sits inside the store badges).

## Success criteria

The page reads as a week passing, and the pet as alive, without a new library, a new colour or a
slower first paint. Measured by the page's existing numbers: `week_day_viewed` (day 7) over
`landing_view` (does the visitor get through the week) and `hero_pet_cared` over `landing_view`
(does the first viewport get touched).

## Requirements

**A. Time moves with the scroll**

R1. Days 4 and 6 are time-lapses: while the visitor scrolls through one, the screen holds still
and a whole stretch of hours passes over it (the app's four skies in turn, the sun and the moon
crossing, the stars out at night, the clock running), with Mochi asleep at night and awake by day.
The day's line stays the content.
R2. A light day meets a dark one through a dusk (or a dawn) of the app's own sky colours, never a
hard band.
R3. In every scene the sun or moon drifts, the stars and clouds sit at their own depth as the page
scrolls, and the clouds drift.

**B. Mochi is alive**

R4. A pet with open eyes blinks now and then; on day 1 and in the week's scenes it looks toward
the pointer (mouse only).
R5. Day 1's Mochi lands on its ground when the page opens, its needs fill in, and tapping Mochi
itself pets it (the same as the Pet button). A mood change crossfades the face.
R6. Left alone on day 1, Mochi goes back to saying what it needs (the app's own line for its
lowest need), and the button it wants nudges once if nothing has been tapped.

**Quick wins**

R7. Every section headline rises word by word when it arrives, as the hero's does.

**Everywhere**

R8. Reduce Motion: nothing travels, the time-lapses are the line they were, and every pet, sky
and line still shows. Without JavaScript every piece still shows.
R9. The first viewport paints as fast as before: the headline and the promise wait on nothing.
R10. Colours only from `@app/brand`; no new dependency; sound still only on a tap.

**Round 2 (Mert, 2026-10-08: days 4 and 6 looked the same, day 4 empty, more life wanted)**

R11. Day 6 is a scene, not a time-lapse: your friends' pets (the v2 Friends feature,
[v2-friends-requirements.md](v2-friends-requirements.md) R3, R6, R8, R9, R13). The scene holds
while your code and four friends' pets pass sideways; every claim on it is the feature's.
R12. Day 4 is fuller: Mochi as large as on day 1, on a cushion; its four needs at its sides,
moved by the app's real decay from a fed midnight (so by evening they are low, which day 5
answers); the app's own Home header for them under the line; a ball by day, a sunbeam in the
afternoon, the lamp at night, and the app's life in the sky at its hours.
R13. The skies have life (`art.life`: motes in the morning, birds by day, fireflies at dusk),
more and fainter stars, a shooting star now and then, a soft glow around the sun or moon, and
depth under the mouse.
R14. Pets wag their tails at their mood's pace, hop when the mouse arrives, and show their mood
(z's asleep, a heart now and then when happy); the lamp glows behind them at dusk and at night.
R15. Lead paragraphs light up word by word as they are read; card groups (voices, plans, questions)
arrive one by one; the app's phones tilt up into place; faint stars go on after the week.
R16. Same limits as R8–R10: Reduce Motion stills it all, no new dependency, brand colours only.

## Events

None new. Day 6 becoming a scene adds the value `'6'` to `week_day_viewed`'s `day` (its doc
comment says so); day 4 still passes uncounted. Tapping Mochi is the moment the Pet button already records: `hero_pet_cared` with
`action: 'pet'` (its doc comment says so). The time-lapses are days 4 and 6, which pass in a line
and are not counted by `week_day_viewed` (only scenes are), and stay that way.

## Out of scope

The travelling memory (day 3's fact riding the week strip to day 7), the builder's motion, page
transitions between pages. Each is
in the review's list and comes next if this lands.

## Open questions

None.
