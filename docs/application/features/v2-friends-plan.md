# v2 Friends — plan

> Requirements: [v2-friends-requirements.md](v2-friends-requirements.md). Specced 2026-10-06.
> **Built 2026-10-06**, Phases 1–4, without a device: Phase 0's link checks and every phase's
> Verify on the Simulator and the iPhone are Mert's check, done together. Each phase is shown to Mert and confirmed before the next
> ([[working-with-mert]]). No native rebuild in any phase.

## Phase 0 — Check the links (no app code kept)

Settle the one unknown before building on it: does a `cozypet://` link reach a route in the dev
build from everywhere it will come from?

**Files:** a throwaway `app/friends/add.tsx` that shows its `code` param; nothing committed.
**Changes:** none kept.
**Verify:**

- Simulator: `xcrun simctl openurl booted "cozypet://friends/add?code=KP7XM3QD"`, with the app
  closed and open, signed in with a pet.
- iPhone: a QR of the same URL shown on the Mac screen, scanned with the Camera app: iOS offers
  "Open in Kinpaw" and the route shows the code.
- The same link sent in iMessage: tappable or not (requirements, Open questions).
- Signed out: the link lands on Welcome (the protected group refuses it), which is what Phase 3's
  pending code fixes.
- `react-native-qrcode-svg` renders a QR on the Simulator with the installed `react-native-svg`,
  without a rebuild, and the iPhone's Camera reads it off the Simulator's screen.

## Phase 1 — Events, schema, contract and the server

**Files:**

- `apps/web/src/lib/analytics/events.ts`: `FRIEND_EVENTS` (`friend_added`, `friend_removed`,
  `friends_viewed`), added to `TRACKED_EVENTS` (the `events` skill does this first).
- `apps/mobile/lib/analytics.ts`: the `EventName` union gains the six app events with their
  comments; `tab_selected`'s comment gains `friends`.
- `apps/web/prisma/schema/friends.prisma` (new): `FriendCode`, `Friendship`; the relations on
  `Profile` in `accounts.prisma`.
- `apps/web/prisma/schema/migrations/<ts>_friends/` (generated from the schema) and
  `<ts+1>_friends_security/` (hand-written: RLS on, `REVOKE ALL … FROM anon, authenticated` for
  both tables, as `20261004193828_pet_photo_reads_security`).
- `packages/contract/src/v1/friends.ts` (new): `FRIENDS_MAX` (50), the code alphabet and
  `normalizeFriendCode`/`formatFriendCode`, `needBand(value)` (low / okay / good from `LOW_NEED`
  and `ALL_GOOD`), `friendPetSchema` (appearance, name, mood, bands; nothing else, `.strict()`),
  `friendSchema`, `friendPreviewSchema`, the bodies and responses. `endpoints.ts`: `getFriends`,
  `lookupFriend`, `addFriend`, `removeFriend`, `resetFriendCode`. Exported from the package.
- `apps/web/src/server/db/friends.ts` (new, `friendStore`): `codeFor(userId)` (get or create,
  retry on a unique clash), `resetCode`, `ownerOf(code)`, `list(userId)` (friendships joined to
  profile display name and pet with needs), `add(userId, friendId)` (pair in id order, both caps
  checked in one transaction, `outcome: added | existing | cap_self | cap_friend`), `remove`.
- `apps/web/src/server/api/friend-wire.ts` (new): a stored friend to `Friend`, decaying needs
  with `decayNeeds` in the caller's time zone, then `moodFor` and `needBand`; the display-name
  fallback.
- `apps/web/src/app/api/app/v1/friends/route.ts` (GET, POST), `friends/lookup/route.ts`,
  `friends/[id]/route.ts` (DELETE), `friends/code/route.ts` (POST). Each through
  `createAppRoute`; first-party events with `recordUserEvent` (`friends_viewed` deduped per day).
- Tests: `packages/contract/src/v1/friends.test.mts` (code normalising, bands, the strict wire
  shape refusing an extra field); `apps/web/src/server/db/friends.test.mts` and route tests
  (own code, unknown, existing, cap on either side, retry, remove by a stranger refused, remove
  twice, cascade on account delete, the wire never carrying email, avatar, traits, numbers).

**Verify:** `npm run typecheck`, `check:events`, the contract and web suites; `npm run db:migrate`
locally, `check:rls`, `test:db` on Postgres 17 ([[local-checks-and-traps]]); `curl` the five
routes with two local accounts' tokens.

