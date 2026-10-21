# M6: Talk to your pet — plan

> Requirements: [m6-talk-requirements.md](m6-talk-requirements.md). Each phase leaves `main`
> working and ends with Mert checking it before the next. The model is checked before anything
> is built on it, the schema lands before the code that reads it, and the events before the
> screens that fire them. Typing comes before voice, so the whole loop works on the Simulator
> before the one native rebuild. Written 2026-10-01.

## Phase 0 — The prompt and the model check · done 2026-10-01

> **Result (Mert's run, 2026-10-01, `openai/gpt-oss-20b`): passed.** Intent accuracy 98% (44/45;
> "Forgive me?" read as `kind` without context), upset never harsh, harsh never warm, no invalid
> answers, median 480 ms (slowest 10%: 661 ms), about 1,000 tokens per reply. Reading the replies
> led to two prompt rules added after the run: speak as "I", never narrate in the third person
> ("Biscuit wiggles…"); after harsh words, let the hurt show before forgiving (it had answered
> "Go away, I'm busy" as if nothing was said). Free-tier rate limits slow the check (about 8
> minutes), not the app.

**Files:** new `apps/web/src/server/talk/` with `reply-provider.ts` (the interface and its
typed failures), `groq.ts` (the Groq provider: `fetch` to the OpenAI-compatible endpoint, strict
JSON schema, reasoning effort low, a 10-second timeout, the response parsed with Zod),
`stub.ts` (canned in-character replies by keyword), `prompt.ts` (the system prompt from the pet,
needs, mood and recent exchanges, with every intent defined and exampled) and
`reply-schema.ts` (R5: the Zod check and the 200-character cut); `talk-check.fixtures.ts`
(about 40 labelled phrases); new `apps/web/scripts/talk-check.mts` and a `talk:check` script in
`apps/web/package.json`; `packages/contract/src/v1/talk.ts` with `INTENTS` only (the shared
list both the prompt and later the app use); `apps/web/src/lib/env.ts` and
`apps/web/.env.example` (`GROQ_API_KEY`, `GROQ_MODEL`, names only).
**Changes:** R1–R6. The interface and the prompt are the real ones the route will use in Phase
1, so what is measured here is what ships. No route, no table, nothing in the app. Unit tests for
the prompt builder (each trait and need appears in words, recent exchanges capped at three) and
for R5 (bad intent, empty reply, overlong reply cut at a sentence).
**Verify:** `npm test --workspace=@app/web` for the unit tests. Then **Mert runs**
`npm run talk:check --workspace=@app/web` (it reads the key from `.env.local` itself; the agent
never opens that file) and reads the report: accuracy per intent, the confusions (which intent
was mistaken for which), valid-output rate, median and slowest latency, and every reply. Passing
the bar (open question 2) closes the phase; otherwise tune the prompt or try
`qwen/qwen3.8-27b` (`GROQ_MODEL`) and run it again.

## Phase 1 — The server · built 2026-10-01

