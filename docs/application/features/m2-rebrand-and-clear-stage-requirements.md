# M2: Rebrand and clear the stage — requirements

> Milestone M2 of the [roadmap](../roadmap.md). Inputs: [product.md](../product.md) (Brand,
> The codebase), the [screen spec](../UI/kinpaw-screen-spec-v1.md) (App icon and logo mark,
> You, Events). Plan: [m2-rebrand-and-clear-stage-plan.md](m2-rebrand-and-clear-stage-plan.md).
> Written 2026-10-01.

## Problem

The app on the phone is still the template. It is called MyApp, shows the template's sky-blue
accent and a lettered "M" logo, and its four tabs (Home, Explore, Activity, Profile) are a
project-tracker demo of items, tasks, an activity feed and notifications. None of that is
Kinpaw, and every milestone from M3 on would have to work around it. M2 makes the app Kinpaw
and leaves an empty stage, Home · Talk · You, for the pet to move into.

## What is there today (research)

- **Brand:** `packages/brand/brand.config.ts` has `preset: 'dusk'` (already right),
  `accent: 'default'` (the dusk sky blue `#5fccf9`), `appName`/`siteName: 'MyApp'`.
  `apps/mobile/lib/constants.ts` holds `APP_SCHEME = 'myapp'` and the template tagline and
  description, which the Welcome screen (`app/index.tsx`) shows.
