# Needs rhythm — plan

> Requirements: [needs-rhythm-requirements.md](needs-rhythm-requirements.md). Three phases, each
> checked by Mert before the next. The schema lands before the code that writes fractions; the
> rules land with their tests before anything reads them.

## Phase 1 — Fractional needs (the schema) · done 2026-10-02

> **As built.** The generator refuses `SET DATA TYPE`, so the migration
> `20261002120000_pet_needs_fractional` is hand-written: the SQL `prisma migrate diff` produced,
> unchanged, with a header saying why. `prisma migrate dev --create-only` can't run here (its
> shadow database lacks the Supabase shim). Mert applied it with `npm run db:migrate`.

**Files:** `apps/web/prisma/schema/pets.prisma` (`PetNeeds`: the four `Int` become `Float`,
defaults kept); a new migration under `apps/web/prisma/schema/migrations/`, written by
`scripts/generate-migration.mjs` after a replay on the Homebrew Postgres
([local-checks-and-traps](../../memory/local-checks-and-traps.md)), never by hand;
`npm run prisma:generate --workspace=@app/web`.
**Changes:** R9's storage only. `ALTER COLUMN … TYPE double precision` converts the stored
integers as they are; no data is lost and nothing else reads these columns. No new table, so no
security migration. The code still writes whole numbers until Phase 2.
**Verify:** the generator's replay applies cleanly and its drift check is empty; Mert runs
`npm run db:migrate`; Supabase Studio shows the columns as `float8` and the pet's values
unchanged; `npm run typecheck`; the web suites, and `pets.test.mts` on the Homebrew Postgres.

## Phase 2 — The rules (contract, server, app) · done 2026-10-02

> **As built.** `decayNeeds` copies only the four needs (the server passes a whole row; a
> spread put `pet_id` into the update). Talk gains stay whole numbers so `pet_talks` (integer
> columns) needs no migration: a rise stops at the last whole point under 100, a drop at the last
> whole point above the floor. The need sheet's copy (`lib/needInfo.ts`) changed here, since it
> reads the rules. The running `web:dev` must be restarted after `prisma:generate`.

**Files:**

- `packages/contract/src/v1/needs.ts`: `DECAY_PER_HOUR` (day) and a `NIGHT_DECAY_PER_HOUR`
  (a quarter), `SLEEP_ENERGY_PER_HOUR` 12; `decayNeeds` walks every need through the night
  window, not only energy, and stops rounding; `ACTION_BASE` (40 / 35 / 30), `MIN_GAIN` 3,
  `SIDE_HAPPINESS` 3, `PLAY_ENERGY_COST` 10 and an `applyAction` that gives less the fuller a
  need is; `storedNeedsSchema` accepts fractions; a `wholeNeeds()` that rounds for showing, and
  every threshold (`canHelp`, `isLow`, `moodFor`, `lowestNeed`, `isAllGood`, `wantedAction`)
  compares rounded values (R12).
- `packages/contract/src/v1/talk.ts`: `TALK_DAILY_CAP` 25 / 30; `applyTalk` in fractions.
- `packages/contract/src/v1/needs.test.mts`, `talk.test.mts`: the new rates, the night quarter,
  the R6 table tap by tap, the minimum gain, side gains, thresholds on rounded values, no
  rounding inside the rules.
- `apps/web/src/server/db/pets.ts`: nothing structural (`changeNeeds` already stores what the
  rules return); its suite's expected numbers move (`pets.test.mts`).
- `apps/web/src/server/talk/talk-to-pet.ts`: the prompt gets `wholeNeeds()`.
- `apps/mobile/hooks/usePetNeeds.ts`: returns `wholeNeeds()` of the decayed values (R11);
  `hooks/usePetAction.ts` keeps working on the exact decayed values for the optimistic update.

**Changes:** R1–R8, R10–R12, R15. The app and the server change together, since they share the
rules; the API shape loosens (integers → numbers) but nothing that reads it breaks.
**Verify:** `npm test --workspace @app/contract`, the mobile Jest suite, the web talk and pet
suites; on the Simulator: Feed four times from low and watch each gain shrink (+30, +18, +11,
+6) and "Full" arrive; Play until "Sleepy"; Supabase Studio: set `updated_at` back 6 hours and
see hunger low, then back across a night and see a morning-hungry pet, not a starving one.

## Phase 3 — What people read · done 2026-10-02

**Files:** `apps/mobile/lib/needInfo.ts` and `__tests__/needInfo.test.ts` (R13);
`docs/application/UI/kinpaw-screen-spec-v1.md` ("Shared logic → Needs": the rates, the night
quarter, the action table with "up to" and shrinking gains, "stored as fractions, shown whole"),
`docs/application/product.md` (the needs and decay bullets, dated), the roadmap's status line,
and a `docs/memory/` note if anything surprising turned up.
**Changes:** R13, R14.
**Verify:** each need's sheet on the Simulator reads the new numbers; `npm run format:check`;
then the `local-review` gates.

## Risks

- **A migration that changes column types.** `int → double precision` is lossless and
  reversible, but it is the first type change on a live table here; the generator's replay and
  drift check prove it applies, and Phase 1 ships alone so a problem is seen before any code
  depends on it.
- **The app and the server disagreeing** if one side updates before the other (an old app
  build reading fractions would fail Zod on integers). Both are on Mert's machine and change in
  Phase 2 together; there is no store build. After launch this would be a `v2` change.
- **Feeling punishing.** Faster decay can read as guilt. The night quarter, the never-dies
  rule, and the pet's lines (it missed you, it's never angry) carry that; Mert plays it for a
  day before tuning (open question 2).
- **Thresholds at the edge** (89.6 vs 90): settled by R12, and tested on both sides of each
  threshold.
- **Dashboard numbers:** none change; nothing reported reads `pet_needs`.
