# v2 Friends — requirements

> **Status: specced 2026-10-06, decisions taken with Mert** (see Decisions at the end). Built
> 2026-10-06 (Phases 1–4), not yet tried on a device: Mert's check next. Plan: [v2-friends-plan.md](v2-friends-plan.md). The roadmap's "simple social (friends
> and their pets), kept small and on its own branch" (v2: week 1); the idea is
> [ideas.md, "Friends by QR code"](../ideas.md). Built in its own lane
> (`social-friends-qr-174b580b`) beside the other v2 lanes.

## What is there today

- **Nothing social.** No table, route or screen relates one account to another. Every
  `/api/app/v1` route reads only the verified caller's own rows (`createAppRoute`,
  `apps/web/src/server/api/app-route.ts`).
- **Tabs: My pet · Profile · Settings** (`apps/mobile/app/(tabs)/_layout.tsx`). A tab is added
  by a file in `app/(tabs)/`, a `<Tabs.Screen>` and its name in `TAB_EVENT_NAMES`
  (`components/TabBar.tsx`), which types `tab_selected`'s `tab`.
- **A pet can be drawn for anyone from its stored appearance.** `PetArt` draws any appearance
  in any mood; the wire shape is `toWirePet` (`apps/web/src/server/api/pet-wire.ts`). Mood is
  `moodFor(needs)` and decay `decayNeeds(stored, storedAt, now, timeZone)`, both in
  `@app/contract` (`src/v1/needs.ts`), shared by app and server.
- **The owner's time zone is not stored.** Routes receive the phone's `time_zone` per request
  (actions, talk, greeting) and keep none. Decay's night window depends on it, so the server
  can only decay a friend's pet in the _viewer's_ time zone (Decision 5).
- **The profile photo is private** (product.md: "only its owner is ever sent a link to it").
  `profiles.display_name` (1–80 characters, set on Edit profile) may be null.
- **Deep links:** the app's scheme is `cozypet` (`app.json`), `expo-linking` is installed and
  expo-router maps a URL path to a route. Signed out, or signed in without a pet, the routes
  under the "with a pet" `Stack.Protected` group (`app/_layout.tsx`) can't be reached, so a link
  that arrives then must be kept and finished later. There is no `app/+native-intent.tsx` yet.
- **No camera scanner.** `expo-camera` is not installed; the camera purpose string in `app.json`
  is the image picker's. The iPhone's own Camera app reads QR codes and offers to open a
  custom-scheme URL in the app that registers it.
- **`react-native-svg` is installed**, so a pure-JS QR renderer (`react-native-qrcode-svg`)
  needs no native rebuild.
- **PostHog is not configured** ([[hackathon-localhost-only]]): only first-party events, recorded
  by web routes into `analytics_events`, can judge this feature locally.

## Problem

Kinpaw is one person and their pet. Nothing in it involves anyone else, so it never gets passed
from one person to the next, and a friend who also has a pet has no way to see it. "Look at
Ece's cat, it's sleepy" is a small, warm reason to open the app, and it costs nothing in AI.

## Success criteria

- **Adoption:** of people with a pet, the share who have at least one friend
  (`friend_added`, first-party, either side of the pair).
- **Return value:** days per person on which the friends list was opened with at least one
  friend in it (`friends_viewed`, first-party, one per person per day).
- **Demo:** account A shows its code on the Simulator, the iPhone (account B) scans it with the
  Camera app, confirms, and both lists show the other's pet in its current mood.

## Requirements

### The Friends tab

