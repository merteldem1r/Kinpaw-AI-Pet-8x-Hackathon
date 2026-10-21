# v2 Daily notification in the pet's voice — plan

> Requirements: [v2-notifications-requirements.md](v2-notifications-requirements.md). Each
> phase is shown to Mert and confirmed before the next (`working-with-mert`). At the end of each
> session, the day's work goes into [updates/v2.md](../updates/v2.md). Mert runs every git
> command; each phase ends with the gates (`local-review`) and a suggested commit message.

Target: Phases 0–2 before the first evaluation (about 2026-10-06), so the demo shows a note
from the pet on the iPhone. Phase 3 follows the memory session's Phase 5.

> **Where we are (end of 2026-10-04):**
>
> - **Done:** Phases 0, 1, 2 and 4. Mert checked Phases 0 and 2 on the Simulator and on his
>   iPhone (iOS 27): the ask, three notes on the lock screen, cancelled on return, gone on open.
> - **Waiting:** Phase 3, until the memory session's greeting route (its Phase 5) merges.
> - **Still to see:** one real day on the iPhone, at the real timing (the first note when a need
>   goes low, 09:00–21:00).
> - **Changed from the plan while building:**
>   - Phase 0: no Xcode step for push. `plugins/withLocalNotificationsOnly.js` applies
>     expo-notifications and strips `aps-environment`, which its plugin always adds.
>   - Phase 2: the ask is `PetBubble`'s new `choice` (a question, Yes and Not now), not a
>     separate `NotifyAsk` component.
>   - Phase 2: `usePetAction` gained `onConfirmed`, and Settings reads the state through
>     `hooks/useNotesState.ts`.
>   - Phase 2: line rotation is kept per need and day tier, so day 1 doesn't always open with
>     the same line.
>   - Found on the way: `scripts/check-standards.mjs` cut its JSON report at 8 KB on macOS
>     (`process.exit` before a pipe write finished). It now sets `process.exitCode`.

**No migration, no Groq call, no `db:reset`.** The only server change is Phase 3's two
optional fields on memory's greeting route. **Phase 0 is a native change**: a rebuild, and the
Xcode signing fix may need redoing (`docs/memory/xcode-free-account-signing.md`).

## Phase 0 — Check it builds and fires

**Files:**

- `apps/mobile/package.json`: `expo-notifications`, installed with `npx expo install` so the
  version matches SDK 55.
- `apps/mobile/app.json`: the `expo-notifications` plugin. No sounds, no icon of our own, no
  Android channel.

**Changes:** none in app code beyond a throwaway button (not committed) that asks permission
and schedules a note 10 seconds out.

**Verify:**

- `npx expo prebuild` and a Simulator build: the note fires with the app in the background,
  and not as a banner while it is open.
- Read the generated `ios/*/*.entitlements`. If `aps-environment` is there, a free-account
  device build fails to sign: find whether the plugin can leave it out, else remove the Push
  Notifications capability in Xcode with Sign in with Apple. Record the answer for
  `docs/memory/` (requirements, open question D).
- The same on Mert's iPhone, with the signing fix redone if needed.
- `npm run check:store`: a notification permission asked only on a button press.

**Stop: Mert confirms a local note on the iPhone before Phase 1.**

## Phase 1 — Events, the schedule and the lines

**Files:**

- `apps/mobile/lib/analytics.ts`: the five app events, registered with the `events` skill.
- `apps/web/src/lib/analytics/events.ts`: `NOTIFICATION_EVENTS` (`notification_opened`,
  `notifications_state`), registered now so Phase 3 only fires them. **The memory session also
  edits this file**: add the group as its own block at the end to keep the merge trivial.
- `apps/mobile/lib/nudge.ts` (new, pure, no Expo imports): `planNudges(input)` →
  up to three `{ at: Date, day: 1 | 2 | 3, need: Need }`.
  - Input: the stored needs and their `updated_at`, the moment the app left, the time zone.
  - Steps `decayNeeds` forward in 15-minute steps (at most 72 hours) to the first moment
    `lowestNeed` reads below `LOW_NEED` as a whole number (R4).
  - Applies `NUDGE_MIN_AWAY` (3 h, R5) and `NUDGE_WINDOW` (09:00–21:00 local, R6), then days 2
    and 3 at 24-hour steps moved into the window (R7). Each day's `need` is the lowest at its
    own time.
  - Named constants at the top: `NUDGE_MIN_AWAY_MS`, `NUDGE_WINDOW_START`, `NUDGE_WINDOW_END`,
    `NUDGE_DAYS`, `NUDGE_STEP_MS`.
