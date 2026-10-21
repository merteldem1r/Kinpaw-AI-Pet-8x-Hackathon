# M4: Save your pet — plan

> Requirements: [m4-save-your-pet-requirements.md](m4-save-your-pet-requirements.md). Written
> 2026-10-01. The v1 / later split was agreed with Mert on 2026-10-01.

The schema lands before the code that reads it, the events before the screens that fire them.
Each phase leaves the gates green.

## Phase 1 — Events

**Files:** `apps/mobile/lib/analytics.ts`; `apps/web/src/lib/analytics/events.ts`.
**Changes:** `pet_save_viewed` and `pet_save_failed` in the mobile registry; `pet_created` in
the web registry (so `recordUserEvent` accepts it), each with its Step 2 comment.
**Verify:** `npm run check:events`.

## Phase 2 — The `pets` table

**Files:** new `apps/web/prisma/schema/pets.prisma` (`Pet`), `accounts.prisma` (the `Profile`
relation); new `apps/web/src/server/db/pets.ts` (`petStore`: `get(userId)`, `create(userId,
input)` returning created / existing / conflict), new `pets.test.mts` (database suite).
**Changes:** R1. The migration is CI's (generated), plus the hand-written security migration
named one step after it, as `docs/rules/migrations.md` describes. Locally: apply with
`npm run db:migrate` after generating the migration with the same replay CI uses.
**Verify:** `npm run typecheck`; the database suite against the local stack (`test:db`):
own pet only, create once, retry returns the same pet, a second pet for the same owner is
refused, deleting the user deletes the pet; `npm run check:rls`.

## Phase 3 — Contract and routes

**Files:** `packages/contract/src/v1/pets.ts` (pet, create body, responses),
`packages/contract/src/v1/endpoints.ts` (`getPet`, `createPet`), contract tests; new
`apps/web/src/app/api/app/v1/pet/route.ts` and its route test.
**Changes:** R2–R4: validation from the catalog, the premium-look check against the server's
profile (`plan_type`), `pet_created` recorded first-party on a real create.
**Verify:** contract and route tests (unauthenticated 401, invalid body 400, premium look on a free account 400, create 201, retry 200, existing pet 200 with `existing: true`);
`npm run web:build`; `curl` against `npm run web:dev` with a local session token.

## Phase 4 — The gate and saving

**Files:** new `apps/mobile/hooks/usePet.ts` (query and save mutation);
`apps/mobile/app/_layout.tsx` (the gate); `apps/mobile/contexts/PetDraftContext.tsx` (save and
clear); delete `apps/mobile/app/(onboarding)/`.
**Changes:** R5–R7.
**Verify:** Simulator: a new pet saves after sign-in and the stack is replaced; sign out and
in again lands on My pet; with the web server stopped, the save fails, the draft stays, "Try
again" works once it is back; an account that already has a pet keeps it and says so.

## Phase 5 — The Save screen and Welcome back

**Files:** `apps/mobile/app/(auth)/login.tsx` (layout rebuilt, logic kept); new
`apps/mobile/components/auth/` parts as the screen needs them (sheet, top bar, resend pill).
**Changes:** R8–R10, every state in the spec's table, `pet_save_viewed`.
**Verify:** the click-paths for both modes on the Simulator, light and dark sky; wrong code
shakes and turns Mochi sad; the sixth digit auto-verifies; resend counts down; VoiceOver
labels; `check:store` (no hidden features, Terms and Privacy linked).

## Phase 6 — Profile's pet row

**Files:** `apps/mobile/app/(tabs)/profile.tsx`.
**Changes:** R11.
**Verify:** Simulator; then the full `local-review`.

## Risks

- **The gate is load-bearing.** A wrong state strands a signed-in person on the splash or
  shows Create to someone with a pet. The gate's states are listed in R5 and each is checked.
- **A new user-owned table.** Without the security migration, anyone with the app's public
  key could read pets; `check:rls` guards it.
- **Two sources of truth for a moment.** Between sign-in and the save, the pet is on the phone
  and not the server; the draft is cleared only after the server answers.
- **No money or entitlement write.** The premium-look check reads `plan_type`; it never
  writes it.
