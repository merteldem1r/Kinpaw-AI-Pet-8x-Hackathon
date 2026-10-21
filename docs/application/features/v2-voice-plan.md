# v2 Mochi speaks — plan

> Requirements: [v2-voice-requirements.md](v2-voice-requirements.md). Mert asked (2026-10-06)
> to build every phase, then test together. No migration (the postcards lane owns the schema
> this week) and no native rebuild (`expo-audio` is in the build). Mert runs every git command.

## Phase 0 — Hear the voices

**Files:** `apps/web/scripts/voice-check.mts` (new), `apps/web/package.json` (`voice:check`).

**Changes:** like `photo:check`, it reads `FAL_KEY` from `apps/web/.env.local` itself (the
agent never does), speaks one line in each of the eight voices through the real provider, and
prints each voice's latency, duration and audio URL to open and listen to.

**Verify:** `npm run voice:check --workspace=@app/web` prints eight URLs; Mert listens and
tunes `VOICES` (below) by ear. About $0.05 a run.

## Phase 1 — Events

**Files:** `apps/web/src/lib/analytics/events.ts` (`talk_reply_voiced` in `TALK_EVENTS`),
`apps/mobile/lib/analytics.ts` (`voice_played`, `voice_stopped`, `voice_failed`,
`voice_changed`).

**Verify:** `npm run check:events` (registered ahead of the code: warnings only, until Phase 3).

## Phase 2 — The server

**Files:**

- `packages/contract/src/v1/voice.ts` (new): `petVoice` body `{ message_id, text }` (text
  trimmed, 1–`TALK_REPLY_MAX`), response `{ audio_url, duration_ms }`; `VOICE_WINDOW_MINUTES`,
  the daily limits. `endpoints.ts`: `petVoice`, `POST /api/app/v1/pet/voice`, user auth.
- `apps/web/src/server/voice/` (new):
  - `voices.ts`: the eight voices and the intent → emotion map.

    | Species | cuddly                    | curious                 | cool                    | loyal                   |
    | ------- | ------------------------- | ----------------------- | ----------------------- | ----------------------- |
    | cat     | `Sweet_Girl_2`, +2, 0.95× | `Lively_Girl`, +3, 1.1× | `Calm_Woman`, +1, 0.95× | `Lovely_Girl`, +2, 1.0× |
    | dog     | `Friendly_Person`, +1, 1× | `Decent_Boy`, +2, 1.15× | `Casual_Guy`, 0, 1.0×   | `Patient_Man`, +1, 1.0× |

  - `provider.ts`: the `VoiceProvider` interface; `falVoice` (MiniMax 2.8 Turbo over plain
    `fetch`, `output_format: 'url'`, 10 s timeout), and a stub for tests and when `FAL_KEY` is
    unset outside production.
  - `once.ts`: the message ids already spoken, in memory for the window (R4). One server
    locally; on several instances the window and R5's limits bound a repeat.
- `apps/web/src/server/db/talk.ts`: `countedReply(userId, messageId, since)` → the intent, or
  null. `apps/web/src/server/db/ai-usage.ts`: `purpose: 'voice'`, `countSince(...)`.
- `apps/web/src/app/api/app/v1/pet/voice/route.ts` (new) and its tests:
  1. no counted reply in the window, or already spoken → 404 `not_found`;
  2. a limit reached → 429 `rate_limited` (the app shows nothing);
  3. the provider: success → 200, `talk_reply_voiced`, `ai_usage` (characters as input);
     failure → 503 `voice_unavailable`, `ai_usage` with the failure.

**Verify:** `npm test`; the route tests cover each branch, that the voice comes from the pet
(not the body), that the words never reach a log or an event, and the limits.

## Phase 3 — The app

**Files:**

- `apps/mobile/lib/petVoice.ts` (new): the preference (AsyncStorage, on by default),
  `speakReply(messageId, text, input)` and `stopVoice(by)`. `speakReply` asks nothing when the
  voice is off or VoiceOver is on (R10, R11), asks `petVoice`, and plays the answer; a counter
  drops a voice still on its way when the mic opens or a newer reply comes. Before each play:
  `setAudioModeAsync({ allowsRecording: false, playsInSilentMode: input === 'voice',
interruptionMode: 'duckOthers' })`: iOS's playback (or ambient) category, the speaker, set
  again every time (expo-audio calls `setCategory` on each call), and other audio lowered while
  the pet speaks (R7–R8). One player at a time (R9). expo-audio is required only once its native
  module is there, like `petSounds.ts`. Tracks the `voice_*` events.
- `apps/mobile/hooks/useTalk.ts`: the answer carries its message id and input.
- `app/(tabs)/index.tsx`: calls it from `answered`; stops the voice on the mic, on leaving Home
  and in the background.
- `app/(tabs)/settings.tsx`: the "{name}'s voice" row (R11).
- `app/privacy.tsx`: the voice paragraph (R12).

**Verify:** on the Simulator and the iPhone, with this worktree's web server: speak to the pet,
the text, then the voice from the speaker (not the earpiece); silent switch on: a spoken message
is answered aloud, a typed one isn't; the toggle off makes no request (the web log); the mic
cuts the voice off.

## Phase 3b — Before Home (added and built 2026-10-06)

**Files:** `apps/mobile/assets/voice/` (`lines.json` and 24 `.m4a` clips),
`apps/web/scripts/voice-samples.mts` (`voice:samples`), `apps/mobile/lib/voiceSamples.ts` (the
clips by species, preset and line), `lib/petVoice.ts` (`playVoiceSample`; `speakReply` takes
`from`), `app/(create)/personality.tsx` (the caption, a line on tap), `app/(create)/meet.tsx`
(the line on landing), `hooks/useIntro.ts` (the message id), `components/intro/IntroFlow.tsx`
(the answer spoken), the contract's `from`, `introStore.answeredAttempt`, the voice route.

**Verify:** tap each personality and hear it; Meet speaks as the pet lands; "Tell me about you"
speaks its answer; with the silent switch on, the recorded lines stay quiet.

## Phase 4 — Finish

- The gates (`local-review`), `check:store` and the `store-review` skill: an OTA update, no new
  permission.
- Docs, last: the screen spec (Settings' row, Home's talking), product.md's v2 decisions, the
  roadmap's lane, `updates/v2.md`, this file's status.

## Risks

- **Cost.** About $0.006 a reply. Bounded by R5; the off switch makes no request. Inworld is the
  fallback behind the same interface.
- **The earpiece.** If iOS still routes to the earpiece after listening, the fix is a short wait
  for the recognizer's end before setting the mode; checked on the iPhone (the Simulator has no
  earpiece).
- **The words reach fal** (a reply, never what was said). The privacy page says so.
- **Abuse** of the route to speak any 200 characters: only for one's own reply just counted, once,
  within the limits. The worst case is one's own daily limit of 200-character clips.
- **Nothing touches money, entitlement, auth or the Play Stats API.** No migration.