> **As built.** Layers, each with one job: the rules and the route's shapes in
> `packages/contract/src/v1/talk.ts`; the stores in `src/server/db/` (`talk.ts` for `pet_talks`,
> `ai-usage.ts`, and `profileStore.isPremium`, now shared with the pet route); the flow in
> `src/server/talk/talk-to-pet.ts`, without HTTP; the route maps its result and records the
> events. The needs lock moved out of `petStore.act` into `changeNeeds` (`db/pets.ts`), which
> Feed/Play/Pet and talking both use, so it exists once. Migrations
> `20261001193125_pet_talks_and_ai_usage` (generated) and `…193126_…_security` (hand-written).
> **Verified:** 52 contract, 184 web and 21 database tests (pets, talk, profiles) on a local
> replay; zero drift; `check:rls` on all 12 tables; lint, typecheck, format and every check
> script. Not run: `web:build` (Mert's dev server was up) and a `curl` against the running
> server, which waits for Mert's `npm run db:migrate`; Phase 2 exercises the route end to end.

**Files:**

- `packages/contract/src/v1/talk.ts` and `talk.test.mts`: the intent table, `TALK_FLOOR` (30),
  the daily caps (+20 affection, +15 happiness), `FREE_TALKS_PER_DAY` (10), `TALK_TEXT_MAX`
  (280), `RECENT_EXCHANGES_MAX` (3), `applyTalk(needs, intent, gainedToday)` (R7),
  `localDay(now, timeZone)`, the body and response schemas; `endpoints.ts` (`petTalk`);
  `common.ts` (a `talk_unavailable` code, 503, for "not connected").
- `apps/web/prisma/schema/talk.prisma` (new): `PetTalk` (`pet_talks`, R10: decided by Mert
  2026-10-01) and `AiUsage` (R16). Migrations: one generated from the schema, one
  hand-written security migration (RLS on, nothing granted), as M5 did.
- `apps/web/src/server/db/talk.ts` and tests: `talkStore.todayFor(petId, localDay)` (count and
  gains), `talkStore.apply(userId, input)`: one transaction that locks `pet_needs` as
  `petStore.act` does, decays, applies `applyTalk` with today's gains, inserts the talk row
  (message id as the key; a conflict means a retry, and nothing changes), stores the needs.
  `aiUsageStore.record(...)`.
- `apps/web/src/server/db/profiles.ts`: one `isPremium(userId)` used by both the pet route and
  the talk route (the pet route's private copy moves here).
- `apps/web/src/app/api/app/v1/pet/talk/route.ts` and `route.test.mts`.
- `apps/web/src/lib/analytics/events.ts` (`TALK_EVENTS`) and `apps/mobile/lib/analytics.ts`
  (every talk event from the requirements, the stale comments removed): the `events` skill.

**Changes:** R7–R16. The route, in order: valid time zone; the caller's pet (404 without one);
premium; a free account with nothing left today gets `{ outcome: 'limit_reached', pet,
messages_left: 0 }` with no model call; otherwise the provider, with the decayed needs, the
mood, the traits and up to three recent exchanges; a failure records `ai_usage` and answers
`talk_unavailable` or `internal` with nothing applied; a good answer goes through
`talkStore.apply`, then `ai_usage`, `talk_reply_received` (first-party, daily per `input`) and,
on the account's first counted reply, `user_activated` (forever). The response: `{ outcome:
'replied' | 'retried', reply, intent, suggested_action, need_changed, pet, messages_left }`. The
words and the reply never reach the logger.
**Verify:** `npm test` (contract: every intent's effect, the floor from above and below 30, both
caps across several messages, energy and hunger untouched, `localDay` around midnight in two
zones; web: the route with a fake provider and fake stores: 404, invalid time zone, limit
reached without a model call, a retry that changes nothing, a failure that counts nothing,
`user_activated` once, premium never limited); the database suites and a local migration replay
(`local-review` has the commands): zero drift, `check:rls` passes on the two new tables. A
`curl` with a real access token against the local server, with the stub and then with Groq.

## Phase 2 — Typing on Home · done 2026-10-01, checked by Mert on the Simulator (replies in character, needs moving, the counter at 2, Go unlimited opening the paywall)

> **As built.** `hooks/useTalk.ts` talks to the route (message id, the three-exchange memory, a
> 20s timeout, outcomes, events; no UI). `components/pet/TalkControls.tsx` is the typing mode
> (a "Say something to {name}" button that opens the field; the counter; the limit look via the
> button's tappable disabled state) and stays as the fallback when the mic is refused in Phase
> 3; `TypingPaws` and `WordsChip` are presentational; `PetBubble`'s unused "Reply →" became a
> general `action` row ("Try again") and takes children in place of the line. Home's room,
> fallbacks and sky target moved, unchanged, to `components/home/` (index.tsx 519 → 358 lines);
> its "happy for a moment" became a face for a moment, so harsh words can show a sad one. The
> uuid helper moved to `lib/ids.ts` (pet ids and message ids). Known for now: the counter
> appears only after the first reply of a session (the count comes with each answer); the mic
> is not shown until Phase 3.

**Files:** new `apps/mobile/hooks/useTalk.ts` (the mutation, the message id, the three-exchange
memory, the 20-second timeout, the states), `components/pet/TalkControls.tsx` (the mic button
in its idle look for now, the keyboard button, the type-instead field, the counter),
`components/pet/WordsChip.tsx`, `components/pet/TypingPaws.tsx`; `lib/petLines.ts` (the talk
lines: dozed off, not connected, all talked out); `app/(tabs)/index.tsx` (wires the hook and
the controls into the stage; no talk logic in the screen); `components/pet/PetBubble.tsx` if the
retry row needs a label other than "Reply".
**Changes:** R18–R23, R30 for what exists so far, and `upgrade_tapped` opening the paywall with
its source. The mic button is shown but opens the field until Phase 3 (or is hidden: Mert's
call when he sees it). The suggested action waits for Phase 4.
**Verify:** on the Simulator against the local stack, with Groq: type to the pet and read the
reply; watch the needs move by the table; say something harsh, then sorry; set the account's
day to 9 talks (Supabase Studio) and see the counter, then the limit and "Go unlimited"; stop
the web server for not connected; a premium account (set in Studio) sees no counter. VoiceOver
reads the reply. `npm run typecheck`, `lint`, `test`, `check:events`.

## Phase 3 — Voice (the native rebuild) · done 2026-10-02, checked by Mert on his iPhone

> **As built.** `expo-speech-recognition@3.1.3` (its `sdk-55` tag; 56.x and 57.x are for newer
> SDKs) and `expo-audio@~55.0.18`. `lib/speech.ts` reads the native module with
> `requireOptionalNativeModule`, so a build without it gets typing, not a crash; listening is
> continuous, `en-US`, on the device when supported. `hooks/useVoice.ts` holds the session
> (permission on first press, live words, the 15s cap, nothing heard, a 2.5s grace if the
> recognizer never reports its end); `components/pet/MicButton.tsx` the gestures (hold ≥ 300 ms
> sends on release, a quicker tap keeps listening until a second tap, sliding 70pt away cancels,
> VoiceOver's tap toggles). `lib/petSounds.ts` plays three bundled clips cut from Mert's files
> (`assets/sounds/`, under a second each, loudness evened): a cat purrs for affectionate, kind,
> apology and upset and meows otherwise, a dog barks; silent switch respected, mixed with other
> audio. `app.json`: one microphone string shared by expo-image-picker, expo-speech-recognition
> and expo-audio, the speech-recognition string, and expo-audio's background playback and Android
> recording off (resolved Info.plist checked: no `UIBackgroundModes`). The privacy pages and
> `docs/rules/permissions-and-privacy.md` say what leaves the phone. Not built: the listening
> pose (cut, agreed with Mert).

**Files:** `apps/mobile/package.json` (`expo-speech-recognition`, `expo-audio`, at the versions
Expo SDK 55 installs); `apps/mobile/app.json` (both plugins, the speech-recognition purpose
string, one microphone string shared by talking and the photo picker); new
`apps/mobile/lib/speech.ts` (start, stop, cancel, partial results, permissions), the mic's hold,
tap and slide-away gestures in `TalkControls.tsx`, new `lib/petSounds.ts` and
`assets/sounds/` (open question 3); `components/pet/PetArt.tsx` for the listening pose (cut if
tight); `app/privacy.tsx`, the website's privacy page and `docs/rules/permissions-and-privacy.md`
(R17).
**Changes:** R24–R29. This is the one native change: `npx expo run:ios` rebuilds the app, and
**Mert redoes the Xcode signing fix** for the iPhone afterwards
([xcode-free-account-signing](../../memory/xcode-free-account-signing.md)). Speech recognition
needs a real microphone: the Simulator uses the Mac's, which works but is less reliable than
the iPhone.
**Verify:** on the iPhone: first press asks for both permissions; hold, speak, release; tap,
speak, tap; slide away cancels; 15 seconds sends by itself; release in silence says "Hm? Say
that again?"; refuse the permission on a fresh install and get the field. `npm run check:store`
and the `store-review` skill (purpose strings, permissions asked in context, the privacy text).

> **Fixed after the first device tests (2026-10-02):** the Simulator has no on-device English
> speech model, so `lib/speech.ts` falls back to Apple's server recognition after the first
> failure, and a recognizer failure is never silent ("I couldn't hear you just now…",
> `talk_cancelled { reason: 'speech_failed' }`); the Simulator's microphone still fails
> (`audio-capture`), so voice is tested on the iPhone. Pet sounds re-apply their playback mode
> before each sound (listening leaves the audio session in recording mode). The words chip has
> a solid `surface2` background. In development a `127.0.0.1` URL follows Metro's host
> (`lib/devHost.ts`), so the iPhone needs no IP edits (memory: local-device-networking). No
> limit text on Home (Mert): the counter and "Go unlimited" are gone; a count badge on the mic
> at 3 or fewer, and at 0 a lock badge on the mic, whose press opens the paywall.

## Phase 4 — Finish · done 2026-10-02, checked by Mert

> **As built.** The suggested action: Home keeps the reply's `suggested_action` and passes it to
> `HomeRoom`, whose tile takes the _wanted_ look when `canHelp` allows it, alongside the
> lowest-need glow (both can glow at once); the pet's idle look turns to it. It clears when that
> action is used or the next message is actually sent. `pet_action_taken` gained `suggested`
> (whether the tile was glowing for the suggestion). Short memory (R23) was already built in
> Phase 2 (`useTalk`). R30 audit: labels, hints, live regions, reduced motion and 44pt targets
> were already in place (the 36pt Close has hit slop to 44); the one gap, "Listening" announced
> to VoiceOver, is now in `MicButton`.

**Files:** `apps/mobile/app/(tabs)/index.tsx` and `useTalk.ts` (the suggested action's _wanted_
look), the talk components (edge states, accessibility), the docs that changed while building.
**Changes:** R9, R30 in full, and whatever Phases 2–3 turned up. Update the screen spec, the
roadmap's M6 status and the memory notes with what was built.
**Verify:** "are you hungry?" makes Feed glow when Feed can help; VoiceOver can do the whole
loop with tap-to-talk; reduced motion stills the mic and the paws; the `local-review` gates.

## Risks

- **The model labels intents wrong**, and the game feels random. Phase 0 measures it before
  anything is built on it; the floor and caps limit the damage of a wrong label.
- **Groq's free tier** (about 200 replies a day, 8 a minute, no uptime promise, free models
  retired without notice). The stub keeps development going without it; the model is
  configuration; a paid provider is one more file.
- **A new table with game state** (`pet_talks`): a migration that is easy to add and awkward
  to reshape later, so its columns are reviewed with Mert before Phase 1's migration is
  generated.
- **Entitlement:** the talk route reads `plan_type`; it never writes it. Premium decides an
  unlimited count, so the read goes through the one shared `isPremium`. Review twice anyway
  (non-negotiable 3).
- **The native rebuild** in Phase 3 undoes the iPhone signing fix, and new permissions are what
  App Review looks at hardest: specific purpose strings, asked in context, refused gracefully.
- **Privacy:** words leave the phone (to Groq). The logger, the events and the database must
  never see them; the Phase 1 tests check that the logger is never called with the text.
- **Home's size:** `index.tsx` is 519 lines. Talking goes into its own hook and components; if
  the screen still grows, `Ready` moves to its own file in Phase 2.
- **Dashboard numbers:** `user_activated` starts firing, so activation appears for the first
  time; nothing else the Play Stats API reports changes.
