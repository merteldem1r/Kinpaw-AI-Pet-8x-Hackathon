# M2: Rebrand and clear the stage — plan

> Requirements: [m2-rebrand-and-clear-stage-requirements.md](m2-rebrand-and-clear-stage-requirements.md).
> Branch: `feat/initial-brand`. Written 2026-10-01.

Seven phases. Each one leaves every gate green, so the work can stop after any of them.
Events land before the UI that fires them. Removal goes from the consumers inward (app, then
server, then contract), so typecheck catches anything left behind. The native change comes
last, so the app is rebuilt and the Xcode signing fix redone only once.

Every phase's **Verify** includes `npm run typecheck`, `npm run lint`, `npm test`, and the gate
named in the phase. Phase 7 runs the full `local-review`.

## Phase 1 — Register `tab_selected`

**Files:** `apps/mobile/lib/analytics.ts`
**Changes:** Add a "Navigation" group comment and `'tab_selected'` with `tab: 'home' | 'talk'
| 'you'` as its discriminator, using the `events` skill (the Step 2 answers are in the
requirements). Nothing fires it yet.
**Verify:** `npm run check:events` passes. It warns that `tab_selected` is unfired, which is
expected until Phase 5.

## Phase 2 — Brand in code

**Files:** `packages/brand/brand.config.ts`, `apps/mobile/lib/constants.ts`
**Changes:**

- `brand.config.ts`: `accent: '#f2b66b'`, and `appName` and `siteName` set to `'Kinpaw'` with
  `🎨 REPLACE` (working name).
- `constants.ts`: Kinpaw tagline and description (R2). `APP_SCHEME` is unchanged here and
  moves with `app.json` in Phase 7.

**Verify:**

- `packages/brand` tests pass: `contrast.test.ts` checks that the amber accent's roles meet AA
  on dusk and dawn.
- On the Simulator (a JS reload, no rebuild), Welcome shows "Kinpaw", the new tagline and
  amber buttons.
- Light mode still reads.

## Phase 3 — Remove the sample features from the app

**Files:**

- Delete:
  - `apps/mobile/app/(tabs)/explore.tsx`
  - `apps/mobile/app/(tabs)/activity.tsx`
  - `apps/mobile/app/detail/[id].tsx`
  - `apps/mobile/components/ItemCard.tsx`
  - `apps/mobile/hooks/useItems.ts`
  - `apps/mobile/hooks/useActivityFeed.ts`
  - `apps/mobile/hooks/useNotifications.ts`
  - `apps/mobile/lib/types.ts`
- Edit:
  - `apps/mobile/app/(tabs)/_layout.tsx`
  - `apps/mobile/app/(tabs)/index.tsx`
  - `apps/mobile/app/(tabs)/profile.tsx`
  - `apps/mobile/app/_layout.tsx`
  - `apps/mobile/lib/mockData.ts`
  - `apps/mobile/lib/analytics.ts`
  - `apps/mobile/__tests__/api.test.ts`

**Changes:**

- Drop the `explore` and `activity` `Tabs.Screen`s, and the `detail/[id]` `Stack.Screen`.
- Home becomes the placeholder from R15. Its stats panel, items and activity sections and the
  refresh control go.
- Profile drops the `demoUser` role line.
- `mockData.ts` keeps only `paywallPreview`.
- Remove the three `notification*` events from the registry.
- Re-point `api.test.ts` from the items endpoints to `getProfile`, `updateProfile`,
  `getConfig` and `deleteAccount`. Keep every behaviour it tested: query strings, path
  params, retries, session expiry, parse failures.

**Verify:**

- `npm run check:events` and `npm run check:standards` pass. `mock-data-dev-only` still
  holds.
- The mobile Jest suite passes.
- `grep -rnE "useItems|useActivityFeed|useNotifications|ItemCard|detail/\[id\]" apps/mobile --exclude-dir=node_modules`
  finds nothing outside `README.md`.
- On the Simulator, the app shows two tabs (Home, Profile), and Home renders with no network
  errors.

## Phase 4 — Remove the sample features from the server and the contract

**Files:**