- `apps/mobile/lib/nudge.test.ts` (new): low already at leave (waits 3 h); a need going low at
  22:30 (moves to 09:00); leaving at 23:50 (night, the pet sleeps, decay slowed); every need
  full (still within 72 h); days 2 and 3 never on the same local day; a time-zone change
  between days (DST); always at most three.
- `apps/mobile/lib/notificationLines.ts` (new): the bank (R9–R11), per need × species × day,
  with and without your name; `pickLine(need, species, day, names, lastIndex)`. No hex, no
  personal data. Kept apart from `petLines.ts` so neither grows into a god file.
- `apps/mobile/lib/notificationLines.test.ts` (new): every combination has a line; no line
  repeats twice in a row; no `{name}` left in a line when a name is missing; the words list
  in R9 (starving, dying, forgot…) never appears.
- The screen spec: a "Notes from Mochi" section under "Shared logic" with the rule and the full
  line bank, so copy is reviewed there.

**Verify:** `npm test --workspace=@app/mobile`, `npm run check:events`, `npm run typecheck`.
Mert reads the line bank in the spec.

## Phase 2 — The app: ask, schedule, tap, Settings

**Files:**

- `apps/mobile/lib/notifications.ts` (new), the one module that imports `expo-notifications`:
  - `notificationsPreference()` and `saveNotificationsPref()` over AsyncStorage
    (`app:notifications:v1`), as `lib/haptics.ts` does; the bubble's asked count and the last
    line index in the same key.
  - `permissionState()` → `'on' | 'off' | 'denied' | 'unasked'` (preference and iOS together).
  - `requestPermission(from)`, which fires `notification_permission_result`.
  - `scheduleNudges(pet, needs, profile)` (cancel all, then `planNudges` and `pickLine`, then
    schedule each with a date trigger and the payload `{ kind: 'nudge', day, need }`), and
    `cancelNudges()` (cancel pending, dismiss delivered).
  - `setNotificationHandler` returning no banner, sound or list while the app is open (R8).
- `apps/mobile/hooks/useNudges.ts` (new), mounted once in the with-pet part of
  `app/_layout.tsx`:
  - `AppState` `background` → `scheduleNudges` from the query cache's pet, needs and profile
    (no request; if the cache has no needs, nothing is scheduled).
  - `active` → `cancelNudges`, then re-read `permissionState`.
  - The response listener and `getLastNotificationResponseAsync` (cold start): fire
    `notification_tapped`, route to Home, and keep `{ day, need }` for Phase 3's greeting
    call.
- `app/_layout.tsx`: `cancelNudges()` in the `SIGNED_OUT` branch, and the asked count reset
  (R19).
- `apps/mobile/components/pet/NotifyAsk.tsx` (new): the bubble's action row (R13–R14), shown
  by Home after a confirmed care while `permissionState()` is `unasked` and the asked count
  allows; Yes → `requestPermission('bubble')`.
- `apps/mobile/app/(tabs)/index.tsx`: places `NotifyAsk` in the action row under a care
  reaction line.
- `apps/mobile/hooks/usePetAction.ts`: on success, tells Home a care was confirmed (the ask's
  trigger). No change to what it sends.
- `apps/mobile/app/(tabs)/settings.tsx`: the "Notes from {name}" `Toggle` row with a bell icon
  (`lucide-react-native`), the "Off in iOS Settings" state and `Linking.openSettings` (R15);
  `notifications_changed`.
- `apps/mobile/app/privacy.tsx`: one line about local notifications (R22).
- Tests: `notifications.test.ts` (with `expo-notifications` mocked: cancel before schedule,
  nothing scheduled with the toggle off, refused, signed out or without a pet; three at most);
  a render test for `NotifyAsk` (shown once, then once more after 3 days, then never).

**Verify:**

- On the Simulator, with `NUDGE_MIN_AWAY_MS` set to 10 s and the window widened in a local,
  uncommitted edit (no database write): Feed → the bubble asks → Yes → iOS prompt → background
  the app → a note in the pet's voice → tap → Home.
- Reopen before it fires: nothing arrives (cancelled).
- Settings off → background → nothing. Refuse in iOS Settings → the row says so and opens
  them.
- Sign out with notes pending → nothing arrives.
- On Mert's iPhone, one real day: the day-1 note lands in the window, at most one.
- VoiceOver on the ask and the toggle; 44pt targets.
- Gates: `local-review`, and `store-review` for the permission and 4.5.4.

**Stop: demo-ready. Updates log, gates, commit message.**