## Phase 2 — The tab, the list, My code, a friend's pet

**Files:**

- `apps/mobile/package.json`: `react-native-qrcode-svg` (pure JS; Phase 0 confirmed it).
- `apps/mobile/app/(tabs)/_layout.tsx`: the Friends `<Tabs.Screen>` second, `Users` icon;
  `components/TabBar.tsx`: `TAB_EVENT_NAMES.friends`.
- `apps/mobile/app/(tabs)/friends.tsx` (new): empty state, list, loading, error, pull to
  refresh, refetch on focus and foreground.
- `apps/mobile/hooks/useFriends.ts` (new): TanStack Query over `getFriends`, `addFriend`,
  `removeFriend`, `resetFriendCode`; invalidation after each write.
- `apps/mobile/components/friends/FriendRow.tsx`, `MyCodeSheet.tsx` (QR, grouped code, Share,
  New code with confirm), `FriendNeeds.tsx` (the four bands as words).
- `apps/mobile/app/friends/[id].tsx` (new, pushed): the friend's pet page with Remove friend;
  registered in the "with a pet" group of `app/_layout.tsx`.
- `apps/mobile/lib/friendLines.ts` (new): the lowest-need line in third person, per species.

**Verify:** with two accounts (seeded via `curl` from Phase 1), the list shows the friend's pet
in its mood; it changes after the friend feeds it and the list refreshes; My code shows a QR the
iPhone's Camera reads; New code makes the old one 404; Remove empties both lists; the error
state on the server stopped. Jest for `friendLines` and the row's accessibility label.

## Phase 3 — Adding a friend

**Files:**

- `apps/mobile/app/friends/add.tsx` (new, pushed, in the "with a pet" group): the code field
  (8 characters, normalised as typed), `lookupFriend` → preview with Add friend / Not now,
  every outcome of R9, `friend_add_opened` and `friend_add_failed`.
- `apps/mobile/app/+native-intent.tsx` (new): `redirectSystemPath` keeps a
  `cozypet://friends/add` code in `lib/pendingFriendCode.ts` when the app has no pet yet, and
  passes the path through otherwise.
- `apps/mobile/lib/pendingFriendCode.ts` (new): one code in AsyncStorage with its time, 24 hours,
  cleared on use and on sign-out (the auth listener in `app/_layout.tsx`).
- `apps/mobile/app/(tabs)/index.tsx` or a small hook beside `useNudges`: once Home has shown
  with a pet and "Tell me about you" has ended, a pending code opens the add screen.

**Verify:** the Phase 0 link paths again, now ending in a friend: Camera on the iPhone, `simctl
openurl` on the Simulator, typed code; a link while signed out → sign in → save the pet →
Home → the add screen with the code; an expired pending code is dropped; own, unknown, replaced
codes and a full list show their lines.

## Phase 4 — Finish

**Files:** `app/privacy.tsx` (R16); accessibility on every new screen (labels on the QR, the
code read out in groups, 44pt targets, reduced motion, Dynamic Type on the list);
`docs/application/product.md` (a "v2 decisions" entry and the tabs line),
`docs/application/roadmap.md`, `docs/application/UI/kinpaw-screen-spec-v1.md` (a Friends
section, the tab bar line, the event table), `docs/application/updates/v2.md`, the idea's
status in `ideas.md`.

**Verify:** the `local-review` gates and `store-review` (the UGC question in the requirements is
answered there); VoiceOver pass on the iPhone; the demo end to end between the Simulator and
the iPhone.

## Risks

- **Other lanes touch the same files.** `app/_layout.tsx`, `(tabs)/_layout.tsx`, `TabBar.tsx`,
  both event registries and `accounts.prisma` are shared; merge `main` in before Phase 1's
  migration and again before the PR, and land the migration only while no other lane has an
  unmerged one ([[parallel-workspaces]]).
- **A fourth tab** narrows the floating tab bar: labels must still fit on an iPhone SE at the
  default text size.
- **Privacy leak through the wire.** The friend's pet must never reuse `toWirePet` (it carries
  traits and exact needs); the strict schema and its test are the guard.
- **Deep links in the dev client.** If Phase 0 shows the Camera link doesn't open the dev build,
  the typed code alone still demos the feature, and the link waits for a release build.
- **Migration reversal.** Two new tables with no data elsewhere depending on them: dropping them
  is safe. Nothing touches money, entitlement, the Play Stats API or a dashboard number.
