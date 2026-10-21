# M7: Kinpaw Plus, Profile and Settings — plan

> Requirements: [m7-plus-profile-settings-requirements.md](m7-plus-profile-settings-requirements.md).
> Each phase is shown to Mert and confirmed before the next. No migration: `premium_grants`
> already exists. Phase 5 depends on open question 1.

## Phase 1 — The admin grant (web) · done 2026-10-02, checked by Mert (grant, unlimited talking, revoke, the database rows)

> **As built.** Decided with Mert: revoking is audited too, so `premium_grants` gained `action`
> ('grant' | 'revoke', default 'grant'): the generated migration
> `20261002131125_premium_grants_action` (one `ADD COLUMN … DEFAULT 'grant'`, safe on existing
> rows). `profileStore.grantPremium` / `revokeGrant` write the profile and the audit row in one
> transaction, each decided by a conditional update (two grants at once write one; a revoke
> matches only `premium_source = 'grant'`). `users/actions.ts` (`grantPlus`, `revokePlus`:
> `requireAdmin()` first, Zod, Pino with ids only) and `users/PlanControls.tsx` (Grant with an
> optional reason, Revoke with a confirm step; nothing for a store subscription). The Plan
> column now shows the dashboard's bucket (`bucketFor`). Tests: the database suite in
> `profiles.test.mts`. Not built: a guard test for the actions (they need a Next request
> context for `cookies()`, and the web tests have no module mocking); each action's first line
> is `requireAdmin()`.

**Files:** `apps/web/src/server/db/profiles.ts` (`grantPremium`, `revokeGrant`; a
`premium_grants` insert and the profile write in one transaction, via Prisma);
`apps/web/src/server/db/profiles.test.mts` (database suite: grant writes both, a second grant
is a no-op, revoke only undoes a grant, a store subscription is never revoked);
new `apps/web/src/app/admin/(protected)/users/actions.ts` (server actions, `requireAdmin()`
first, Zod on the input, `revalidatePath`); `apps/web/src/app/admin/(protected)/users/page.tsx`
(the bucket column from `bucketFor`, a Grant / Revoke button per row, a confirm on revoke, an
optional reason); a guard test that the actions refuse a non-admin.
**Changes:** R1–R4. Run the `admin` skill for the screen's conventions.
**Verify:** sign in to `/admin` locally; grant Plus to Mert's account; Supabase Studio shows the
`premium_grants` row and `plan_type = premium`, `premium_source = grant`; the overview counts it
as granted, not paid; revoke returns it to free. `npm run typecheck`, `lint`, `test`,
`test:db` (local replay, `local-review`).

## Phase 2 — The app reads Plus from the server · done 2026-10-02, checked by Mert (the lock goes after a grant)

> **As built.** `hooks/usePlus.ts`: the server's plan or RevenueCat's entitlement, the one place
> the app decides Plus (Home and the paywall use it; the paywall no longer reads RevenueCat's
> `isPremium` directly). `useProfile` exports `PROFILE_QUERY_KEY` and refetches on every return
> to the app (`refetchOnWindowFocus: 'always'`); Home re-reads the plan on focus, when the
> server answers "talked out" (the app may still think Plus after a revoke), and before a
> locked mic opens the paywall (with Plus by then, the lock just goes). With Plus the mic gets
> `messagesLeft = null`: no count, no lock. Closing the paywall invalidates the profile. No
> unit test for `usePlus` (a one-line OR; the mobile suites test pure logic, not hooks).

**Files:** new `apps/mobile/hooks/usePlus.ts` (R5); `apps/mobile/hooks/useProfile.ts`
(`refetchOnWindowFocus`, already driven by `lib/queryClient.ts`'s `focusManager`, and a
refetch on Home focus); `apps/mobile/app/(tabs)/index.tsx` and
`components/pet/TalkControls.tsx` (with Plus: no count, no lock; a locked press refetches the
profile before opening the paywall); `apps/mobile/app/upgrade.tsx` (refetch on close);
tests for `usePlus`.
**Changes:** R5–R7.
**Verify:** on the Simulator, a free account at 0 messages (Studio) sees the lock; grant in the
admin, return to the app: the lock is gone and talking works past 10; revoke, return: the count
is back after the next reply and the server refuses the 11th.

