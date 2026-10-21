# M5: Home, the core loop — plan

> Requirements: [m5-home-core-loop-requirements.md](m5-home-core-loop-requirements.md). Each
> phase leaves `main` working. The schema lands before the code that reads it, the events before
> the screen that fires them. Written 2026-10-01. Pets are drawn by `PetArt` (M4b Step A), not
> `PetImage`.

## Phase 1 — Events · done 2026-10-01

**Files:** `apps/mobile/lib/analytics.ts` (the `EventName` union and its doc comment),
`apps/web/src/lib/analytics/events.ts` (`PET_EVENTS.petActionTaken`).
**Changes:** run the `events` skill with the answers in the requirements' Events section:
`home_viewed`, `home_load_failed`, `home_retry_tapped`, `pet_action_taken`,
`pet_action_failed`, `pet_tapped`, `home_sky_tapped` in the app's registry; `pet_action_taken`
with discriminator `action` in the web's, which adds it to the first-party whitelist.
**Verify:** `npm run check:events` (unfired events only warn until Phase 4), `npm run typecheck`.

## Phase 2 — The shared needs logic · done 2026-10-01

**Files:** new `packages/contract/src/v1/needs.ts` and `needs.test.mts`;
`packages/contract/index.ts` (export).
**Changes:** R2. Needs type and Zod schema (`needsSchema`: four ints 0–100 and `updated_at`),
`ACTIONS`, the rate and effect constants, `decayNeeds`, `applyAction`, `moodFor`, `lowestNeed`,
`isLow`. Decay walks the elapsed time in segments split at the local 07:00 and 23:00
boundaries (`Intl.DateTimeFormat` with `timeZone`, which both Node and Hermes on iOS support),
capped at 7 days, which is long past where every decaying need reaches 0. It works in fractions
and rounds once at the end, so splitting the walk never changes the result.
**Verify:** `npm test --workspace=@app/contract`. Cases: no time passed; an hour awake; a night
across midnight; a span crossing a DST change; `now` before `storedAt`; clamping at 0 and 100;
each action's effect and "can't help" rule; every mood rule boundary (energy 29/30, lowest
19/20, average 74/75); lowest need ties broken in a fixed order.

## Phase 3 — Needs on the server · done 2026-10-01

**Files:** `apps/web/prisma/schema/pets.prisma` (`PetNeeds`); migrations
`20261001160514_pet_needs` (generated) and `20261001160515_pet_needs_security`;
`apps/web/prisma/run-once.sql` (a needs row for every existing pet);
`apps/web/src/server/db/pets.ts` and tests; new `apps/web/src/server/api/pet-wire.ts` (the wire
shape both pet routes send); `packages/contract/src/v1/pets.ts` (`petSchema.needs`,
`petActionBody`, `petActionResponse`) and `endpoints.ts` (`petAction`); new
`apps/web/src/app/api/app/v1/pet/actions/route.ts` and test.
**Changes:** R1, R3–R5. `petStore.create` gives the pet its needs row; `petStore.act` locks only
the `pet_needs` row (`select … for update of n`), decays, applies, stores, creating the row first
if a pet somehow has none.
**Verified:** a replay on a throwaway Postgres (zero drift, `check:rls` on all 10 tables, the
backfill gives an old pet one row and is harmless twice); the pet store on a real database (13:
starting needs, decay then action, two simultaneous taps both applied, a missing row read as
the starting needs and created by the first action, a retried save keeps its needs, needs
deleted with the pet); the actions route (6); web 141, contract 40, mobile 256; typecheck, lint,
format, events, standards, store, secrets, env.

## Phase 4 — Home, Ready and Refreshing · done 2026-10-01 (with Phase 5)

