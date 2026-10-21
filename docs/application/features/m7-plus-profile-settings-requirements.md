# M7: Kinpaw Plus, Profile and Settings — requirements

> Written 2026-10-02 from [roadmap M7](../roadmap.md#m7-kinpaw-plus-profile-and-settings),
> [product.md, Money](../product.md#key-decisions), the screen spec's
> [Paywall](../UI/kinpaw-screen-spec-v1.md#paywall-template-restyle) and
> [You](../UI/kinpaw-screen-spec-v1.md#you-template-restyle) sections, and
> [monetization-v1](../../memory/monetization-v1.md). The plan:
> [m7-plus-profile-settings-plan.md](m7-plus-profile-settings-plan.md).
> **Status:** done 2026-10-02, every phase checked by Mert. Decided with him: option A (Change
> look), "Room for more pets" off the paywall, an optional grant reason, and revokes audited
> (`premium_grants.action`).

## Problem

Kinpaw Plus exists only on the server. The talk route already reads `profiles.plan_type` and
gives a premium account unlimited talking, but:

- nothing can make an account premium locally (RevenueCat is unconfigured), so Plus can't be
  demonstrated;
- the app never reads the plan: the mic's count and lock come from the last reply's
  `messages_left`, so a new Plus member keeps seeing the lock until they send a message;
- the paywall is the template's ("Unlimited use of every feature", "Priority support"): it says
  nothing about the pet;
- Profile has no Plus panel, and Settings has no way to manage a subscription;
- the Plus looks can be picked only while creating a pet, which only a signed-out (so free)
  person does. A pet's look can't be changed afterwards, so **nobody can ever use a Plus look**,
  and the paywall's "Plus looks" promise is empty (open question 1).

## What is there today (research)

- **Server entitlement:** `profileStore.isPremium` (`apps/web/src/server/db/profiles.ts`) is the
  one read; the talk route and `POST /api/app/v1/pet` (it refuses Plus options from a free
  account) use it. The RevenueCat webhook writes through `applyEntitlement`.
- **The grant table already exists:** `premium_grants` (`PremiumGrant` in
  `apps/web/prisma/schema/accounts.prisma`: user, granted_by, reason, created_at), locked like
  every table, with no code using it. **No migration is needed.**
- **The dashboard already treats a grant as not paid:** `bucketFor` in
  `apps/web/src/lib/dashboard-stats.ts` buckets `premium_source = 'grant'` as `granted`, so a
  demo grant never shows up as revenue.
- **Admin:** `/admin/users` lists the first 100 accounts with their plan; `requireAdmin()`
  (`apps/web/src/lib/require-admin.ts`) guards actions and API routes.
- **App:** `GET /api/app/v1/profile` returns `plan`, read by `useProfile`; nothing uses it for
  entitlement. `SubscriptionContext` reads RevenueCat (always free locally). The paywall
  `app/upgrade.tsx` (524 lines) keeps the store rules (price and period, Restore, Terms, Privacy,
  auto-renew text) and shows dev placeholder plans when the store has none.
- **Appearance:** the roadmap's "Auto follows the sky" is **already done**: product.md decided
  on 2026-10-01 that the app follows the sky with no appearance choice. It leaves M7.

## Success criteria

- In the admin panel, Mert grants Plus to his account; back in the app (foreground or Home),
  the mic's count and lock disappear and talking is unlimited, without sending a message first.
  Revoking it brings the free limit back.
- The paywall talks about the pet and opens with the right trigger from each place.
- **Measured by:** `upgrade_tapped { source }` → `upgrade_page_viewed { trigger }` →
  `upgrade_cta_tapped` (the paywall funnel by entry point), and the `granted` bucket on the
  admin overview. Purchases themselves can't be measured locally (no RevenueCat).

## Requirements

### The grant (server, admin)

R1. **Granting Plus** is a server action on `/admin/users`, behind `requireAdmin()`. In one
transaction it inserts a `premium_grants` row (user, the granting admin, an optional reason) and
writes the profile: `plan_type = 'premium'`, `premium_source = 'grant'`, `premium_status =
'active'`, `premium_started_at = now`, `premium_expires_at = null`, `premium_will_renew =
false`. It goes through `profileStore` (non-negotiable 3).

R2. **Revoking** sets the profile back to free, and only when `premium_source = 'grant'`: a
revoke never touches a store subscription. It asks for confirmation first (the admin skill:
destructive actions confirm).

R3. Granting an account that is already premium does nothing and says so. Every grant and
revoke is logged (Pino, `log.info`, ids only).

R4. The users list shows each account's bucket (free, granted, premium…) from `bucketFor`, and
a Grant or Revoke button for it.

### The app reads Plus from the server

R5. **One `usePlus()` hook** decides Plus in the app: the server's `profile.plan === 'premium'`,
or RevenueCat's entitlement (for the day it is configured). Nothing else in the app reads
either directly for entitlement.

R6. The profile is refetched when the app comes back to the foreground, when Home is focused,
and when the paywall closes, so a grant shows up without a restart.

R7. **Plus everywhere at once:** with Plus, the mic shows no count and no lock, whatever the
last reply said; a press on a locked mic, if one was shown, re-checks first. Without Plus, the
lock and count work as today. The server stays the judge (the talk route reads `plan_type`).

### The paywall

R8. The paywall is restyled to the spec: close button; the pet's `PetArt` (happy, 120pt) on the
`Glow`; "More time with {name}" in `display`; the features "Talk with {name} as much as you
like" and "Plus looks and rare builder options" (and "Room for more pets" only if open question
2 says so). With no pet (never in v1), "More time with your pet".

R9. Every store rule stays: price and period before purchase, what a trial becomes, Restore,
Terms of Use and Privacy links, the auto-renew text, placeholder prices marked as placeholders
(Apple 3.1.1 / 3.1.2; `store-review`).

R10. The paywall is opened with a `trigger`: `talk_limit` (the locked mic), `profile_panel`
(Profile's "See plans"), `locked_look` (only with open question 1's option A). Never at launch,
never before the first conversation.

R11. **A Plus member** who opens the paywall sees "You have Kinpaw Plus" and what it includes,
not plans.

### Profile and Settings

R12. **Profile's Plus panel**, between you and your pet: free, the hero card with `h3` "Kinpaw
Plus", the paywall's features and a secondary "See plans" (→ paywall, `profile_panel`); Plus,
a success `StatusBadge` "Plus member" and a line saying what it includes.

R13. **Settings, "Manage subscription"** row (→ the App Store's subscriptions page) only when
the Plus comes from a store subscription (RevenueCat), never for a grant, where the Apple page
would be empty.

### Change your pet's look (only with open question 1's option A)

R14. Pet details gets "Change look", which opens the builder on the pet's current appearance.
Saving sends the new appearance to a new `PATCH /api/app/v1/pet` (appearance only), which the
server refuses with the same 400 as creation when a free account sends a Plus option.

R15. In that builder a free account's Plus option opens the paywall (`locked_look`), unlike
onboarding, where it only explains. A Plus account picks it like any other.

## Events

Answers to the `events` skill's questions:

- **The aha:** unchanged (`user_activated`, the first reply). M7 adds no new aha.
- **The drop-off:** `upgrade_tapped` → `upgrade_page_viewed` → `upgrade_cta_tapped` →
  `purchase_success`; the leak is closing the paywall.
- **Discriminators:** `source` on `upgrade_tapped`, `trigger` on `upgrade_page_viewed`.
- **Money:** `purchase_success` and Restore are the template's; nothing new. A grant is not a
  purchase and fires no money event: the `premium_grants` row is its record.
- **Lifecycle:** none.

**Mobile registry** (`apps/mobile/lib/analytics.ts`), changes only:

| Event                        | Change                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `upgrade_tapped`             | `source` gains `profile_panel`, and `locked_look` with option A                                   |
| `upgrade_page_viewed`        | gains `trigger`: talk_limit, profile_panel, locked_look, or `unknown` when opened without one     |
| `manage_subscription_tapped` | new: Settings' "Manage subscription" row                                                          |
| `pet_look_change_opened`     | new: the Change look screen appeared. `{ species }` (opened → changed is the drop-off)            |
| `pet_look_changed`           | new, option A only: the new look saved from pet details. `{ species, preset_id, appearance_key }` |
| `pet_option_locked_tapped`   | option A: fires from pet details too, with `during_onboarding: false`                             |

**Web registry:** nothing new. The spec's `paywall_viewed` is the template's
`upgrade_page_viewed` (the spec says reuse the template's own paywall events).

## v1 / later split (agreed with Mert, 2026-10-02)

| v1                                            | Later                                       |
| --------------------------------------------- | ------------------------------------------- |
| The admin grant and revoke                    | Grants that expire; a grants history screen |
| `usePlus()`, refetch on foreground / focus    | Live push of a plan change (Realtime)       |
| The paywall restyle, triggers, the Plus state | Real prices and RevenueCat (v3, launch)     |
| Profile's Plus panel, Settings' manage row    | Plus perks beyond talking and looks         |
| Change look (option A), last and cuttable     | Rooms, accessories, more pets (v2)          |

## Out of scope

RevenueCat, real products and prices (v3); any appearance choice (the app follows the sky); a
multi-pet switcher; Android; the Play Stats API (not touched in this play until it connects).

## Open questions

1. **Plus looks after onboarding.** _Answered by Mert, 2026-10-02: option A._ Pet details gets
   "Change look" (R14–R15, Phase 5): without it nobody could ever use a Plus look, since only
   signed-out (free) people create pets.
2. **"Room for more pets"** on the paywall. _Answered by Mert, 2026-10-02: off_ until more pets
   exist (a promise the app can't keep is an App Review risk, 2.3.1).
3. **Grant reason.** _Answered by Mert, 2026-10-02: an optional one-line reason_, saved on the
   `premium_grants` row.