## Phase 3 — The paywall restyle · done 2026-10-02, checked by Mert

> **As built.** Events first: `upgrade_page_viewed { trigger }` and `upgrade_tapped`'s
> `profile_panel` / `locked_look` sources in the mobile registry. `lib/paywall.ts` holds the
> triggers and `paywallTrigger()` (unknown param → `'unknown'`, tested in
> `__tests__/paywallTrigger.test.ts`); `lib/openPaywall.ts` tracks `upgrade_tapped` and pushes
> `/upgrade?trigger=…` (Home's locked mic uses it). `app/upgrade.tsx`: the pet happy at 120pt
> on the glow (a sparkle chip if there is no pet), "More time with {name}" / "Kinpaw Plus", two
> features from `plusFeatures(name)` (exported for Profile's panel; no "Room for more pets");
> the Plus state "You have Kinpaw Plus", whose "Manage in App Store" shows only for a store
> subscription, not a grant. Every store element is unchanged. `store-review`: the paywall's
> "Plus looks" promise is only true once Phase 5 (Change look) lands, so M7 doesn't ship
> before it. The file is 566 lines, mostly the template's purchase flow; split later if it
> grows.

**Files:** `apps/mobile/lib/analytics.ts` first (`upgrade_page_viewed { trigger }`,
`upgrade_tapped` sources; the `events` skill); `apps/mobile/app/upgrade.tsx` (header with
`PetArt` on `Glow`, "More time with {name}", Kinpaw's features, the `trigger` param, the Plus
state of R11), split into `components/paywall/` if it grows past the file-size rule;
`app/(tabs)/index.tsx` (`trigger: talk_limit`).
**Changes:** R8–R11.
**Verify:** open from the locked mic: the pet, its name, two features, placeholder plans with
their pills, Restore, Terms, Privacy, the auto-renew text; as Plus: "You have Kinpaw Plus".
`npm run check:store` and the `store-review` skill (paywall rules).

## Phase 4 — Profile's Plus panel and Settings' manage row · done 2026-10-02, checked by Mert

> **As built.** `manage_subscription_tapped` registered first. `plusFeatures` moved out of the
> paywall route into `components/plus/plusFeatures.ts` (the paywall and the panel share it);
> the panel is `components/plus/PlusPanel.tsx` (not `components/profile/`, beside its
> features): free, a hero card with the features and "See plans" (`openPaywall('profile_panel')`);
> Plus, a selected card with a "Plus member" pill and no button. Profile shows it between you
> and your pet. Settings' Account section gets "Manage subscription" (→ the store's
> subscriptions page) only when RevenueCat reports an entitlement, so never for a grant (and so
> never locally, where RevenueCat is unconfigured).

**Files:** `apps/mobile/lib/analytics.ts` (`manage_subscription_tapped`);
`apps/mobile/app/(tabs)/profile.tsx` (the panel, R12; a new small `components/profile/PlusPanel.tsx`);
`apps/mobile/app/(tabs)/settings.tsx` (R13, the row only for a RevenueCat subscription); the
stale "M7 adds…" comments in both.
**Changes:** R12–R13.
**Verify:** free: the panel and "See plans" opens the paywall with `profile_panel`; granted:
"Plus member", and no manage row in Settings (it is a grant).

## Phase 5 — Change look · done 2026-10-02, checked by Mert (Plus looks picked and saved)

> **As built.** Contract: `updatePet` (`PATCH /api/app/v1/pet`, body `{ appearance }` strict,
> response `{ pet }`). Route: 404 without a pet; 400 for another species (a pet keeps its
> species) or for a Plus option from a free account (the same check as creation, now one helper
> `refusePlusOptionsUnlessPremium`); `look_id` is worked out on the server with `matchLook`.
> Store: `petStore.updateAppearance` writes the six attributes by name, never species or needs.
> Tests: 4 route tests, 1 contract test. App: events first (`pet_look_change_opened`,
> `pet_look_changed`; `pet_option_locked_tapped` with `during_onboarding: false`); the builder's
> stage, tabs and options moved into `components/pet/PetBuilder.tsx`, shared by onboarding's
> `build.tsx` (260 → 107 lines, same behaviour) and the new `app/change-look.tsx` (a pushed
> screen: the pet's own look, Save, Undo changes; a free Plus option opens the paywall with
> `locked_look`; Plus members see Plus options unlocked, `AttributeOptions`' new `unlocked`, and
> Surprise me may pick them). Pet details' Looks card has "Change look". No database test for
> `updateAppearance` (a single `updateMany`; the route tests cover its use).

**Files:** `packages/contract` (`updatePet` endpoint: appearance only); new `PATCH` in
`apps/web/src/app/api/app/v1/pet/route.ts` + `petStore.updateAppearance` (the same Plus check
as creation: `premiumOptionsIn` and `isPremium`), with route tests;
`apps/mobile/lib/analytics.ts` (`pet_look_changed`, `pet_option_locked_tapped` from details);
`apps/mobile/app/pet/[id].tsx` ("Change look"); the builder (`app/(create)/build.tsx` and
`components/pet/AttributeOptions.tsx`) reused in an edit mode that starts from the pet, saves
through the new route, and opens the paywall on a locked option.
**Changes:** R14–R15. The `v1` contract only grows (a new endpoint), so no old client breaks.
**Verify:** free: a Plus option opens the paywall; a free option saves and Home shows the new
look; granted: Calico saves; a free account sending Calico by hand gets the 400.

## Phase 6 — Docs and gates · done 2026-10-02

> **As built.** `local-review`: every CI gate passes but two, both environmental and known
> ([local-checks-and-traps](../../memory/local-checks-and-traps.md)): `check-standards.test.mjs`
> (macOS cuts the CLI's JSON at 8 KB; `check:standards` itself passes) and the runtime-role
> database suite (Postgres 15 here has no `WITH INHERIT`; CI runs 17). `web:build` was left to
> Mert (his dev server shares `.next`). `store-review`: an OTA update (no native change), SHIP
> for the paywall rules once Phase 5 made the "Plus looks" promise true. Docs: the roadmap, the
> product doc, the screen spec's Paywall, You and Pet details sections, the monetization memory.

**Files:** `docs/application/roadmap.md` (M7 status, drop "Auto follows the sky"),
`docs/application/product.md` (open question 2's answer), the screen spec's Paywall and You
sections (what was built), `docs/memory/monetization-v1.md` (the grant as built), this plan's
"as built" notes.
**Verify:** the `local-review` skill: every CI gate, the database replay, and `store-review`.

## Risks

- **Entitlement (non-negotiable 3).** Phase 1 writes `plan_type` and `premium_*`: only through
  `profileStore`, only after `requireAdmin()`, reviewed twice. A revoke must never undo a real
  subscription (R2), tested.
- **The dashboard's numbers.** A grant must stay `granted`, not paid; `bucketFor` already does
  this, and Phase 1 checks it on the overview.
- **Store review.** The paywall restyle must not lose a store element (R9), and must not promise
  what the app doesn't do (open question 2; Plus looks without option A).
- **Stale entitlement on the phone.** The app shows what it last fetched; the server always
  decides. Worst case a new Plus member sees the lock once, and its press re-checks (R7).
- **Phase 5's size.** The builder was written for onboarding's draft; an edit mode may need a
  small refactor of where it reads and writes the appearance. It is last so it can be cut.