**Files:** `apps/mobile/app/(tabs)/index.tsx` (rebuilt); new `apps/mobile/components/pet/
PetStage.tsx`, `apps/mobile/components/pet/NeedMeter.tsx`, `apps/mobile/components/ui/
ProgressBar.tsx`; new `apps/mobile/lib/petLines.ts` and `apps/mobile/__tests__/petLines.test.ts`;
new `apps/mobile/hooks/usePetNeeds.ts` (displayed needs = decay of the cached pet, ticking once a
minute and on focus).
**Changes:** R6–R8, R11, R12, R14; `home_viewed` on focus, `pet_tapped`. The bubble shows the
line without "Reply →" (the split). The eyebrow from `phaseAt` plus the weekday.
**Verify:** Simulator, a cat and a dog, at a day phase and a night phase (change the Mac's clock,
or a dev-only `now` override in `usePetNeeds`): header, bubble and mood match the rules for a
pet set to each lowest need (set needs through `psql` locally); low meters in coral with
"· low"; VoiceOver reads each meter; reduced motion. `npm test --workspace=@app/mobile`.

## Phase 5 — Actions · done 2026-10-01

**As built:** the optimistic change is made in the tap handler, not `onMutate`, so a tap shows at
once even while an earlier request is still out; requests run one at a time (`scope`); only
the answer to the last request in flight is written back; a failure refetches the pet (the
server's truth) instead of restoring a snapshot that could undo a tap that landed. The
callbacks sit on the mutation, not on `mutate()`, which TanStack runs for the latest call only.
Home's Loading and Error states (Phase 6's first half) came with it.

**Files:** new `apps/mobile/hooks/usePetAction.ts`; `apps/mobile/app/(tabs)/index.tsx`.
**Changes:** R9, R10. A TanStack mutation with `scope: { id: 'pet-action' }`, so actions run one
at a time in order. `onMutate` writes the optimistic pet into `['pet']` and keeps the previous
one; `onError` restores it, shows the "Oops" line, `warning` haptic, `pet_action_failed`;
`onSuccess` writes the server's pet, fires `pet_action_taken` with moods before and after.
Reaction lines cycle per action. The device zone from
`Intl.DateTimeFormat().resolvedOptions().timeZone`.
**Verify:** Simulator: each action moves the right bars and line; Feed at hunger ≥ 90 and Play at
energy < 15 show the "can't help" line with a `press` haptic; tap Feed five times fast and the
final needs equal the server's; stop the web server and tap: rollback and the Oops line;
`analytics_events` has one `pet_action_taken` row per action per day.

## Phase 6 — Error state, then the cut-if-tight extras · Error state done; extras deferred

> The Error and Loading states came with Phase 5. The sun/moon tap and the shooting star are not
> built (Mert, 2026-10-01: M5 ends here); `home_sky_tapped` stays registered for them.

**Files:** `apps/mobile/app/(tabs)/index.tsx`; `apps/mobile/components/pet/SkyScene.tsx` and
`SkyBand.tsx` (only if the extras are kept).
**Changes:** R13's Error state (`home_load_failed`, `home_retry_tapped`). Then, only if time
allows and Mert keeps them: the 72pt sun/moon tap with the phase line (`home_sky_tapped`) and
the night shooting star (once per visit, 20–90 s in, never under reduced motion).
**Verify:** the Error state by clearing the query cache with the web server stopped (dev only);
then the full `local-review`, and the suggested commit message.

## Risks

- **A migration on a table with rows.** Adding columns with defaults is safe and reversible, but
  it is the first change to `pets` since M4: check the generated SQL adds columns only (no
  rewrite, no `SET NOT NULL` on an existing column).
- **The app and the server disagreeing.** One function in `@app/contract` for both, tested at
  the boundaries. The phone's clock may differ from the server's; the server's answer always
  replaces the display after an action, and decay never runs backwards.
- **Rapid taps.** Lost updates on the server (prevented by the row lock) and rollbacks undoing a
  later success on the phone (prevented by running mutations in order).
- **Time zones in Hermes.** `Intl` with a `timeZone` works on iOS Hermes; Phase 2's tests run in
  Node only, so Phase 4's Simulator check at a night phase is the proof on the device.
- **Nothing here touches money, entitlement or the Play Stats API.** `pet_action_taken` adds
  first-party rows only; no dashboard number changes.
