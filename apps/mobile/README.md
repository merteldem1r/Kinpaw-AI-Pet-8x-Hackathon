# Kinpaw: the iOS app

The Expo app (`@app/mobile`): Expo SDK 55, React Native 0.83, expo-router, TanStack Query,
NativeWind, Reanimated. What Kinpaw is: the [root README](../../README.md) and
[product.md](../../docs/application/product.md). Every screen, state and line of copy:
the [screen spec](../../docs/application/UI/kinpaw-screen-spec-v1.md).

## Run it

Set up the local stack first ([root README, "Run it locally"](../../README.md#run-it-locally)),
then from the repo root:

```bash
npm run web:dev                       # the API this app reads, on :3000
cd apps/mobile && npx expo run:ios    # builds the app and opens the Simulator
npm run mobile:start                  # later runs: Metro only; press i for the Simulator
```

The app is a **development build**, not Expo Go: it has native modules (speech recognition,
audio, notifications, the camera). Build again with `npx expo run:ios` after any native change:
a dependency with native code, or `app.json` plugins and permissions.

- **On an iPhone:** scan Metro's QR code. `.env.local` keeps `127.0.0.1`; the app follows
  Metro's host ([local device networking](../../docs/memory/local-device-networking.md)).
  Signing with a free Apple account needs the Xcode fix in
  [xcode-free-account-signing](../../docs/memory/xcode-free-account-signing.md), and a native
  rebuild can undo it.
- **Signing in:** any email; the code is in the local mail catcher at <http://127.0.0.1:55324>.

## How it's organised

```
app/                    screens (expo-router: a file is a route)
  index.tsx             Welcome
  (create)/             create your pet, signed out: start, photo, build, name, personality, meet
  (auth)/login.tsx      save your pet / sign in with an emailed code
  (tabs)/               My pet (Home), Friends, Profile, Settings
  intro.tsx, memories.tsx, change-look.tsx, pet/, friends/, upgrade.tsx (the paywall), …
components/
  ui/                   the primitives: Button, Text, Sheet, Screen, TextInputField, …
  pet/                  the pet and Home's parts: PetArt, PetStage, NeedPill, TalkControls, …
  home/ intro/ friends/ voice/ plus/ profile/ motion/
hooks/                  one hook per server resource (usePet, useTalk, useMemories, useFriends, …)
lib/                    everything that isn't a component: api, analytics, petLines, speech,
                        petVoice, notifications, petDraft, signIn, logger, …
contexts/               theme, toast, the pet draft, the subscription
__tests__/              Jest, for lib/ and the components that draw the pet
```

**Where a signed-in person lands** is decided once, in `app/_layout.tsx`: no session or no pet
on the server → Welcome and Create; a pet → Home. A pet being made while signed out is a draft
on the phone (`lib/petDraft.ts`), saved to the server after sign-in.

## How data flows

- **The server is the one source of data.** Supabase on the phone is sign-in only
  (`lib/supabase.ts`); everything else goes through `api()` in `lib/api.ts`, a typed fetch over
  `/api/app/v1` built from `@app/contract`. It sends the access token, parses every response
  with the contract, and throws an `ApiError` with a message written for the person. A failed
  request is an error state, never an empty list.
- **Hooks own the server state** with TanStack Query. Care actions are optimistic
  (`hooks/usePetAction.ts`): the needs change on screen at once with the same rules the server
  runs (`@app/contract`), and the server's answer is the truth.
- **The needs are decayed on the phone** between fetches, in the phone's time zone, so the
  meters move while the app is open without polling.
- **Talking** is speech recognition on the phone (`lib/speech.ts`), a POST to the talk route,
  and the reply's voice from the server (`lib/petVoice.ts`). Notes from the pet are local
  notifications the phone schedules (`lib/notifications.ts`); no push server.
- **Kinpaw Plus** is read from the server's profile (`hooks/usePlus.ts`); the app never decides
  it.

## Adding a screen or feature

1. Spec it in `docs/application/features/` (the `spec` skill).
2. Register its events in `lib/analytics.ts` first (the `events` skill); `check:events` fails
   on an unregistered one.
3. Add the endpoint to `packages/contract`, the route in `apps/web`, then a hook in `hooks/`.
4. Build the screen from `components/ui`, with brand tokens only (a test fails on a hex
   literal), 44 pt targets and VoiceOver labels ([components](../../docs/rules/components.md)).

## Tests and checks

```bash
npm run mobile:test     # Jest (also runs packages/brand's tests)
npm run typecheck       # from the root, every workspace
```

The full set CI runs is in the [root README](../../README.md#quality).

## Later, at launch

This build runs on localhost only: RevenueCat, Sentry, PostHog, EAS and the stores are wired but
not configured. How they ship is in [docs/rules/ota.md](../../docs/rules/ota.md),
[mobile-releases.md](../../docs/rules/mobile-releases.md),
[store-review.md](../../docs/rules/store-review.md) and
[docs/LAUNCH_TODO.md](../../docs/LAUNCH_TODO.md).