R1. A **Friends** tab, second: My pet · Friends · Profile · Settings, with a people icon
(`lucide-react-native`'s `Users`). `tab_selected` gains `tab: 'friends'`.

R2. **Empty state** (no friends): a few lines on what it is ("See your friends' pets. Show them
your code, or scan theirs."), the person's own pet, and two buttons: **Show my code** and **Add a
friend**.

R3. **The list**, newest friend first: per friend, the pet drawn with `PetArt` in its current
mood, its name, "{display name}'s cat/dog" and a short mood word (happy, content, sad,
sleepy). Above the list, the same two actions as compact buttons. Tapping a friend opens their
pet's page (R11). Pull to refresh; refetched when the tab gains focus and when the app returns to
the foreground.

R4. **Loading, error and offline** states follow the app's pattern: a failed load is an error
with Retry, never an empty list (`docs/rules/error-handling.md`).

R5. **At most 50 friends** per person (`FRIENDS_MAX` in `@app/contract`). At the cap, adding says
so; nothing else changes.

### My code

R6. **Show my code** opens a sheet with: a QR code for `cozypet://friends/add?code={code}`, the
code as text in two groups of four (`KP7X-M3QD`), the person's pet, and:

- **Share**: the system share sheet with a short message, the code and the link.
- **New code**: replaces the code after a confirm ("Your old code will stop working. Friends you
  already have stay."). This is also how someone stops a code that went further than they meant.

R7. **The code** is 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L), made by
the server from a cryptographic random source, unique, created the first time it is asked for.
It is not derived from the user id and holds nothing else. Typed codes are read without case,
spaces or the dash.

### Adding a friend

R8. **Three ways in, one screen** (`app/friends/add.tsx`):

- **The iPhone's Camera app** scans the QR; iOS offers to open Kinpaw on
  `cozypet://friends/add?code=…`, which opens the add screen with the code filled in.
- **A shared link** opens the same way.
- **Add a friend → type a code**: a field for the 8 characters (the Simulator has no camera).

Once a code is in, the server is asked who it belongs to, and the screen shows **their pet and
display name** with **Add friend** and **Not now**. Nothing is added before Add friend.

R9. **Outcomes on Add friend**:

- Added: both people are now friends of each other (no request to accept: showing your code is
  the consent). The add screen closes onto the friend's pet page, with a haptic.
- Already friends: the same page, with no error.
- Own code: "That's your own code." Unknown or replaced code: "That code didn't work. Ask your
  friend to show it again."
- Cap reached (either side): "You can have up to 50 friends." / "They can't add more friends
  right now."
- Network or server failure: the error line with Retry; the code is kept.

R10. **A link that arrives before there is a pet** (signed out, or mid-Create) is kept on the
phone (AsyncStorage, one pending code, dropped after 24 hours) and the add screen opens once the
pet is saved and Home has shown. Signing out drops it. A link while the app is already on the
add screen replaces its code.

### A friend's pet

R11. **The friend's pet page** (`app/friends/[id].tsx`, pushed): the pet in its mood under the
sky band (at the viewer's time of day), its name, species, "{display name}'s cat/dog", "Friends
since {date}", and its four needs as **words, never numbers**: low / okay / good per need
(low under `LOW_NEED`, good at `ALL_GOOD` or more), with a line from the lowest need ("Luna's a
bit hungry"). Read-only: no care buttons, no talking.

R12. **Remove friend** at the bottom of the page, after a confirm. It removes the friendship for
both people; neither is told. To stop being re-added, the person makes a New code (R6).

### What a friend may see (privacy)

R13. A friend is sent only: the friendship id and date, the friend's display name (or, when
null, "{pet name}'s human"), and their pet's appearance, name, species, mood and need bands.
**Never** the email, the profile photo, exact need numbers, traits or preset, memories,
anything said in talking, Plus status, notes or activity times. A test checks the wire shape
against this list.

R14. **The server decides everything**: the caller is the verified user; friendship is looked up
by the caller's id; a friend's pet is read only through an existing friendship. The app never
sends a user id. Mood and bands are computed on the server, in the caller's time zone (sent as
`time_zone`, as care routes do).

R15. **Deleting an account** deletes its code and its friendships (foreign keys, cascade); it
leaves each friend's list on the next refresh.

R16. **The privacy text** (`app/privacy.tsx`) says that friends you add see your display name
and your pet, and nothing else.

### API (`/api/app/v1`, `auth: 'user'`, contract in `@app/contract`, `src/v1/friends.ts`)

R17. `GET /friends?time_zone=` → `{ code, friends: Friend[] }`. Creates the code when there is
none. Records `friends_viewed` first-party (deduped per day) when the list is not empty.

R18. `POST /friends/lookup` `{ code }` → `{ friend: FriendPreview }` (display name and pet, no
ids), or 404 / 400 (own code). Writes nothing.

R19. `POST /friends` `{ code, source: 'link' | 'typed', time_zone }` → 201 `{ friend }` added, 200
already friends; 400 own code; 404 unknown; 409 cap. Safe to retry. Records `friend_added`
first-party for both people.

R20. `DELETE /friends/:id` → 200, also when it was already gone (idempotent). Only a friendship
the caller is in. Records `friend_removed`.

R21. `POST /friends/code` → `{ code }`: a new code; the old one stops working at once.

### Data

R22. Two tables, written only by these routes through Prisma, RLS on with no policies and
nothing granted (the security migration every new table gets):

- `friend_codes`: `user_id` (primary key, → profiles, cascade), `code` (unique), `created_at`.
- `friendships`: `id`, `user_low`, `user_high` (the pair in id order, both → profiles,
  cascade), `created_at`; unique on the pair, indexed on each side.

## Events

Registered with the `events` skill before any screen. First-party ones are what judge it here.

| Event                | Fired by                    | Sinks                    | Discriminators / metadata                      |
| -------------------- | --------------------------- | ------------------------ | ---------------------------------------------- |
| `friend_added`       | `POST /friends` (web)       | first-party, both people | `source`: link, typed; `friend_count` (after)  |
| `friend_removed`     | `DELETE /friends/:id` (web) | first-party, the remover | `friend_count` (after)                         |
| `friends_viewed`     | `GET /friends` (web)        | first-party, 1 a day     | `friend_count`                                 |
| `tab_selected`       | TabBar (app)                | PostHog                  | `tab` gains `friends`                          |
| `friend_code_shown`  | My code sheet (app)         | PostHog                  | `source`: empty_state, list                    |
| `friend_code_shared` | Share on the sheet (app)    | PostHog                  | none                                           |
| `friend_code_reset`  | New code confirmed (app)    | PostHog                  | none                                           |
| `friend_add_opened`  | Add screen (app)            | PostHog                  | `source`: link, typed                          |
| `friend_add_failed`  | Add screen (app)            | PostHog                  | `reason`: own_code, unknown_code, cap, network |
| `friend_pet_viewed`  | Friend's pet page (app)     | PostHog                  | `mood`                                         |

No event carries a code, a name or the friend's id. Not Play Events: no email flow runs on these.

## Scope: v2 now and later

- **Now:** everything above.
- **Later:** an in-app scanner (`expo-camera`, a native rebuild and a rewritten camera purpose
  string); "send a paw" (a small gesture the friend's pet mentions in its bubble); the owner's
  time zone stored so a far-away friend's pet sleeps on its own night; a friend's profile photo
  (a deliberate change to the photo's privacy); a report action and a limit on wrong codes,
  before real users (Open questions).

## Out of scope

Friend requests and accepting, search by name or email, contacts import, chat or any text
between people, a feed, likes, leaderboards, notifications about friends, caring for or talking
to a friend's pet, Android, universal links (they need a hosted domain; localhost only).

## Decisions

1. **Scanning with the iPhone's Camera app**, a `cozypet://` deep link, a typed code and the
   share sheet; no native rebuild. The in-app scanner comes later (Mert, 2026-10-06).
2. **View-only list for now**: no "send a paw" (Mert, 2026-10-06).
3. **Friends see the pet plus the display name only**: never the profile photo, memories, talk
   or Plus status (Mert, 2026-10-06).
4. **The tab is "Friends", second** (Mert, 2026-10-06).
5. **Mutual on add, with a preview first**: showing your code is consent; the scanner confirms
   after seeing whose pet it is. A friend's pet is decayed in the viewer's time zone (friends
   added in person are almost always in the same one); storing the owner's is later.

## Open questions

- [ ] **App Review 1.2 (user-generated content)** before a store build: pet and display names
      are now shown to other people. Adds are in person only and removal plus a new code stop
      someone, which may be enough; a "Report" action and a name filter may still be asked for.
      Decide at the store-review pass, not now.
- [ ] **A limit on wrong codes** (say 20 an hour per account). 30⁸ codes make guessing
      impractical, so it waits for launch unless Mert wants it now.
- [ ] **Does iMessage make a `cozypet://` link tappable?** If not, the shared message leads with
      the code to type. Checked in Phase 0.
