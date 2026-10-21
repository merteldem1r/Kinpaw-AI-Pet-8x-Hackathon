# Pet looks v2 — plan

Requirements: [`v2-pet-looks-requirements.md`](v2-pet-looks-requirements.md). One phase at a
time; each ends with the gates (`local-review`), a check by eye in the Simulator, and Mert's
go before the next one.

**Working beside the memory session (2026-10-03).** It has `apps/web/src/server/talk/*`
(including `prompt.ts`), `packages/contract/index.ts` and `src/v1/memory.ts` open. This plan
edits none of them: `describeAppearance` keeps its signature, so the prompt picks up the
richer description untouched, and `index.ts` already re-exports `appearance.ts` whole (check
with `git diff` before Phase 3 if a new export is needed). Shared docs
(`updates/v2.md`, `ideas.md`) get small, separate edits.

## Phase 1 — renderer groundwork (no visible change)

**Done 2026-10-03.** As planned, with one change: a shape is `{ kind, attrs }`, so each
renderer passes `attrs` straight through. Checked: the website's markup for 128 pets (the
8 looks and 120 random ones, Plus options included) in all 4 moods was rendered before and
after, flattened to shapes with their effective attributes, and is identical, apart from
the clip around patterns. Gates green (typecheck, lint, format, secrets, template, standards,
events, env, store, the mobile, web, contract and brand suites, web build), apart from the
two `check-standards.test.mjs` tests that fail on this Mac's pipes (see
`docs/memory/local-checks-and-traps.md`). Still to do: a look in the Simulator.

**Files:**

- `packages/brand/src/art.ts`: `FurArt` gains `belly` and `patch` (and keeps `dark`); the
  values reproduce today's (cream: `bellyOnCream`, `patchOnCream`; others: `belly`, `white`).
  `FurArt`'s keys come from the contract's `FurId`, not a written-out union.
- `packages/brand/src/pet.ts`: `petParts` reads those properties instead of
  `a.fur === 'cream'`; it gains `silhouette` (the body, shoulders and head shapes, for the clip).
- `packages/brand/src/petDrawing.ts` (new): `petDrawing(parts)` → `{ clip, layers }`, an
  ordered list of `Shape` (`{ kind: 'ellipse' | 'circle' | 'path' | 'polygon', …geometry,
fill?, stroke?, strokeWidth?, opacity?, transform?, clipped? }`): sticker edge, tail, body,
  cat ears, head, pattern (clipped), dog ears, belly, muscles, paws, muzzle, nose. Exported
  from `packages/brand` beside `petParts`.
- `apps/mobile/components/pet/PetArt.tsx`: `PetDrawing` maps the list to `react-native-svg`
  elements, with `Defs`/`ClipPath` for the clipped group; `StickerEdge` and `DogEars` go
  (they are in the list now); `Eyes`, `MovingEye` and the mouth stay.
- `apps/web/src/components/pet/PetSvg.tsx`: the same loop over the list in DOM SVG, with a
  `useId()` clip id so several pets on one page don't share a clip.
- `apps/mobile/__tests__/petArt.test.tsx`, `packages/brand/__tests__/petDrawing.test.ts`
  (new): every look and many random pets give a list whose colours are hex and whose clipped
  shapes are only the pattern; the list is the same in every mood; no fur id appears in
  `pet.ts`.

**Verify:** `npm run typecheck`, `npm test`, `npm run lint`; in the Simulator, Choose a friend
(all 8 looks), Make your own (every tab), Home and Pet details look as before; the website's
pets (`npm run web:dev`, the home page device screens) too.

## Phase 2 — more options (no migration)

