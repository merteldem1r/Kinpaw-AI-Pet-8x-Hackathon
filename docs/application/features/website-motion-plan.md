# Website motion — plan

Requirements: [website-motion-requirements.md](website-motion-requirements.md). All in
`apps/web`; no schema, no events, no app change.

## Phase 1 — Quick wins: headlines and the skies' depth (R2, R3, R7)

**Files:** `src/components/motion/WordRise.tsx`, `src/lib/sky.ts`, `src/app/globals.css`, the
section headings (`landing/Day*.tsx`, `MakeSection`, `RealThing`, `PricingTeaser`, `FaqSection`,
`Closing`).
**Changes:** `WordRise` takes `onView`: its words wait, paused, until the `<Reveal>` around them
arrives. `SKY_CSS` gives a scene whose ground above is the other scheme a dusk or a dawn band of
the app's sky colours. CSS scroll-driven animations (`animation-timeline: view()`, behind
`@supports`) move each scene's stars, clouds and sun or moon at their own depth; the clouds
drift on a slow loop.
**Verify:** scroll the page: every heading rises on arrival; day 2 meets day 3 through a dusk;
the sun moves while a scene scrolls. Reduce Motion on: everything still, nothing missing.

## Phase 2 — Mochi alive (R4, R5, R6)

**Files:** `src/components/pet/PetSvg.tsx`, new `src/components/pet/LivePet.tsx`,
`landing/HeroPet.tsx`, `landing/stage.tsx`, the scenes' pets, `src/lib/pet-lines.ts`,
`src/lib/analytics/events.ts` (a comment).
**Changes:** `PetSvg` groups its open eyes so CSS can blink them and move them (a still drawing
when nothing drives it, so the phone frames are unchanged). `LivePet` (client) drives the look
toward the pointer through two CSS variables (no React render per move), seeds each pet's blink,
and crossfades a mood change. Day 1: Mochi lands, the meters fill, a tap on Mochi pets it, the
idle line and the one-time nudge.
**Verify:** day 1: the pet lands, follows the mouse, blinks; tap it and the hearts rise and
`hero_pet_cared` fires with `action: 'pet'`; wait ten seconds and it says its need line.

## Phase 3 — The time-lapses (R1)

**Files:** new `landing/TimeLapse.tsx`, `src/app/page.tsx`, `src/app/globals.css`,
`landing/DayPass.tsx` (kept as the still version).
**Changes:** days 4 and 6 become tall sections with a sticky screen. `motion`'s `useScroll` maps
the scroll to an hour; the hour drives each sky's opacity (the app's skies, one over the other),
the sun's and the moon's arcs, the stars, the clock (written to the DOM, not rendered) and the
pet's mood (asleep 23:00–07:00, the app's night). Reduce Motion renders `DayPass`.
**Verify:** scroll day 4 slowly: night, dawn, day, dusk, night, the clock running; the week strip
still lights 4; the scene after it opens on the ground the lapse ended on.

## Phase 4 — Gates and the record

`npm run typecheck`, `lint`, `format:check`, `check:events`, `test`, `web:build`; screenshots at
1440 and 390 wide. `docs/memory/website-seven-days.md` gains the time-lapses.

## Risks

- **Scroll-driven CSS** is Chrome and Safari 26; elsewhere the skies are still, as today. The
  time-lapses use `motion`, so they run everywhere.
- **Phones:** the lapses stack a few full-screen layers; only opacity and transform animate.
- **No number moves:** no event is added, renamed or re-fired.