## Phase 3 — Counting the opens (after memory's Phase 5 merges)

> **Built 2026-10-06** on top of memory's Phase 5 (the voice lane), waiting for Mert's check.
> As planned. The days and states are in `@app/contract` (`NUDGE_DAYS`, `NOTES_STATES`). The
> greeting waits 400 ms after the app comes back, because iOS can report a tapped note just
> after the app turns active, and the open would otherwise be sent without it.

**Files:**

- `packages/contract`: `petGreeting`'s body gains optional `via: 'notification'`, `day`,
  `need` and `notifications` (the state). Additive: an older build sends neither.
- `apps/web/src/app/api/app/v1/pet/greeting/route.ts` (memory's): records
  `notification_opened` when `via` is set, whatever the bucket (R17), and `notifications_state`
  daily. The return line is unchanged.
- Route tests: an open recorded under 6 hours away; nothing recorded without `via`; a bad
  `day` or `need` refused with a 400 before any write; the state deduped per day.
- `apps/mobile/hooks/useGreeting.ts` (memory's) or Home's greeting call: passes the kept
  `{ day, need }` once, and the state on every call.

**If the greeting route isn't merged yet, this phase waits** (Decision 11). No temporary route:
Phases 0–2 demo without it, and opens are counted from the day the greeting lands.

**Verify:** tap a note on the Simulator, then
`select name, metadata from analytics_events where name like 'notification%'` in the local
database: one `notification_opened` with its day and need.

## Phase 4 — Finish

> **Done 2026-10-04.** The screen spec ("Notes from Mochi" in Shared logic, Home's notes ask,
> Settings' row, the "Not in v1" line), product.md's v2 decisions, this file and the
> requirements' status, `check:store`, and the `store-review` skill's verdict below.

**Store review (2026-10-04).** Diff base: `origin/main`. There is no store release to tag:
the play is localhost only. **A store build, not an OTA update**, because expo-notifications
adds native code and an `app.json` plugin. `npm run check:store -- --strict`: 8 of 8 met, 0
pending.

| Trigger                                      | Requirement                                                                   | Met?                        | Guideline   | Where                                                                                                                                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A permission-using module (notifications)    | Asked at the moment it is needed, never at launch; the app works when refused | yes                         | Apple 5.1.1 | Asked only from the bubble after a confirmed care (`app/(tabs)/index.tsx`, `offerNotes`) or the Settings toggle; refused leaves everything working and Settings points to iOS |
| Push notifications                           | Asked in context; no marketing; the app works without them                    | yes                         | Apple 4.5.4 | Local notes about the pet's needs only, at most one a day and three in all; never promotional; no push token or entitlement (`plugins/withLocalNotificationsOnly.js`)         |
| A new third-party SDK (`expo-notifications`) | Privacy manifest entries; privacy labels match what it collects               | manifest yes; labels: human | Apple 5.1.1 | `check:store` privacy manifest rule met; nothing leaves the phone (no token), and the privacy page says so (`app/privacy.tsx`)                                                |

**Verdict: NEEDS A HUMAN** (a store build, when there is one). Everything a file can decide is
met. At submission, a person confirms the App Store privacy labels: local notifications collect
nothing, so they add no data type. Nothing is submitted during the hackathon.

- The screen spec: Settings' new row, Home's ask, "Out of scope" no longer listing
  notifications.
- product.md's v2 decisions, and this file's status.
- `npm run check:store` and the `store-review` skill (4.5.4, 5.1.1).

## Risks

- **Signing (Phase 0).** A notifications entitlement the free account can't sign would block
  the iPhone build. Found first, before any app code.
- **A rebuild regenerates `ios/`.** The Sign in with Apple fix has to be redone, and the memory
  session's next rebuild meets this plugin too. Tell that session when Phase 0 lands.
- **Stale notes.** A note scheduled from needs that changed on another phone, or from a cache
  that was out of date, says the wrong thing. Mitigated by re-reading needs on every return
  (`usePetNeeds`), cancelling on every return, and lines that still read true.
- **A note at a bad time** (time zone travel, DST). Covered by tests on `planNudges`, and the
  next return reschedules.
- **Merge with the memory session.** Both edit `apps/web/src/lib/analytics/events.ts`,
  `apps/mobile/lib/analytics.ts`, `app/_layout.tsx` and Home. Phase 3 edits a route that
  session owns. Kept to additive blocks, and Phase 3 waits for its merge.
- **Nothing touches money, entitlement, auth or the Play Stats API.** Plus and free get the
  same notes.