**Done 2026-10-03.** As planned. Plus: Lynx ears and Ice eyes (Mert, "Decisions" in the
requirements); `pricing.ts` names them. The Tiny body moves the tail 6 left to meet it
(`tail.x`). Checked: the 128 baseline pets from Phase 1 still render identically; a contact
sheet of every new option (headless Chrome over the site's `PetSvg`) was looked at, and Rose
and Bat redrawn once each (Rose looked like Button, Bat like Perky). New tests: every option
of both species in every mood stays inside the view (proved to fail when a shape leaves it),
no two options of an attribute draw the same, the new Plus options are refused from a free
account and the new free ones save. Gates green.

**Files:**

- `packages/contract/src/v1/appearance.ts`: add the ids and options (R5–R8) with labels and
  Plus flags; `NAME_IDEAS` for the three furs; `describeAppearance` reads "ice-blue eyes".
- `packages/brand/src/art.ts`: the three furs' art (base, shade, stripe, belly, patch, dark)
  and the three irises.
- `packages/brand/src/pet.ts`: shapes for Folded, Lynx, Rose, Bat ears, Bobtail and Plume tails,
  the Tiny body (a smaller body oval, head kept, so a head crop still works).
- `apps/mobile/components/pet/AttributeOptions.tsx`: nothing expected (swatches and tiles come
  from the catalog); check that the longer rows scroll.
- Tests: `packages/contract/src/v1/appearance.test.mts` (labels, Plus, random pets valid),
  the brand drawing test (every new option in every mood inside the view).
- Docs: the "Pet art contract" table in `docs/application/UI/kinpaw-screen-spec-v1.md`.

**Verify:** the gates; in the Simulator, each new option on both species in Make your own and
Change look; Surprise me a few times; save a pet with new options and reopen the app (the
server takes the new ids: `POST /api/app/v1/pet`, `PATCH` for Change look).

## Phase 3 — the layered coat

**Done 2026-10-03.** As planned, with these changes:

- The builder shows a tab's two attributes through a small switch in the options card, not as
  two rows (requirements, R15).
- Shapes moved to `packages/brand/src/shapes.ts`; `petParts` builds the coat's `markings` (the
  pattern, then the white markings) and the colours for points (`tail`, `earOuter`,
  `earInner`). The clip reaches 2 units past the silhouette, under the sticker edge, so a
  marking that meets the outline leaves no hairline of coat.
- Start's showcase pets use the new coat (a ginger tabby in socks, a beagle's saddle).
- The database tests: the first appearance backfill (history) is read through the schema's
  conversion; the store test saves and reads back a full coat.

Checked: the 128 baseline pets (old `socks` ones through the conversion) render identically;
contact sheets of every pattern and white marking looked at (Brindle redrawn, the Van hairline
fixed); the builder in the Simulator (Fur tab, the switch, Continue on screen). Migration
`20261003191042_pet_layered_coat` generated by the repo's generator on a throwaway Postgres 17
(two columns, nothing else); there the run-once, the drift check, `check:rls` and the database
suites (33) passed, and an old Tuxedo row converted to `solid` + `socks` with its look kept.
Gates green apart from `web:build`, skipped because it shares `.next` with the running dev
server.

**For Mert, locally:** `npm run db:migrate`, then `npm run db:run-once` (converts saved
`socks` pets), then restart `npm run web:dev` (the new Prisma client).

Events first: run the `events` skill for the `attribute`/`option` values (R-Events), updating
the comment block in `apps/mobile/lib/analytics.ts`.

**Files:**

- `packages/contract/src/v1/appearance.ts`: `PATTERN_IDS` without `socks`, plus `tabby`, `tortie`,
  `points`, `saddle`, `brindle`; `ACCENT_IDS` (`auto` + `FUR_IDS`); `WHITE_IDS` (`none`,
  `mittens`, `socks`, `bicolour`, `van`); `appearanceSchema` with `accent` and `white`
  (defaults `auto`, `none`) and a preprocess turning `pattern: 'socks'` into `solid` +
  `white: 'socks'`; `ATTRIBUTE_KEYS` and `ATTRIBUTES` gain both, each with the tab it shows
  under (`tab: 'fur' | 'pattern' | …`); looks rewritten (Tuxedo, Pepper: `white: 'socks'`);
  `appearanceKey` adds the two; `describeAppearance` names the coat.
- `packages/brand/src/pet.ts`: the pattern layer draws in the accent (or the pattern's own
  colour for `auto`), clipped; the white layer draws over it; Points recolours ears, muzzle
  mask, paws and tail; Saddle, Tabby, Tortie, Brindle shapes.
- `apps/web/prisma/schema/pets.prisma`: `accent String @default("auto")`, `white String
@default("none")`. CI writes the migration.
- `apps/web/prisma/run-once.sql`: `update pets set white = 'socks', pattern = 'solid' where
pattern = 'socks'` (matches nothing on an empty database). Test with `npm run db:run-once`.
- `apps/web/src/server/db/pets.ts` (create, `updateAppearance`, the select),
  `apps/web/src/server/api/pet-wire.ts` (read both; old `socks` rows normalised by the schema).
- `apps/web/src/app/api/app/v1/pet/route.ts`: nothing expected (it validates with the schema and
  `premiumOptionsIn`, which see the new keys); its tests gain a case for each.
- `apps/mobile/components/pet/PetBuilder.tsx`, `AttributeOptions.tsx`: a tab shows every
  attribute under it, one labelled row each; the accent row dimmed for Solid.
- `apps/mobile/lib/petDraft.ts`: nothing expected (the schema's defaults and preprocess read old
  drafts); a test proves an old draft with `socks` still loads.
- Tests: contract (old shapes parse, Plus, looks unchanged by `matchLook`), brand drawing (every
  pattern × accent × white in every mood), the pet route (`accent`, `white` stored and refused
  when Plus), the runtime-role database suite if it lists the pet's columns.