- Delete:
  - `apps/web/src/app/api/app/v1/items/` (including `[id]/`)
  - `apps/web/src/app/api/app/v1/tasks/`
  - `apps/web/src/app/api/app/v1/activity/`
  - `apps/web/src/app/api/app/v1/notifications/`
  - `apps/web/src/server/db/items.ts`
  - `apps/web/src/server/db/tasks.ts`
  - `apps/web/src/server/db/feed.ts`
  - `packages/contract/src/v1/items.ts`
  - `packages/contract/src/v1/tasks.ts`
  - `packages/contract/src/v1/activity.ts`
  - `packages/contract/src/v1/notifications.ts`
- Edit:
  - `apps/web/src/server/api/wire.ts`
  - `apps/web/src/server/db/app-data.test.mts`
  - `packages/contract/index.ts`
  - `packages/contract/src/v1/endpoints.ts`
  - `packages/contract/src/v1/contract.test.mts`
  - `AGENTS.md`

**Changes:**

- In `wire.ts`, drop the four sample mappers and the task-state maps. Delete the file if
  nothing else uses it; check `profile` and `account` first.
- `app-data.test.mts` keeps only the profile-store cases. Rename the file if "app-data" no
  longer describes it.
- Drop the four exports from `index.ts` and the seven entries from `endpoints.ts`.
- Rewrite the generic cases in `contract.test.mts` (unknown keys stripped, user ids refused,
  ISO dates) against `profile` and `config` schemas, so the contract's behaviour stays
  covered.
