# Your pet from a photo — plan

Requirements: [`v2-pet-from-photo-requirements.md`](v2-pet-from-photo-requirements.md). One phase
at a time; each ends with the gates (`local-review`), a check in the Simulator where there is
something to see, and Mert's go before the next one.

**Working beside two other sessions (2026-10-04).** Memory (`feat/v2-long-term-memory-update`)
edits `server/talk/*`, the after-sign-in flow and the pet's page; notifications
(`feat/v2-notifications`) edits `app.json`, Settings, `privacy.tsx`, `_layout.tsx` and Home.
This plan touches none of those except `privacy.tsx` (one paragraph, Phase 5) and the two event
registries (additions only, in their own blocks). No native rebuild.

## Phase 1 — Contract, events, table, env

**Done 2026-10-04.** As planned, with three changes: the routes are `/pet/photo/read` and
`/pet/photo/redo` (the contract's test allows no hyphen in a path); the contract test that keeps
every route but the config signed-in now names `readPetPhoto` as the second public one; and
Points becomes plain Solid (a Solid coat has no markings, so a marking colour did nothing).
Migrations `20261004193827_pet_photo_reads` and `_security`, generated on a replay; Mert applied
them locally.

**Files:**

- `packages/contract/src/v1/photo.ts` (new): the read endpoints' bodies and responses
  (`photoReadBody`: `image` base64 JPEG/PNG/WebP up to 3 MB (8 MB until 2026-10-05, R24), `install_id` uuid, `time_zone` for
  redo; `photoReadResponse`: R12), `PHOTO_OUTCOMES`, `FREE_NEAREST` (R11) and
  `freeVersionOf(appearance)` → `{ appearance, swapped }`, `PHOTO_TRIES_SIGNED_OUT = 2`,
  `PHOTO_REDOS_PER_DAY = 1`.
- `packages/contract/src/v1/photo.test.mts` (new): every Plus option has a free nearest;
  `freeVersionOf` of every Plus look is free and valid; free appearances come back unchanged.
- `packages/contract/src/v1/endpoints.ts`: `readPetPhoto` (`POST /api/app/v1/pet/photo/read`,
  `public`) and `redoPetPhoto` (`POST /api/app/v1/pet/photo/redo`, `user`).
- `apps/mobile/lib/analytics.ts`, `apps/web/src/lib/analytics/events.ts`: the events in the
  requirements, with the `events` skill; `PHOTO_EVENTS` on the web.
- `apps/mobile/lib/paywall.ts`: `photo_redo` in `PAYWALL_TRIGGERS`.
- `apps/web/prisma/schema/photo.prisma` (new): `PetPhotoRead` → `pet_photo_reads`: `id`,
  `device_hash` (nullable), `ip_hash`, `user_id` (nullable, set null on delete), `context`
  (`create` | `redo`), `local_day` (date), `outcome` (`pending` | `read` | `no_pet` |
  `several` | `unclear`), `created_at`; indexes on `device_hash`, `(ip_hash, created_at)`,
  `(user_id, local_day)`, `created_at`. RLS on, no policies (the one hand-written statement).
- `apps/web/src/lib/env.ts`, `apps/web/.env.example`: `FAL_KEY`, `PHOTO_MODEL` (optional,
  default `google/gemini-2.5-flash`), `PHOTO_HASH_SECRET`, `PHOTO_DAILY_CAP` (optional, 300).
- `apps/web/package.json`: `sharp` as a direct dependency (today only Next's optional one).

**Verify:** `npm run typecheck`, `check:events`, `check:env`, the contract suite;
`npm run db:migrate` applies the table locally; `check:rls`.

## Phase 2 — The server read

**Done 2026-10-04.** fal's synchronous endpoint takes the photo inline as a data URI, so nothing
is uploaded (the first risk below is cleared): about 2 s and 3,000 tokens (about $0.001) a read.
Built as planned, plus: `hash.ts` (keyed hashes, the client IP), `respond.ts` (one response and
event mapping for both routes), the limits store in `src/server/db/photo-reads.ts` (stores live
there), two error codes (`payload_too_large` 413, `photo_unavailable` 503), and the test kit now
sends a `Content-Length` like the phone. A creation read is always anonymous (the route is
public). The script is `npm run photo:check --workspace=@app/web -- <photos or folder>`.
Tests: answer, prompt, image (metadata stripped, upright, refused formats), fal (inline photo,
retry, failures), the flow, both routes and PATCH's species rule, and the limits store on a real
database (concurrency, abandoned reads, network and app caps, Plus by local day).

**Files (new, `apps/web/src/server/photo/`):**

- `catalog-prompt.ts`: the visual description of every option (keyed by the catalog's ids, so
  a missing one fails typecheck), the breed examples, and `buildPhotoMessages()`.
- `answer-schema.ts`: the answer's Zod schema, generated from the catalog's id lists plus
  `unseen`; `fillUnseen()` (R10).
- `reader.ts`: the `PhotoReader` interface (`read(image) → PhotoReadResult`, never throws,
  failures `unavailable` | `invalid`), like `ReplyProvider`.
- `fal.ts`: the fal provider: `POST https://fal.run/openrouter/router/vision` with
  `Authorization: Key …`, the model, the prompt, the image as a data URI, a 15 s timeout, one
  retry on an unusable answer when the first came back within 6 s. Logs status and reason only.
- `stub.ts`: deterministic answers by a marker in the image (for tests), a tuxedo cat by
  default in development.
- `provider.ts`: fal when `FAL_KEY` is set; the stub in development and tests; null in
  production.
- `prepare-image.ts`: `sharp` decode (JPEG/PNG/WebP only), rotate by EXIF, resize to 1024 px,
  re-encode JPEG 80, metadata dropped; rejects anything else.
- `limits.ts`: HMAC hashing; inside one transaction with an advisory lock on the device (or
  user) hash: count counted + pending rows for the device (create, ever), the IP (today), the
  user (redo, local day) and everything (UTC today); reserve a `pending` row or answer
  `limit_reached`. `settle(id, outcome)` and `release(id)`.
- `read-photo.ts`: the flow: limits → prepare → reader → fill and check → swap (create, or
  redo for a non-Plus account, which shouldn't happen) → settle → `ai_usage` row
  (`provider: fal`) → result. `appearanceSchema` is the last check.
- Tests beside each: the answer schema accepts a full answer and refuses an invented id; unseen
  defaults are valid for both species; swap lists every change; limits (2nd read ok, 3rd
  refused; a released try doesn't count; two at once only one passes; IP and app-wide caps;
  Plus 1 a day by local day); prepare strips metadata and refuses a text file; the flow
  against the stub for each verdict.

**Routes:**

- `apps/web/src/app/api/app/v1/pet/photo/read/route.ts`: public; reads the client IP from
  `x-forwarded-for` (or `local`); refuses a `content-length` over 9 MB before the body is read;
  records `pet_photo_read` first-party with a null user. 503 `not_configured` /
  `photo_unavailable`, 429-shaped `limit_reached` as a 200 outcome (the app shows it), 400 for a
  bad image.
- `apps/web/src/app/api/app/v1/pet/photo/redo/route.ts`: `user`; Plus from
  `profileStore` or a 200 `limit_reached`-style `plus_required`; one a local day.
- `apps/web/src/app/api/app/v1/pet/route.ts` (PATCH): a species change is allowed when the
  account is Plus (R28); still refused for free.
- `apps/web/src/server/api/app-route.ts`: an optional `maxBodyBytes` on the endpoint, checked
  against `content-length` before `req.json()`.

**Script:** `scripts/photo-read.mts <image>`: runs one image through the real fal provider and
prints the verdict, the `seen` text and the appearance, for Mert to try his own photos before
any screen exists.

**Verify:** the web suite and `test:db`; `curl` the route with a photo against the stub and,
with `FAL_KEY`, against fal; the script on 5–10 of Mert's photos, results shown to Mert.

## Phase 3 — Create: Start, sheet, reading, reveal, errors

**Done 2026-10-05**, checked on the Simulator against fal (agent-driven: buttons pressed through
Metro's debugger, the photo handed to the sheet as the picker would). Start (both cards; Make
your own unchanged), the sheet, reading (sweep, breathing glow), the reveal (bottom-up, then the
stage slides up), That's them → Name (`path: photo`, species from the photo), Adjust → builder
with the photo and note, no pet with 1 try left → New photo → out of tries, Start "Used" after a
relaunch, our failure using no try, the G1 note (a calico read as Patches → ginger and white).
Server checked directly: a non-photo 400, extra fields 400, 8 MB+ 413, the 7th read on a network
refused; the table holds hashes only. Found and fixed while testing: "Try another photo" didn't
fit beside Make your own (now "New photo"); the stage jumped at the reveal (now slides); the
swap note read "Your pet looks Patches" (now "has"); a remounted screen read the photo again
(the read is kept with the photo now, so it never is) and the reveal could wait forever on an
animation callback (it ends on a timer now). Not done: the picker's temporary copy is left to
iOS's cache cleanup (deleting it needs expo-file-system, a native module), and Reduce Motion
and VoiceOver are Phase 5.

**Files:**

- `apps/mobile/lib/installId.ts` (new): the Keychain install id (`expo-secure-store`), and the
  local tries-left hint (the server is the authority).
- `apps/mobile/lib/pickPetPhoto.ts` (new): the picker (library or camera, JPEG, compressed,
  `preferredAssetRepresentationMode: compatible`), base64 read, size check.
- `apps/mobile/hooks/usePhotoRead.ts` (new): the mutation to `readPetPhoto` with a 25 s
  timeout; maps outcomes and failures.
- `apps/mobile/components/pet/PhotoSheet.tsx` (new): B1.
- `apps/mobile/components/pet/PhotoPolaroid.tsx` (new): the photo in a polaroid, with the
  sweep (reduced motion: still).
- `apps/mobile/app/(create)/photo.tsx` (new): one route with three states: reading (C2),
  the reveal (D1, with chips and the G1 note), not found / out of tries / our failure (E2).
- `apps/mobile/app/(create)/start.tsx`: the From a photo card (A1) first; Make your own
  unchanged; Choose a friend removed; the "Used" state.
- `apps/mobile/app/(create)/build.tsx`, `components/pet/PetBuilder.tsx`: an optional photo
  thumbnail on the stage and the "Made from your photo" note (`from: 'photo'`).
- `apps/mobile/lib/petDraft.ts`, `lib/createFlow.ts`: `path: 'photo'`, `'choose'` → `'build'`,
  `step: 'look'` resumes on build, `'photo'` step; `pet_photo_kept` fired on reaching Name with
  `changed_count`.
- `apps/mobile/app/(create)/look.tsx`: deleted; its events marked retired in the registry
  comment (kept in the union until the dashboard no longer reads them).
- Tests: draft migration (old `choose` and `look`), the changed count, the outcome mapping.

**Verify:** in the Simulator, signed out: both cards; the sheet; a library photo through the
stub → reveal → That's them → Name; Adjust → builder with the thumbnail; a stub "no pet" →
E2 with 1 try left; the third read → out of tries, Start shows Used; airplane mode → R17 and
no try used; delete and reinstall the app → still out of tries. Then with `FAL_KEY` on the
iPhone with real photos.

## Phase 4 — Redo from a photo (Plus)

**Done 2026-10-05**, checked on the Simulator with a local test account (`photo-test@example.test`,
made Plus by a local `plan_type` update). Built as `components/pet/RedoFromPhoto.tsx` (the row,
the sheet, the inline reading, the species dialog) so Change look stays small, `lib/photoRedo.ts`
(the "used today" hint) and `withCoatOf` in `lib/petPhoto.ts` ("Keep {name} a cat"). Checked:
free → the row with a Plus pill opens the paywall (`photo_redo`); Plus → "1 left today", the
sheet without tries, "Drawing Mochi…", a cat photo on a dog asks "This looks like a cat",
"Turn Mochi into a cat" puts the calico (Plus Patches kept) in the editor unsaved with the photo,
Save → PATCH 200 and the pet is a cat with its name kept; the row then says "Used today" (after a
relaunch too) and a second tap explains. One redo row, by account, no device hash. Found and
fixed: the photo screen's route param was named `state`, which React Navigation reserves (now
`tries=none`). "Keep {name} a dog" is covered by a unit test, not tried live (one redo a day).

**Files:**

- `apps/mobile/app/change-look.tsx`: the F1 row (Plus pill and paywall for free; "1 left
  today" / "Used today" for Plus), the sheet, reading state inline over the stage, the result
  in the editor unsaved, the species dialog (R28), Save as today (sends the species when
  switched).
- `apps/mobile/hooks/usePhotoRead.ts`: the redo call with the time zone.
- Tests: the species dialog's "keep" applies only the coat and eyes.

**Verify:** free account → paywall with `photo_redo`; grant Plus in `/admin/users` → one redo,
second refused; a dog photo on a cat → both dialog choices; Save; reopen the app, the look is
kept; a free account's PATCH with another species is still refused (test).

## Phase 5 — Finish

**Done 2026-10-05.** Privacy (app and site) names Gemini through fal.ai and says Kinpaw never
saves the photo (not what fal keeps, which we don't control). The paywall lists "Redo {name}'s
look from a photo". VoiceOver labels on the photo, the reading state, the reveal and the chips.
Store review (strict `check:store` 8/8) found one blocker, fixed: the sheet now names the AI and
asks explicit permission before the first photo (Apple 5.1.2(i)). Docs: the screen spec (Start,
From a photo, Change look, paywall triggers), product.md, roadmap, `updates/v2.md`, and the
launch leftovers in `ideas.md` (the camera purpose string at the next rebuild, App Attest, the
picker's temporary file, Groq's consent, the privacy labels). Not checked on a device: the
permission step's look, Reduce Motion and VoiceOver; Mert checks on the iPhone.

- Accessibility: VoiceOver labels on the cards, the sheet rows, the reading state ("Reading
  your photo"), the reveal ("Your pet, drawn from your photo: charcoal, socks and bib, green
  eyes"), the chips; Dynamic Type on the reveal; 44 pt targets.
- `apps/mobile/app/privacy.tsx`: R31 (coordinate with the notifications branch, which edits
  the same page).
- `store-review` skill: the AI disclosure before sending (5.1.2), the camera purpose string,
  nothing hidden from review.
- Docs: the screen spec (Start, the new photo screen, Change look), product.md (v2 decisions),
  roadmap, `updates/v2.md`, `ideas.md` (App Attest at launch), `docs/memory/` if a trap is
  found.

**Verify:** `local-review` green; the full click-path on the iPhone.

## Risks

- **fal's vision endpoint and data URIs.** The docs show image URLs. If a data URI is refused,
  the fallback is fal's own upload (a temporary file on fal's CDN), which weakens "never
  stored". Checked first in Phase 2 with the script; if refused, Mert decides before going on.
- **No JSON schema enforcement on fal's endpoint.** The answer is asked for as JSON and checked
  by Zod with one retry; a model that drifts shows up as `invalid` reads in `ai_usage`.
- **Accuracy without a model check.** Mert skipped the comparison; the Phase 2 script on his
  photos is the only check before screens. `pet_photo_kept.changed_count` measures it in use.
- **A public route that costs money.** The limits (R19–R25) and fal's spending cap bound it;
  install ids can be faked, so the per-network and app-wide caps are the real ones until App
  Attest.
- **Entitlement:** the redo route and the PATCH species change decide Plus on the server
  (non-negotiable 3); both diffs reviewed twice.
- **Removing Choose a friend** changes the onboarding funnel: `pet_look_selected` stops firing
  and the 2 Plus looks lose their onboarding showcase.
- **Merges:** the two event registries and `privacy.tsx` are shared with the other sessions;
  additions are kept in their own blocks.
