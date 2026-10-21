# v2 Daily notification in the pet's voice — requirements

> **Status: specced 2026-10-04, decisions taken with Mert** (see Decisions at the end).
> Phases 0, 1, 2 and 4 done 2026-10-04, checked by Mert on the iPhone; Phase 3 (R16–R18)
> built 2026-10-06 on the greeting route, waiting for Mert's check. Plan: [v2-notifications-plan.md](v2-notifications-plan.md). v2 item 2 in the
> [roadmap](../roadmap.md#v2-week-1-decided-with-mert-2026-10-02-reordered-2026-10-03); the
> why is [product.md, "v2 decisions"](../product.md#v2-decisions) ("the notification brings
> them back"). It sits beside [long-term memory](v2-memory-requirements.md), built in a
> parallel session, and must fit its "I missed you" (memory R26–R28) without repeating it.

## What is there today

- **No notifications at all.** `expo-notifications` is not installed and not in `app.json`'s
  plugins. The template's sample `notifications` table and its routes were dropped on
  2026-10-01 (`docs/memory/sample-tables-dropped.md`); nothing reuses that name.
- **The needs are computable on the phone.** `decayNeeds(stored, storedAt, now, timeZone)`,
  `LOW_NEED` (30), the night window (`NIGHT_STARTS` 23, `NIGHT_ENDS` 7) and `lowestNeed` live in
  `@app/contract` (`src/v1/needs.ts`), shared by the app and the server. From the pet's stored
  needs the phone can work out the minute a need will drop below 30, without asking the server.
  By day hunger falls 12 points an hour, so from full it is low in about 6 hours.
- **Home already re-reads on return.** `hooks/usePetNeeds.ts` listens to `AppState` and
  recomputes on `active`. Sign-out and account deletion end in the auth listener's `SIGNED_OUT`
  (`app/_layout.tsx`).
- **The bubble's lines** (`lib/petLines.ts`) come from the lowest need, per species, and
  "I missed you" is today only the affection-low line.
- **Device preferences** live in AsyncStorage (haptics: `lib/haptics.ts`, key
  `app:haptics:v1`, toggled from Settings with `haptics_changed`).
- **"I missed you" (memory, Phase 5) is not built yet.** It will add `pets.last_seen_at` and
  `POST /api/app/v1/pet/greeting` (away buckets: under 6 h, 6–24 h, 1–3 d, over 3 d; the due
  follow-up question; `greeting_shown`, first-party). This feature's measurement depends on it
  (R16–R17).
- **PostHog is not configured** (`docs/memory/hackathon-localhost-only.md`): the app's `track()`
  events go nowhere locally. Anything that judges this feature has to be recorded first-party,
  by a web route.
- **Push to a server-side device token is not possible here.** Remote push needs the Push
  Notifications entitlement (APNs), which Mert's **free Apple account** cannot sign, and a
  server that runs while his Mac is off. Both break the localhost-only rule. Local
  notifications, scheduled on the phone, need neither.

## Problem

Kinpaw gives a reason to open it on day 1, and nothing reaches out after that. The pet gets
hungry and lonely while the app is closed, but nobody hears about it until they happen to open
the app again. The core feeling, "someone missed me", only lands if the someone can say so
while you're away.

## Success criteria

- **The pet reaches you while you're away, in its own voice**: a single note on the lock screen
  at the moment it would start missing you, never at night, never more than one a day, and
  silent after three unanswered days.
- **Tapping it brings you home**, and Home's return line ("I missed you", memory R26) takes it
  from there, so nothing is said twice.
- **Measured first-party** (`analytics_events`, no PostHog):
  - `notification_opened` per day, by `day` (1, 2, 3) and the `need` that sent it.
  - The share of people with notifications on (`notifications_state`, recorded daily).
  - D1, D3 and D7 return for accounts with notifications on against those without, joined to
    `pet_action_taken` and `talk_reply_received` days. This is the reviewer's day-7 question
    again, from the "bring them back" side.
- **Nothing breaks without it**: refused permission, the toggle off, or the greeting route down
  all leave the app working exactly as today.

## Requirements

### Delivery

- **R1. Local notifications only, scheduled on the phone** with `expo-notifications`. No push
  token is requested, nothing is registered with a server, and no notification is sent by the
  server. Remote push is a launch task (v3).
- **R2. No model call.** The lines come from a written bank (R9–R11). Groq's quota is untouched.
- **R3. iOS only**, as the rest of the play (`docs/memory/ios-only.md`). Android channels are
  not set up.

### When it fires

- **R4. The first note fires when the pet's first need would drop below 30 after you leave.**
  "Leave" is the app going to the background. The phone projects the needs forward with
  `decayNeeds` from the last needs it holds (the stored values and their `updated_at`) in the
  phone's time zone, and finds the first moment `lowestNeed` reads below `LOW_NEED` as a whole
  number.
- **R5. Never sooner than 3 hours after you leave** (`NUDGE_MIN_AWAY`). If a need is already
  low when you leave, the note waits 3 hours: closing the app is not a reason to be pinged.
- **R6. Only in waking hours, 09:00–21:00 local** (`NUDGE_WINDOW`). A moment outside the window
  moves to the next 09:00. This is narrower than the pet's sleep (23:00–07:00) on purpose: a
  pet that wakes at 7 still doesn't buzz you at 7.
- **R7. At most one a local day, and three in all.** Day 1 fires per R4–R6. Days 2 and 3 fire
  24 hours after the one before, moved into the window. After the third, nothing more until the
  app is opened again. No notification on day 4 or later, however long you're away.
- **R8. Every return starts over.** When the app becomes active, every pending Kinpaw
  notification is cancelled and the delivered ones are cleared from the notification centre.
  When it goes to the background, the three are scheduled again from the current needs. So a
  note never describes a pet you just cared for on this phone, and opening the app is the only
  "reset" needed. Nothing shows while the app is open.

### What it says

- **R9. The line is in the pet's voice, first person, from the need that went low.** A bank of
  lines per need (hunger, happiness, energy, affection) and species (cat, dog), with day 2 and
  day 3 lines that miss you more but never guilt you: no starving, crying, dying or "you forgot
  me". The tone is the bubble's ("I saved you the warm spot", "Is it dinner o'clock? Asking for
  me.").
- **R10. The title is the pet's name** and the body is the line. Your name (`display_name`,
  when set) appears in some lines, as in talking. If the pet's name or yours is missing, a line
  without it is used.
- **R11. Lines rotate**: the same line is not used twice in a row on a phone (the last one's
  index is kept with the schedule).
- **R12. No memory in notifications.** A note never mentions a remembered fact or a due
  follow-up, never shows anything the person said, and carries nothing in its payload but its
  `day` and `need`. What the pet remembers is for the app, behind the lock (Decision 3).

### Asking for permission

- **R13. The pet asks first, after your first care.** After the server confirms a Feed, Play or
  Pet (`pet_action_taken`), and only while iOS permission is "not asked yet", the bubble's
  action row offers "Tell me when Mochi misses you?" with **Yes** and **Not now**, under the
  care reaction line. Yes shows the iOS prompt. It never appears at launch, on Welcome, Create,
  sign-in or the intro (Apple 4.5.4, 5.1.1).
- **R14. Not now is asked again once**, after a care at least 3 days later. After two Not nows,
  or once iOS has an answer, the bubble never asks again; Settings is the way in (R15).
- **R15. A "Notes from Mochi" toggle in Settings**, stored on the phone like haptics
  (`app:notifications:v1`), on by default once permission is granted.
  - Off cancels every pending note at once. On schedules them at the next background.
  - With iOS permission not asked yet, turning it on shows the iOS prompt.
  - With iOS permission refused, the row reads "Off in iOS Settings" and opens the app's iOS
    settings page (`Linking.openSettings`); the toggle shows off.
  - The app checks iOS permission on every return, so a change made in iOS Settings shows.

### Coming back from a note

- **R16. Tapping a note opens Home**, the pet's tab, from a cold start or the background, and
  the next greeting call carries `via: 'notification'` with the note's `day` and `need` (an
  additive field on memory's `POST /pet/greeting`, R28 there). The greeting's return line works
  as it does for any return; the note adds nothing to it.
- **R17. The greeting route records `notification_opened` first-party** when `via` is
  `notification`, whatever the away bucket (a day-1 note can fire after 3–6 hours, when memory's
  `greeting_shown` is not recorded). The same call carries `notifications: 'on' | 'off' |
'denied' | 'unasked'`, recorded once a local day as `notifications_state`.
- **R18. If the greeting route is not there yet or fails**, the tap still opens Home; the open
  is lost to first-party numbers, never retried.

### Lifecycle and privacy

- **R19. Signing out and deleting the account cancel every pending note** and clear delivered
  ones, from the auth listener's `SIGNED_OUT`, so the next person on the phone is never told
  about someone else's pet. The toggle's value stays on the phone (a device preference), the
  bubble's "asked" count resets.
- **R20. No pet, no notes.** Nothing is scheduled while signed out or before a pet is saved.
- **R21. Each phone schedules its own.** A care on another phone doesn't cancel this one's
  notes (no server in the loop); the lines are worded so a stale one still reads true ("I keep
  thinking about you").
- **R22. Nothing leaves the phone** for this feature except R16–R17's labels. No notification
  content, schedule or token is sent anywhere. The privacy page gains a line about local
  notifications.

## Events

Registered with the `events` skill before the screens that fire them. Never a line's text, a
name, or anything said.

**First-party, recorded by the greeting route** (`apps/web/src/lib/analytics/events.ts`, a new
`NOTIFICATION_EVENTS` group; not Play Events):

| Event                 | When                                       | metadata                                                                       | Dedupe                          |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------- |
| `notification_opened` | a greeting call with `via: 'notification'` | `day: 1 \| 2 \| 3`, `need: 'hunger' \| 'happiness' \| 'energy' \| 'affection'` | daily                           |
| `notifications_state` | a greeting call                            | `state: 'on' \| 'off' \| 'denied' \| 'unasked'`                                | daily, `dedupeMatch: { state }` |

**App, PostHog** (the `EventName` union in `apps/mobile/lib/analytics.ts`):

| Event                            | When                                    | metadata                                           |
| -------------------------------- | --------------------------------------- | -------------------------------------------------- |
| `notification_prompt_shown`      | the bubble's ask appears (R13)          | `attempt: 1 \| 2`                                  |
| `notification_prompt_answered`   | Yes or Not now                          | `answer: 'yes' \| 'not_now'`, `attempt: 1 \| 2`    |
| `notification_permission_result` | iOS answered its prompt                 | `granted: boolean`, `from: 'bubble' \| 'settings'` |
| `notifications_changed`          | the Settings toggle                     | `enabled: boolean`                                 |
| `notification_tapped`            | a note opened the app (before any call) | `day`, `need`                                      |

The funnel is notification_prompt_shown → notification_prompt_answered (yes) →
notification_permission_result (granted) → notification_opened. The drop-offs are Not now, a
refusal, and notes that are never opened (seen only as notifications_state `on` with no opens).

## Scope: v2 now and later

| Now (this feature)                                         | Later                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| Local notes, need-driven, 09–21, one a day, three in all   | Remote push from the server (launch, paid Apple account, APNs) |
| A written line bank per need, species and day              | Lines written by the model, or by personality preset           |
| The bubble's ask after the first care; one Settings toggle | Quiet hours or a preferred time chosen in Settings             |
| `via: 'notification'` and the state on the greeting call   | A note that cancels on every phone when one cares (server)     |
| English                                                    | Other languages                                                |

## Out of scope

Remembered facts and follow-ups in a note (Decision 3), remote push and push tokens, a model
call per note, badges and sounds of our own, rich notifications (images of the pet, actions on
the note such as "Feed"), Android, streaks, marketing or Plus notes of any kind. Plus and free
get the same notes: the core feeling is not paywalled.

## Decisions

Taken with Mert on 2026-10-04, who took each recommendation except where noted (1–8 while
brainstorming, 9–11 after reading the draft):

1. **Local notifications only**, scheduled on the phone; remote push at launch.
2. **When:** the moment the first need would go low after you leave, inside 09:00–21:00, at
   most one a day.
3. **Memory is left out of notifications** (Mert's choice, over a "something to ask you"
   hint): no fact, follow-up or hint of one. Fewer ways to leak, and no dependency on the
   memory session's content.
4. **The ask:** in the bubble, after the first confirmed care.
5. **Measured through the greeting call** (`via`, plus the daily state), first-party.
6. **The voice:** a written line bank, no model.
7. **Stop rule:** three days, then silence until the app is opened.
8. **Settings:** one on/off toggle.
9. **At least 3 hours away** before the first note (R5), and **09:00–21:00** for every note
   (R6). Both are named constants, tuned in the day of play.
10. **Not now is asked again once**, after a care 3 or more days later, then never from the
    bubble (R14).
11. **Phase 3 waits for the memory session's greeting route.** No temporary route of our own:
    Phases 0–2 demo without it, and opens are counted from the day the greeting lands.

12. **The spec review** (Mert, 2026-10-04, on a review page of the lock-screen notes): the line
    bank stays as written, no line changed or cut. The title is the pet's name; a note uses the
    first word of the person's name; a sleepy pet does send a note; days 2 and 3 miss you a
    little more; the ask reads "Tell me when Mochi misses you?" with Yes and Not now (was open
    question B); the Settings row is "Notes from Mochi".

## Open questions

None. Open question D was answered in Phase 0 (2026-10-04): expo-notifications' plugin always
adds `aps-environment`, applied whether or not `app.json` lists it, and a free account can't
sign it. `apps/mobile/plugins/withLocalNotificationsOnly.js` applies the plugin itself and
removes the entitlement, so no Xcode fix is needed. Checked on a real prebuild, and a note
arrived on the Simulator.