- Update the "Data (web)" line in `AGENTS.md` (R13).
- `cursor.ts` stays (the Play Stats API's `/users` route uses it). The Prisma schema isn't
  touched.

**Verify:**

- `npm run typecheck` (web, mobile, contract), `npm test`, `npm run web:build`.
- `git diff --stat -- apps/web/prisma` is empty.
- If the local stack is up, the database suites run (`test:db`), including the profile
  cases.
- `curl -i localhost:3000/api/app/v1/items` returns 404.

## Phase 5 — Three tabs and the You screen

**Files:**

- New:
  - `apps/mobile/app/(tabs)/talk.tsx`
  - `apps/mobile/app/(tabs)/you.tsx`
- Delete:
  - `apps/mobile/app/(tabs)/profile.tsx`
  - `apps/mobile/app/settings.tsx`
- Edit:
  - `apps/mobile/app/(tabs)/_layout.tsx`
  - `apps/mobile/app/_layout.tsx`
  - `apps/mobile/components/TabBar.tsx`

**Changes:**

- **Tabs:** `index` (Home, `House`), `talk` (Talk, `MessageCircle`), `you` (You,
  `CircleUser`).
- **Talk:** the placeholder from R15.
- **You** (R16), built from the existing parts with no new components:
  - `Text variant="title"` "You"
  - the upgrade card, with Kinpaw copy
  - Appearance (`SegmentedControl`, System / Light / Dark)
  - Settings: Haptics `Toggle`, account rows (email, Sign out), Help, Terms of Use,
    Privacy, version caption
  - Delete account, with its `AlertModal` flow and copy updated per R17

  The sign-out and delete logic moves over unchanged. The `profile_viewed` effect moves too.

- **Root layout:** remove the `settings` `Stack.Screen`. Check for any `router.push
('/settings')` or `'/profile'` left behind.
- **TabBar:** in `handlePress`, after the `focused` / `defaultPrevented` early return, call
  `track('tab_selected', { tab })`, mapping the route name to `home`, `talk` or `you` with a
  small typed map.

**Verify:**

- `npm run check:events` passes with no unfired warning for `tab_selected`.
- `npm run check:standards`: `account-deletion-in-app` passes, with the screen at `/you`.
- `npm run check:store` passes.
- Simulator click-path:
  1. Sign in with an email code (code from the local Inbucket, see the
     `local-device-networking` memory).
  2. Confirm three tabs; switch between them.
  3. Change Appearance and Haptics.
  4. Open Terms, Privacy and Help.
  5. Open "See plans", then close it.
  6. Sign out, then sign in again.
  7. Delete a throwaway account; you land on Welcome.

## Phase 6 — Icon art and the logo mark

Placeholder art, generated (requirements, Decisions 2).

**Files:**

- New:
  - `apps/mobile/assets/icon/icon.svg` (the art's source)
  - `apps/mobile/assets/icon/icon.png`, `icon-dark.png`, `icon-tinted.png` (1024²)
  - `apps/mobile/assets/icon/logo-mark.png` (the tile, rounded, transparent outside the
    rounded corners, @3x)
  - `apps/mobile/assets/icon/splash.png`
  - `apps/web/src/app/icon.png`
- Edit:
  - `apps/mobile/components/ui/Marks.tsx`
  - `apps/mobile/app/index.tsx`
  - `apps/mobile/app/(auth)/login.tsx`
  - `apps/web/src/components/device/parts.tsx`
- Delete:
  - `apps/web/src/app/icon.tsx` (replaced by `icon.png`)

**Changes:**

- **The art:** draw the spec's moon in SVG and render the variants with a one-off `sharp`
  script run from the scratchpad, not committed.
  - Default: midnight gradient, three stars, amber glow, amber moon and ears, crater dots,
    closed eyes.
  - Dark: the same on black, with the glow at about half strength.
  - Tinted: greyscale on black.
  - The logo tile is the small-size cut: no craters, eye strokes about 10% thicker.
- **`LogoMark`:** becomes an `expo-image` of `logo-mark.png` at `size`, hidden from
  accessibility as today. Drop the `name` prop and update both call sites.
- **Website:** `parts.tsx` `LogoMark` renders the same image; the favicon becomes the PNG.

**Verify:**

- `npm test`: the hex test in `theme.test.tsx` passes, with no colour literal in app code.
- `npm run web:build`.
- The Simulator shows the moon on Welcome and Login in dark and light.
- The site's tab shows the moon favicon.

The home-screen icon only changes after Phase 7's rebuild.

## Phase 7 — Native identity (rebuild)

Bundle ID and Android package `com.merteldem1r.cozypet`, scheme and slug `cozypet`
(requirements, Decisions 1).

**Files:** `apps/mobile/app.json`, `apps/mobile/lib/constants.ts`
**Changes:**

- `app.json`:
  - `name` "Kinpaw"
  - `slug`, `scheme` and the Android intent-filter scheme, `ios.bundleIdentifier` and
    `android.package` set to the chosen values
  - top-level `icon` → `./assets/icon/icon.png`
  - `ios.icon` → `{ "light": "./assets/icon/icon.png", "dark": "./assets/icon/icon-dark.png",
"tinted": "./assets/icon/icon-tinted.png" }`
  - the splash image in both places → `./assets/icon/splash.png`
  - Leave `usesAppleSignIn` and `expo-apple-authentication` alone (the
    `xcode-free-account-signing` memory).
- `constants.ts`: `APP_SCHEME` set to the new scheme.
- Delete the old `assets/icon.png`, `assets/splash-icon.png` and `assets/favicon.png`, once
  a grep shows nothing references them.

**Verify:**

- The full `local-review`, including `check:store` and `store-review` for the native
  change.
- Rebuild: `npx expo prebuild --clean`, then run the app on the Simulator; the home screen
  shows the moon icon (dark and tinted via Settings → Home Screen on iOS 18).
- Then the iPhone: redo the signing fix in Xcode (Team, remove Sign in with Apple). The new
  bundle ID gets a new provisioning profile automatically.
- The old MyApp install stays on the phone as a separate app, so delete it by hand.
- Sign in again on the new install.

## Risks

- **The rebuild undoes the Xcode signing fix** (Phase 7), and the new bundle ID is a new app
  to iOS: new provisioning profile, empty keychain, so the person is signed out. Expected,
  not a bug. On a free account, Apple limits how many new App IDs can be registered per week,
  so the bundle ID is settled once (requirements, Decisions 1).
- **A bundle ID or scheme is hard to change later.** Changing either after a store
  submission is a different app or a broken deep link. Nothing has been submitted, so now is
  the cheap moment.
- **Removing `v1` endpoints** would break an installed store build that calls them. None
  exists. After the first store build, routes are only added.
- **Account deletion moves screens.** If `you.tsx` drops the wiring, the
  `account-deletion-in-app` standard fails CI, and the app would be rejected (Apple
  5.1.1(v)). Phase 5 verifies it explicitly.
- **Test coverage could be lost with the sample routes.** `api.test.ts`, `contract.test.mts`
  and `app-data.test.mts` used the sample endpoints as their examples. Phases 3 and 4 move
  that coverage onto profile and config rather than deleting it.
- **No database change.** No migration, no RLS change, and no number the admin panel or the
  Play Stats API reports changes. Account deletion still cascades through the kept sample
  tables.
- **Money and entitlement are not touched.** The upgrade card on You only navigates to the
  existing paywall.