- Docs: the screen spec's "Pet art contract" and "Create · Make your own".

**Verify:** the gates and the database gates (a local replay: drift, `check:rls`, `test:db`);
in the Simulator, an existing pet (Tuxedo) still looks the same after `npm run db:migrate` and
the run-once; build a calico (snow, patches, ginger accent, bicolour) and a Siamese (cream,
points, chocolate accent, blue eyes); save, reopen, Change look.

## Phase 4 — a colour for the paws and chest

**Done 2026-10-03.** As planned. Migration `20261003203000_pet_paws_and_chest_colour` (the one
column), generated on a throwaway Postgres 17, where the drift check, `check:rls` and the
database suites (46) passed. Mocked up first in the site renderer; walked in the Simulator (65
presses, every option of every row, no problems). Found while checking it and fixed: on the Fur
and Pattern tabs (with a row switch) the builder's status line sat under Continue, so a locked
Plus option ("Tortie is a Plus option") said nothing visible. During onboarding the line now
shows above Continue (`OnboardingShell`'s `cta.note`), and the builder has no line of its own
there; Change look keeps its line. Not yet seen in the Simulator after that last change: Metro
was restarted and the app closed while testing.

Events first: the registry comment gains `'trim'` for `attribute`.

**Files:**

- `packages/contract/src/v1/appearance.ts`: `TRIM_IDS` (`white` + fur ids but `snow`), `trim`
  in the schema (default `white`), `ATTRIBUTE_KEYS` (last, so old keys stay a prefix),
  `ATTRIBUTES` (Fur: Main | Pattern | Paws & chest; Pattern: Pattern | Paws & chest), options,
  Surprise me (White half the time, so most surprises stay natural), the description.
- `packages/brand/src/pet.ts`: the white markings in the trim colour; a dark muzzle switches
  the mouth to the light ink and a dog's nose to pink.
- `apps/web/prisma/schema/pets.prisma` (`trim String @default("white")`), the generated
  migration, `server/db/pets.ts`, `server/api/pet-wire.ts`.
- `apps/mobile/components/pet/AttributeOptions.tsx` (trim swatches), `PetBuilder.tsx` (the hint).
- Tests: contract, brand, the route, the store, the draft.

**Verify:** the gates and the database gates; the builder walked through every button again.

## After the build — a test of Make your own (2026-10-03)

Every button driven in the Simulator through Metro's debugger (see
`docs/memory/local-checks-and-traps.md`): all 56 options of the 8 rows, the row switches, Plus
locks, Surprise me ×25, the sky picker, the Solid hint, Continue and Back; recorded and checked
frame by frame. Functionally clean. Fixed:

- **A ghost of the old look on every pick** (Mert saw it on the tail): `PetArt` crossfaded a
  mood by mounting a second whole pet, and iOS briefly drew the freshly mounted one with the
  previous shapes. Now one SVG: the body once, only the face crossfades. Test:
  `petArt.test.tsx`, "never by drawing a second pet".
- **Heavy taps** (dev build, React render time per tap: median 70 ms, worst 183 ms → median
  17 ms, worst 45 ms): `PetDrawing` memoized by appearance value (preview tiles skip), `SkyScene`
  memoized, the builder's tab bar and sky picker memoized, the build screen's draft-reading part
  split from its shell, a draft-actions context (Welcome no longer redraws on draft changes),
  Start's body memoized on the species, and Start's showcase paused while covered (it drew a new
  pet every 1.7 s under the builder).
- **A blurred preview tile after a pick** (Mert, 2026-10-03): the picked tile popped to 108 % and
  the press shrank it to 98 %; iOS stretches a scaled view's drawn content (the pet's SVG) as a
  bitmap, so it stayed soft until the spring settled (0.5–1 s). Now only the tile's frame
  (ground, border, glow) pops and the press doesn't scale the tile; the pet stays sharp
  (checked frame by frame).

## Risks

- **Old clients.** The app's strict schema would reject a pet response carrying `accent` and
  `white` from a build older than Phase 3. Localhost only today, so the app and server move
  together; before a store build exists this is fine, after it the `v1` rule applies.
- **The `socks` conversion.** Touches every saved Tuxedo-like pet; the read-side normalisation
  means a missed row still draws correctly. Reversible: the inverse update.
- **Entitlement.** New Plus options must be in `premiumOptionsIn`, or a free account saves a
  Plus look. The route test covers each one.
- **Visual drift in Phase 1.** Clipping can trim a stripe's rounded end at the body's edge;
  checked by eye, accepted if cleaner.
- **The talk prompt** gets a longer description of the pet through `describeAppearance`; no
  change to the memory session's files.