- **Native identity:** `apps/mobile/app.json` has name `MyApp`, slug `my-app`, scheme `myapp`
  (twice: `scheme` and the Android intent filter), bundle ID and Android package
  `com.yourcompany.myapp`, and one `icon` (`assets/icon.png`, 1024², the template's).
  There is no `assets/icon/` folder yet.
- **Logo mark:** `LogoMark` in `apps/mobile/components/ui/Marks.tsx` (gradient square + initial)
  is used on Welcome (`app/index.tsx`) and Login (`app/(auth)/login.tsx`). The website has its
  own copy in `apps/web/src/components/device/parts.tsx`, and its favicon is drawn the same
  way in `apps/web/src/app/icon.tsx`.
- **Tabs:** `app/(tabs)/_layout.tsx` registers `index` (Home), `explore`, `activity`,
  `profile`. Settings is a separate pushed screen (`app/settings.tsx`) reached from Profile.
  `components/TabBar.tsx` draws whatever is registered and fires no event.
- **Sample features, mobile:** `app/(tabs)/explore.tsx`, `app/(tabs)/activity.tsx`,
  `app/detail/[id].tsx` (registered in `app/_layout.tsx`), `components/ItemCard.tsx`,
  `hooks/useItems.ts`, `hooks/useActivityFeed.ts`, `hooks/useNotifications.ts`,
  `lib/types.ts` (sample types only), Home's stats panel, items and activity sections, and
  the `insightCards` and `demoUser` entries in `lib/mockData.ts`. `mockData.ts` and
  `devPlaceholders.ts` themselves stay: the paywall's dev preview plans
  (`paywallPreview`, used by `app/upgrade.tsx`) live there, and the `mock-data-dev-only`
  standard checks that loader.
- **Sample features, server and contract:** routes `apps/web/src/app/api/app/v1/{items,
items/[id],tasks,activity,notifications}` (and their tests), stores
  `apps/web/src/server/db/{items,tasks,feed}.ts`, the item/task/activity/notification
  mappers in `apps/web/src/server/api/wire.ts`, the database suite
  `apps/web/src/server/db/app-data.test.mts` (which also tests the profile store), and in
  `packages/contract`: `src/v1/{items,tasks,activity,notifications}.ts`, their exports in
  `index.ts`, seven entries in `src/v1/endpoints.ts`, and cases in `contract.test.mts`.
  `apps/mobile/__tests__/api.test.ts` tests the app's API client using the items endpoints
  as its example. `apps/web/src/server/api/cursor.ts` is also used by the Play Stats API's
  `/users` route, so it stays.
- **Kept on purpose:** the Prisma models and tables (dropped later, after M4:
  `sample-tables-dropped` memory), the
  `profile`, `account`, `config` and `uploads` routes, the onboarding flow, login, paywall,
  support, terms and privacy screens.
- **Events:** the mobile registry (`apps/mobile/lib/analytics.ts`) has no `tab_selected`.
  `notification_opened`, `notifications_marked_read` and `notifications_mark_read_undone`
  are fired only by `activity.tsx`. `profile_viewed` and `logout` are fired by
  `profile.tsx`; `appearance_changed`, `haptics_changed` and the `delete_account_*`
  events by `settings.tsx`.
- **Load-bearing surfaces:** none of money, entitlement or the Play Stats API is touched.
  Auth is touched only by the scheme rename (the OAuth callback URL); the email-code sign-in
  used locally doesn't use it. Account deletion moves screen and must stay reachable
  (`account-deletion-in-app` standard, Apple 5.1.1(v)).
- **No wrong premise found**, with one note: removing `v1` endpoints is normally forbidden
  once a store build calls them (`docs/rules/mobile-data.md`). No store build of this play
  exists, so they can be removed now.

## Success criteria

- The app on the Simulator and the iPhone is called Kinpaw. It shows the amber accent and the
  moon logo and icon, and has exactly three tabs, Home, Talk and You, after signing in with an
  email code.
- `tab_selected` fires with `tab` = `home`, `talk` or `you` on every tab change. There's no
  activation "aha" in this milestone: it is infrastructure. What the event answers later is
  how people split their time between caring for the pet (Home), talking to it (Talk) and
  settings (You).
- No sample-feature code remains. A search for `useItems`, `ItemCard`, `itemStore`,
  `taskStore`, `feedStore`, `listItems`, `listNotifications` or `detail/[id]` finds nothing
  outside `docs/` history and the Prisma schema.
- Every gate is green: secrets, template, typecheck, lint, format, standards, events, env,
  store, tests and the web build.

## Requirements

**Brand**

R1. `brand.config.ts`: `preset: 'dusk'`, `accent: '#f2b66b'`, `appName` and `siteName`
`'Kinpaw'`, with the `🎨 REPLACE` marker kept on the name (working name).
R2. `lib/constants.ts`: a Kinpaw tagline and description replace the template's. Proposed:
tagline "Someone missed you."; description "A cozy pet that lives on your phone, needs a
little care each day, and talks back."
R3. No colour literal is added to app code. The logo mark gets its colours from image art,
not from hex values in components.

**Native identity** (needs a native rebuild)

R4. `app.json`: `name` "Kinpaw" (marked as the working name). `slug`, `scheme`, the Android
intent-filter scheme, `ios.bundleIdentifier` and `android.package` get the values in
[Decisions](#decisions) 1. `APP_SCHEME` equals `scheme`.
R5. Icon art in `apps/mobile/assets/icon/`: `icon.png` (default), `icon-dark.png` and
`icon-tinted.png` (iOS 18+). Each is 1024 × 1024, square and opaque, following the spec's
"App icon and logo mark". `app.json` `ios.icon` points at the three variants, and the
top-level `icon` points at the default. Placeholder art until the final icon exists, marked
`🎨 REPLACE`.
R6. The splash keeps its midnight background (`#090f1e`, already set) and uses the moon art
instead of the template's.

**Logo mark**

R7. `LogoMark` renders the moon face on its midnight tile (corner radius about 28% of its
size), identical in both schemes, from an image in `assets/icon/`. It no longer takes the
app name. Its call sites on Welcome and Login are updated.
R8. The website's favicon (`apps/web/src/app/icon.tsx`) and its device-mockup `LogoMark`
(`parts.tsx`) use the same moon art.

**Clear the stage**

R9. The mobile sample code listed under research is deleted, and Home loses its stats panel,
items and activity sections. `mockData.ts` keeps only `paywallPreview`.
R10. The server and contract sample code listed under research is deleted, including the
`wire.ts` mappers and the tests for the deleted routes. The profile-store cases in
`app-data.test.mts` are kept, moved to a suite of their own if the file is otherwise
emptied. `cursor.ts` stays.
R11. The app's API client keeps its test coverage: `api.test.ts` uses endpoints that still
exist (profile, config, account) in place of items.
R12. The Prisma models, the tables and the `Profile` relations to them are unchanged, and no
migration is generated.
R13. `AGENTS.md` (Conventions, "Data (web)") no longer lists `itemStore`, `taskStore` and
`feedStore` behind `/api/app/v1`.

**Three tabs**

R14. The tab bar shows Home · Talk · You, in that order:

- Home: `app/(tabs)/index.tsx`, `House` icon.
- Talk: a new `app/(tabs)/talk.tsx`, `MessageCircle` icon.
- You: a new `app/(tabs)/you.tsx`, `CircleUser` icon.

R15. Home and Talk are honest placeholders. Each has its title (`Text variant="title"`) and
one line saying what will live there, in Kinpaw's voice. They contain no "coming soon",
lorem ipsum or demo data (Apple 2.1, `mock-data-dev-only`).
R16. You merges today's Profile and Settings into one screen, in the spec's order, leaving
out what later milestones add:

1. title "You"
2. the existing upgrade card ("See plans" → paywall), with Kinpaw copy
3. Appearance, the template's System / Light / Dark
4. Settings: the Haptics toggle, the account row (email, Sign out), Help, Terms of Use,
   Privacy, and the app version
5. Delete account

The spec's Plus panel, Your pet row and Auto appearance are M7. `app/(tabs)/profile.tsx` and
`app/settings.tsx` are deleted, and their `Stack.Screen` entries removed.
R17. Account deletion keeps working from You (`account-deletion-in-app` passes). Its
confirmation text no longer lists items, tasks, activity and notifications.
R18. Signing out, deleting the account and changing appearance or haptics behave exactly as
before, with the same events.

## Events

All mobile, PostHog sink only (PostHog is unconfigured locally, so `track()` no-ops; the
registry and `check:events` still bind). No first-party or Play Events moments in M2.

| Event                                                                                | Change                                              | Fired from              | Properties                       |
| ------------------------------------------------------------------------------------ | --------------------------------------------------- | ----------------------- | -------------------------------- |
| `tab_selected`                                                                       | **New.** Registered before the tab bar fires it     | `components/TabBar.tsx` | `tab`: `home` \| `talk` \| `you` |
| `profile_viewed`                                                                     | Kept, now on the You tab                            | `app/(tabs)/you.tsx`    | none                             |
| `logout`, `appearance_changed`, `haptics_changed`, `delete_account_*`                | Kept, moved with their rows                         | `app/(tabs)/you.tsx`    | unchanged                        |
| `notification_opened`, `notifications_marked_read`, `notifications_mark_read_undone` | **Removed** from the registry with the Activity tab | none                    | none                             |

The events skill's Step 2 questions, answered:

1. **Aha:** none, since M2 is infrastructure. `tab_selected` is a usage signal, not a success
   metric.
2. **Drop-off:** none to watch in M2.
3. **Discriminator:** `tab` on `tab_selected`.
4. **Money moment:** no.
5. **Lifecycle change:** no. `account_deleted` is unchanged and still canonical.

`tab_selected` fires when the person taps a different tab, not on first mount and not when
they tap the tab that is already active. `screen_viewed` still covers every route.

## Out of scope

- Every pet feature: art, `SkyBand`, Create, Meet, Save (M3, M4).
- The Welcome screen's redesign (M3). M2 changes only its copy (R2) and logo (R7). The
  template's "dealt cards" stay until M3 replaces the screen.
- The onboarding flow and the "onboarding completed" gate (M4 replaces them).
- Hiding Apple and Google sign-in (M4).
- The You tab's Plus panel, pet row, "Auto follows the sky", `settings_scheme_changed` and
  `upgrade_tapped` (M7). Paywall restyle (M7).
- The website's marketing pages and phone mockups (`components/device/screens/*`), apart
  from the logo and favicon (R8). The website isn't part of v1.
- The final app name and the final icon art.
- Dropping the sample tables (a separate, hand-written migration, if ever).
- The `uploads` route and the image-picker plugin. They aren't sample features, and removing
  the plugin is a native change with nothing to gain now.

## Decisions

Mert asked for the recommendations to be taken (2026-10-01):

1. **Bundle ID, scheme and slug:** bundle ID and Android package `com.merteldem1r.cozypet`,
   scheme and slug `cozypet`. Neutral, so they survive the final name.
2. **Placeholder icon art:** drawn as SVG from the spec's description and rendered to PNG with
   `sharp`. The SVG source is committed next to the PNGs. `🎨 REPLACE` with the final art.
3. **The website's phone mockups** stay as they are, out of scope; only the logo and favicon
   change (R8).
