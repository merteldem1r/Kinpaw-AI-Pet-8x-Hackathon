# M4b: The pet builder — plan

> Requirements: [m4b-pet-builder-requirements.md](m4b-pet-builder-requirements.md). One phase
> at a time, each confirmed with Mert before the next. Each leaves the app working.

## Step A — Foundation

### Phase A1 — The shared code (nothing uses it yet) · done 2026-10-01

**Files:** new `packages/contract/src/v1/appearance.ts` (species, moods and the looks move here
from `pets.ts`) and `appearance.test.mts`; `packages/contract/index.ts`;
`packages/brand/src/art.ts` (`art.pet`) and `index.ts`; new `apps/mobile/lib/petParts.ts`,
`apps/mobile/components/pet/PetArt.tsx` and `apps/mobile/__tests__/petArt.test.tsx`. The
designer's drop folder is removed: its code lives in these files now.
**Changes:** R1–R3, from the code drop, in the repo's style. `LOOKS` gains each look's
`appearance`; its existing fields stay, so nothing breaks yet.
**Verified:** contract suite (25, 9 new: every look valid and Plus only through a Plus option,
ears per species, the seven Plus options, Surprise me always free, species switching, name
ideas, descriptions); mobile suite (254, 6 new: colours for every part of every look and 100
random pets, moods change only the face, every look × mood renders); typecheck, lint, format,
standards, events, secrets, store.

### Phase A2 — The table and the API · done 2026-10-01

**Files:** `apps/web/prisma/schema/pets.prisma`; new hand-written migration
`apps/web/prisma/schema/migrations/<ts>_pet_appearance/migration.sql`;
`apps/web/src/server/db/pets.ts` and tests; `packages/contract/src/v1/pets.ts`;
`apps/web/src/app/api/app/v1/pet/route.ts` and `route.test.mts`;
`apps/web/src/server/db/runtime-role.test.mts` (its pet insert).
**Changes:** R4, R5. The migration adds the six columns nullable, fills them from `look` with
each look's recipe, sets them NOT NULL, and drops NOT NULL on `look`, in one transaction.
`petStore.create` takes the appearance. The route checks `usesPremium` and that a `look_id`
matches its recipe.
**Verify:** the web and contract suites; a local replay (`db:reset`, which Mert runs) shows each
existing pet with its look's recipe; `check:rls`; `test:db`.

### Phase A3 — The app draws with PetArt · done 2026-10-01, Simulator check pending

**Files:** `apps/mobile/lib/petDraft.ts` (+ test), `contexts/PetDraftContext.tsx`,
`hooks/usePet.ts`, `app/index.tsx`, `app/(create)/look.tsx`, `name.tsx`, `meet.tsx`,
`app/(auth)/login.tsx`, `app/(tabs)/profile.tsx`, `components/pet/LookCard.tsx`,
`PetPortrait.tsx`, `lib/analytics.ts` (property comments); deleted: `components/pet/PetImage.tsx`,
`lib/petArt.ts`, `assets/pets/`.
**Changes:** R6, R7; the Step A event property changes. The Look screen still looks as it does
today, but each card is drawn by `PetArt` and Continue saves the look's appearance.
**Verify:** Simulator: a fresh install through Create and Save, and a phone holding an old
draft (convert, not drop); every screen with a pet; Profile's head crop; mobile tests;
`check:events`; then `local-review`.

**Verified (A2 and A3), 2026-10-01:** contract 25, web 135 (the route refuses each Plus option
from a free account, a look that isn't its appearance, dog ears on a cat; a customized pet saves
with no look and is recorded as `custom`), mobile 256 (an old draft converts; a customized pet
is no look); a test holds the migration's backfill to `LOOKS`. A replay on a throwaway Postgres:
every look's recipe backfilled, an unknown look rolls the whole migration back, zero drift,
`check:rls` green, the pet store suite green. The runtime-role suite needs Postgres 16+ (it
uses `GRANT … WITH INHERIT`); the local Homebrew one is 15, so it runs in CI or against the
Supabase stack. Typecheck, lint, format, events, standards, store, secrets, web build.

**Then M5** ([m5-home-core-loop-plan.md](m5-home-core-loop-plan.md)) unless Mert reorders.

## Step C — The screens · done 2026-10-01, checked by Mert

Built in the order C3 → C1 → C2 → C4, so no card ever led to a screen that didn't exist yet. Each
registered its events first.

- **C1 — Start** (`app/(create)/start.tsx`): the two cards and the Cat / Dog control; the Make
  your own card cycles four built pets (fixed showcase recipes, free options only) with a fur
  swatch column and two chips that follow; still under Reduce Motion. Welcome's "Meet your
  pet" opens it; Look's Back returns to it. The onboarding shell's button became optional.
- **C2 — Choose a friend** (`app/(create)/look.tsx`, `components/pet/LookCard.tsx`): retitled,
  the pets at 150pt, the Plus pill, and a secondary **Customize** beside Continue (the shell
  gained an optional second button), opening Make your own with the selected look.
- **C3 — Make your own** (`app/(create)/build.tsx`, `components/pet/AttributeOptions.tsx`): the
  night stage, Surprise me, six tabs (`SegmentedControl` gained a dense size), swatches and
  chips with locks on Plus options, the 700ms happy flash, species switching through
  `withSpecies`. Opened blank (a random free pet) from Start unless a pet is already being
  built; kept as it is from Customize, Back from Name, or a relaunch.
- **C4 — Name ideas** (`app/(create)/name.tsx`): the pet at 200pt, a "6/20" counter inside the
  field (`TextInputField` gained a `trailing` slot), three ideas from `nameIdeas` with a dice for
  a different three, the happy flash on a pick; `pet_name_submitted` gains `from_idea`.
- **The draft** gained the `start` and `build` steps and a `path` (`choose` | `build`, older
  drafts read as `choose`), so Name's Back returns to where the pet was made.

**Verify:** each screen against its canvas export on the Simulator, light and dark sky; VoiceOver
(tablist, radio groups, swatch names, "Plus option"); reduced motion; the events in the logger.

## Risks

- **A migration that rewrites rows.** The backfill must cover every look id; the migration fails
  rather than leave a pet without an appearance (NOT NULL is set last, inside the transaction).
- **Premium honesty.** A Plus option saved without Plus is a free upgrade. The server checks
  `usesPremium` on every save, and a test sends each Plus option from a free account.
- **Drafts on phones.** An old draft must convert, or someone mid-Create loses their pet.
- **SVG cost.** A 2 × 2 grid and a builder that redraws on every tap: `PetArt` is memoized and
  `petParts` is pure; check scrolling and tapping on the iPhone, not only the Simulator.
