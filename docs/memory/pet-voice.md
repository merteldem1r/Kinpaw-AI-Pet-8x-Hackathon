---
name: pet-voice
description: The pet's voice: Inworld on fal played 1.15× faster, 5 a day free / 20 Plus, text and voice together; traps (iOS refuses duckOthers with the silent switch, last_seen_at is the greeting's, voice:samples needs ffmpeg)
metadata:
  type: project
---

Built 2026-10-06 in the voice lane ([v2-voice-requirements.md](../application/features/v2-voice-requirements.md)).

**Decisions (Mert):**

- **Inworld TTS-1.5 Max on fal, not MiniMax.** MiniMax sounded best but cost a heavy Plus user
  about $5.40 a month; Inworld is 6× cheaper. Inworld has no pitch, so the phone plays it 1.15×
  faster without pitch correction (varispeed) and the pet sounds small; Mert picked 1.15 by ear.
  MiniMax stays one env var away (`VOICE_PROVIDER=minimax`).
- **Limits by plan, on the server:** 5 spoken replies a day free, 20 with Plus
  (`VOICE_DAILY_FREE`, `VOICE_DAILY_PLUS`), 1,000 for the app as a safety switch. A heavy Plus
  user costs about $0.78 a month with the text, about 18% of $4.24 net.
- **Text and voice arrive together:** the talk route starts the voice when its reply exists
  (`voice: true`); the phone holds the text up to 3 s for it.
- **The creation flow's lines are recorded once** (`npm run voice:samples`, 24 clips in
  `apps/mobile/assets/voice/`), so they play free and before sign-in.

**Traps:**

- **iOS refuses `interruptionMode: 'duckOthers'` with `playsInSilentMode: false`**: expo-audio
  throws and nothing plays, with no error on screen. It silenced the recorded lines and typed
  replies until fixed; the test mock now enforces the rule. Duck only when playing through the
  silent switch.
- **`profiles.last_seen_at` belongs to the greeting route** (`markSeen`). The lifecycle route
  stopped stamping it: its cold-start call came first and left "I missed you" no time away.
- **`voice:samples` needs ffmpeg** (it bakes the 1.15× rate into the clips). Re-run it after any
  change to `lines.json` or the voices; a test fails if a clip is missing.
- **The "Tell me about you" page opens only for a new pet.** Signing in with an email that has a
  pet shows "You already have Mochi" and Home; test the intro with a fresh email (codes at
  http://127.0.0.1:55324).

See [[ai-provider-deferred]], [[monetization-v1]], [[local-checks-and-traps]].
