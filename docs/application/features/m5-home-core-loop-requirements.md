# M5: Home, the core loop — requirements

> Milestone M5 of the [roadmap](../roadmap.md). Inputs: [product.md](../product.md) ("The core
> loop", "The pet", "Measurement"), the [screen spec](../UI/kinpaw-screen-spec-v1.md) (Shared
> logic → Needs, Mood, Header and bubble lines; Home; Events) and the canvas exports for Home in
> `../UI/screens/`. Plan: [m5-home-core-loop-plan.md](m5-home-core-loop-plan.md).
> Written 2026-10-01.
>
> **Status: built and checked by Mert on 2026-10-01** (Phases 1–5; see [Decisions](#decisions)).
> The Phase 6 extras (tapping the sun or moon, the night's shooting star) are not built: they are
> on the roadmap's cut-if-tight list, to pick up in M8 or when there is time.

## Problem

After M4 a signed-in person lands on My pet and finds a placeholder ("Your pet's room"). The pet
has no needs, nothing to do and nothing to say, so there is no reason to open the app tomorrow.
M5 is the core loop from product.md: see the pet under the live sky with its mood and four
needs, care for it (Feed, Play, Pet), watch it react, and come back later to find the needs have
drifted down.

## What is there today (research)

- **The pet has no needs.** `pets` (`apps/web/prisma/schema/pets.prisma`) holds species, look,
  name, preset and the six traits. Two traits share a name with two needs (`affection`,
  `energy`), so the need columns need a distinct name (R1).
- **Route pattern:** every `/api/app/v1` route is one `endpoints.ts` entry built by
  `createAppRoute` (bearer check; input and output parsed with `@app/contract`). `GET` and
  `POST /api/app/v1/pet` exist; `petStore` (`src/server/db/pets.ts`) scopes every query by the
  verified user id.
- **Shared code:** `@app/contract` is the only package both the web and the app import that can
  hold logic (it already holds the pet catalog and helpers such as `presetTraits`). It has its
  own `node --test` suite. The needs logic goes there, so the app and the server cannot
  disagree (product.md: "written once and shared by both").
- **Already built and reusable:** `SkyBand` + `SkyScene` (the sky, sun, moon, stars, clouds and
  their ambient motion, M3), `useSkyPhase`/`phaseAt` (`lib/sky.ts`: the part of day the
  eyebrow needs), `PetImage` (picks the file by look and mood and crossfades), `PetBubble`
  (already takes `onReply` for M6), `PressableScale`, `Card`, `Skeleton`, `Eyebrow`, `Button`,
  `haptic.*` (`press`, `select`, `success`, `warning`), `usePet` (TanStack Query, key `['pet']`).
  The query client already refetches on return to the foreground (`focusManager` on
  `AppState`).
- **Not built:** `NeedMeter` and a progress bar (no `ProgressBar` in `components/ui/`),
  `PetStage`, `lib/petLines.ts`, the sun/moon tap target and the shooting star.
- **Home's loading and error states are mostly covered by the gate.** The root layout
  (`app/_layout.tsx`) loads the pet before it shows the tabs, and shows its own
  `PetLoadError` ("Couldn't reach your pet") if that fails. So Home always opens with a cached
  pet: its realistic states are Ready and Refreshing. Spec's Loading and Error happen only if the
  cache is gone, which the gate already prevents.
- **Talk doesn't exist until M6.** The spec's bubble is a button to Talk with a "Reply →" row;
  in M5 there is nowhere to go.
- **Events:** none of Home's are registered except `tab_selected`. The web registry has
  `PET_EVENTS.petCreated` only.
- **No time zone on the server.** The energy night window (23:00–07:00) is local time, and
  nothing tells the server the person's time zone (`profiles` has `locale`, not a zone). M6's
  daily chat limit needs the same thing.

## Success criteria

- A signed-in person opens My pet and sees the pet in a mood that matches its needs, four need
  meters, a narrator line and a pet line, under the sky of the current part of day.
- Feed, Play and Pet change the needs at once (optimistic), the pet reacts (line, mood, bars,
  haptic), and the server's answer agrees with what was shown.
- Closing the app and returning hours later shows lower needs, computed the same way on the
  phone and on the server; the energy need recovers overnight.
- **The metric:** care days per person: days with at least one `pet_action_taken`, read
  first-party from `analytics_events` (the admin panel shows it without PostHog). The funnel
  step under it is `home_viewed` → `pet_action_taken`.

## v1 / later split (agreed)

**v1 (this milestone):**

- The needs on the server, the shared needs logic (decay with the night window, action effects,
  mood, lowest need), and the action route.
- Home Ready and Refreshing, exactly as the spec lays them out: eyebrow, narrator header, sky,
  bubble with the pet's line, the pet with its contact shadow, the needs panel with four
  `NeedMeter`s and Feed / Play / Pet.
- Optimistic actions with rollback and "Oops, I dropped it. Try again?"; haptics by meaning;
  tapping the pet (random line, press to 0.98).
- Low needs in coral with "· low" and the VoiceOver label; reduced motion respected.
- Home's Error state for a refetch that fails with nothing cached (cheap, from the spec).

**Later (proposed cuts, with why):**

- **The bubble as a button to Talk** ("Reply →", `home_bubble_reply_tapped`): moves to M6, when
  Talk exists. In M5 the bubble only speaks. No dead buttons.
- **Tapping the sun or moon** (phase lines, `home_sky_tapped`) and **the shooting star**:
  the roadmap's "cut if tight" list. Cheap but not part of the loop; build last, if time
  allows. **Built 2026-10-01**, with the living pet and the sky life (the spec's PetStage
  and SkyBand).
- **Home's Loading state with skeletons:** unreachable in practice (the gate holds the
  pet). Built only as the plain fallback the template's `Skeleton` gives, not designed.
- **Restyling the gate's `PetLoadError`** with Home's "Couldn't reach {name}" copy: the gate
  doesn't know the name yet. Kept as is.

## Requirements

**Needs on the server**

R1. The needs live in their own table, `pet_needs`, one row per pet (`pet_id` is its primary key
and a foreign key to `pets`, deleted with it): `hunger`, `happiness`, `energy`, `affection`
(integers 0–100) and `updated_at`. The pet's identity (appearance, name, traits) stays on `pets`
(Decision 5). A pet's needs row is created when the pet is saved, at the starting needs (the
table's defaults); pets saved before the table get theirs from `run-once.sql`. Mood is never
stored. The migration is Prisma's, plus the security migration every new table gets.

R2. The shared needs logic lives in `@app/contract` (`src/v1/needs.ts`), used unchanged by the
app (for display) and the server (before an action):

- `decayNeeds(stored, storedAt, now, timeZone)`: each need loses its hourly rate for the time
  since `storedAt`; energy instead recovers during the local night window 23:00–07:00. Values
  stay whole and between 0 and 100; a clock behind `storedAt` decays nothing.
- `applyAction(needs, action)`: the effects and "can't help" rules from the spec's table.
  Returns the new needs and whether anything changed.
- `moodFor(needs)`, `lowestNeed(needs)`, `isLow(value)` (below 30): the spec's rules.
- Rates are named constants (open question 1).

R3. `GET /api/app/v1/pet` and `POST /api/app/v1/pet` return the pet with
`needs: { hunger, happiness, energy, affection, updated_at }`, the stored values (not decayed).
Adding the field is additive: no `v1` caller breaks.

R4. `POST /api/app/v1/pet/actions` with `{ action: 'feed' | 'play' | 'pet', time_zone }`: the
server reads the stored needs, applies decay to now in `time_zone`, applies the action, stores
the result in `pet_needs` with `updated_at = now`, and returns `{ pet, changed }`. It does this as one
locked read-and-write, so two quick taps never lose an update. Only the caller's pet; 404 if
they have none; 400 for an unknown action or an invalid time zone. The app never writes a need
itself.

R5. A successful action records `pet_action_taken` first-party with `{ action, need_changed }`,
at most once a day per action per person (`dedupeMatch: { action }`).

**Home (`app/(tabs)/index.tsx`)**

R6. The layout from the spec: `Eyebrow` (weekday and part of day, e.g. "Wednesday night"), the
narrator header (`title`, from the lowest need, or the all-good row when every need is 70 or
more), the sky band behind them, the bubble upper right with the pet's line, `PetStage`
(a 260pt `PetArt` in the mood from R2, with its contact shadow, inside `PressableScale`), and
the needs panel (`Card`: a 2 × 2 grid of `NeedMeter` and a row of Feed, Play, Pet as secondary
50pt buttons with icons).

R7. The needs shown are always `decayNeeds(stored, updated_at, now, deviceTimeZone)`,
recomputed on focus, on refetch and once a minute while Home is open. Nothing is mocked.

R8. `NeedMeter`: icon (bowl, smile, bolt, heart) and `caption` label, then a 6pt bar in
`brandInk` on `tintTrack` that fills on `smooth`. Below 30, bar, icon and label turn
`errorText` and "· low" follows the label. VoiceOver reads "Hunger, 58 percent, low". No
numbers on screen.

R9. Feed / Play / Pet: update the needs optimistically, animate the bars, swap the bubble to the
action's reaction line (cycling; the Pet line by species), recompute header and mood (the image
crossfades), then call R4. Haptic: `success` when a need rose, `press` when nothing changed
(the "can't help" line shows instead). The server's answer replaces the optimistic needs. No
cooldowns.

R10. A failed action rolls the needs back to the last server value, the bubble says "Oops, I
dropped it. Try again?", `warning` haptic, and `pet_action_failed` fires. Actions in flight are
sent one at a time, in order, so a rollback never undoes a later success.

R11. Tapping the pet: a random line from the spec's list, press to 0.98 and back on `settle`,
`select` haptic, no need changes.

R12. Lines (header, bubble, reactions, tap, error) live in `apps/mobile/lib/petLines.ts`, with
cat and dog variants where the spec has them, and `{name}` filled from the pet.

R13. Refreshing: when the app returns to the foreground or Home is focused, the pet refetches
quietly; cached values stay on screen. A failed refetch with a cached pet keeps it and shows
nothing alarming. With nothing cached: the spec's Error state (pet `sleepy`, "Hmm, {name}'s
hiding", the "Couldn't reach {name}" card with Try again).

R14. Reduced motion: bars and mood change instantly, nothing scales. Low state never relies on
colour alone. 44pt targets. The pet image's label carries the name and mood.

## Events

Registered with the `events` skill before Home is built (Phase 1).

**The answers to the events skill's questions:**

1. **The aha** for M5 is the first care action that changes a need. It is not
   `user_activated`, which stays on the first chat reply (product.md, M6). M5's metric is care
   days (Success criteria).
2. **The drop-off** to watch: `home_viewed` → `pet_action_taken`. A person who opens Home and
   never cares for the pet is the loop failing.
3. **Discriminators:** `action` on `pet_action_taken` and `pet_action_failed` (otherwise the
   daily dedupe keeps only the first action of the day); `mood` and `lowest_need` on
   `home_viewed`.
4. **Money moment:** no.
5. **Lifecycle change:** no.

| Event               | App fires it                           | Properties                                            | Sinks                                                                                            |
| ------------------- | -------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `home_viewed`       | Home focused with a pet                | `mood`, `lowest_need`, `low_count`                    | PostHog (mobile registry)                                                                        |
| `home_load_failed`  | Error state shown                      | `error_kind`                                          | PostHog                                                                                          |
| `home_retry_tapped` | Try again on the Error state           | none                                                  | PostHog                                                                                          |
| `pet_action_taken`  | The server confirmed Feed, Play or Pet | `action`, `need_changed`, `mood_before`, `mood_after` | PostHog; **also first-party from R4** with `action`, `need_changed` (web registry, `PET_EVENTS`) |
| `pet_action_failed` | An action's save failed                | `action`, `error_kind`                                | PostHog                                                                                          |
| `pet_tapped`        | Pet image tapped                       | `mood`                                                | PostHog                                                                                          |
| `pet_stroked`       | Finger stroked across the pet (140pt)  | `mood`                                                | PostHog                                                                                          |
| `home_sky_tapped`   | Sun or moon tapped                     | `time_of_day`                                         | PostHog                                                                                          |
| `tab_selected`      | Already registered                     | `tab`                                                 | PostHog                                                                                          |

`home_bubble_reply_tapped` is registered in M6 with Talk. No property carries the pet's name.
PostHog is unconfigured locally, so the app's events are checked by `check:events` and the
logger, and the first-party row is checked in `analytics_events`.

## Out of scope

- Talk, the chat tables, the bubble opening Talk, and chat's affection +5 (M6).
- Notifications when needs get low, streaks (v2).
- Animated pet, accessories, backdrops; the real art (M8, stand-ins until then).
- Any change to the gate, the tabs or the Profile and Settings screens.
- An appearance choice: the app keeps following the sky.

## Decisions

Agreed with Mert, 2026-10-01:

1. **Decay rates** as proposed, inside product.md's "about 3 to 4 points per hour": hunger
   −4/h, happiness −3/h, affection −3/h, energy −3/h while awake and **+8/h** in the
   23:00–07:00 window (a night's sleep is about +64). Other needs keep decaying at night, so a
   morning open finds the pet hungry and missing you. Named constants; tune freely.
2. **Starting needs** for a new pet and the pets already saved: hunger 60, happiness 80,
   energy 80, affection 70. The first Home says "{name}'s tummy is rumbling".
3. **The time zone comes from the phone.** The app reads its IANA zone
   (`Intl.DateTimeFormat().resolvedOptions().timeZone`: no permission, no native module) and
   sends it with each action as `time_zone`; the server validates it. No new column.
4. **The split above.** The bubble only speaks in M5: no "Reply →". The Talk tab is on hold
   (Mert, 2026-10-01): talking may instead happen on Home, by voice, with the reply in this
   same bubble ([ideas](../ideas.md), "Talk to the pet by voice on Home").
5. **The tables** (Mert, 2026-10-01): the needs in their own `pet_needs` table rather than
   columns on `pets`: they change on every tap and later on every chat reply, while the pet's
   identity is written once, so the care code locks and writes only `pet_needs`. Appearance and
   traits stay on `pets` (one-to-one, written once, read on every draw); they move out only if
   they become one-to-many (accessories) or editable with history. Mood is computed, never
   stored. An append-only care log waits for a feature that needs it
   ([ideas](../ideas.md), "A care log").
6. **Additions while building Home** (Mert, 2026-10-01), beyond the spec:
   - **The bubble has a fixed space above the pet**, three lines tall, and grows upward into the
     sky, so a longer line never moves the pet or the needs panel.
   - **Care buttons with three looks** (`components/pet/CareButton.tsx`): _wanted_ (the lowest
     need is low and this action helps it: the accent tint and border, the badge filled),
     _normal_ (a quiet surface, amber icon and label) and _can't help_ (Feed when full, Play
     when too sleepy: quieter still, still tappable so the pet can say why). Amber means only
     "wanted". The rules are shared (`HELPS`, `canHelp`, `wantedAction` in `@app/contract`), and
     `applyAction` uses the same `canHelp`, so the look and the server's answer agree. Energy has
     no button: only sleep restores it.
   - **Moving feedback** (`components/pet/ReactionBursts.tsx`): hearts after Pet, fish (cat) or
     bones (dog) after Feed, stars after Play, a sleepy "z z z" when too tired to play; the pet's
     happy face for 900 ms after any action that helped. At most 6 bursts at once. Nothing
     travels under Reduce Motion (the line, face and haptic remain). Colours are
     `art.pet.fx` in `@app/brand`.
