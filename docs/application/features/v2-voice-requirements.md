# v2 Mochi speaks — requirements

> Lane B of week 2 (roadmap, "v2: week 2"; ideas.md, "The demo video and week 2's three
> lanes"). Specced 2026-10-06. Plan: [v2-voice-plan.md](v2-voice-plan.md).

## Problem

The pet answers in text only, with a meow or a bark (M6, R28). Sound carries the demo video,
and a voice that fits the pet is the strongest "it is alive" moment: you hold the mic, say
something, and Mochi answers out loud. Today nothing in the app speaks.

## What is there today

- **Talking** (`POST /api/app/v1/pet/talk`): the reply is at most 200 characters
  (`TALK_REPLY_MAX`) with an `intent`. A counted reply is a `pet_talks` row keyed by the
  phone's message id, with the intent. The words are never stored or logged.
- **Sound** (`apps/mobile/lib/petSounds.ts`): `expo-audio` is in the build. A sound sets the
  audio mode before every play, because listening takes the session over and routes playback for
  voice. It is ambient: the silent switch silences it.
- **Listening** (`lib/speech.ts`, `expo-speech-recognition`): puts iOS's audio session in
  record mode. Playback right after it can come out of the quiet earpiece, not the speaker.
- **fal.ai** is already wired for the photo read (`FAL_KEY`, plain `fetch`, `server/photo/fal.ts`).
- **The pet** always has a `preset` (cuddly, curious, cool, loyal) and a `species` (cat, dog).

**fal's speech models, checked 2026-10-06** (fal.ai, "Text to speech"):

| Model                    | Endpoint                           | Price            | Fit                                                         |
| ------------------------ | ---------------------------------- | ---------------- | ----------------------------------------------------------- |
| MiniMax Speech 2.8 Turbo | `fal-ai/minimax/speech-2.8-turbo`  | $0.06 / 1K chars | 17 preset voices, pitch ±12, speed, emotion, `(yawns)` tags |
| MiniMax Speech 2.8 HD    | `fal-ai/minimax/speech-2.8-hd`     | $0.10 / 1K chars | Same voices, slower, higher quality                         |
| Inworld TTS-1.5 Max      | `fal-ai/inworld-tts`               | $0.01 / 1K chars | Cheapest; named voices, no pitch or emotion                 |
| Kling TTS                | `fal-ai/kling-video/v1/tts`        | $0.007 a call    | Anime and game voices, flat price                           |
| ElevenLabs Turbo v2.5    | `fal-ai/elevenlabs/tts/turbo-v2.5` | $0.05 / 1K chars | Good voices, no pitch                                       |

**First chosen: MiniMax Speech 2.8 Turbo** (replaced as the default the same day, below). It is the one model with a pitch, a speed and an emotion
per call, so a voice can be tuned per species and personality and follow the reply's mood. A
reply averages about 100 characters, so **about $0.006 a reply**; a free account's 10 a day is
at most $0.06 a day. **Changed 2026-10-06 (Mert): Inworld TTS-1.5 Max is the default**, for the cost ($5 a month for
a heavy Plus user was too much): eight voices of its own (cat Pippa, Pixie, Luna, Hana; dog
Timothy, Snik, Blake, Theodore), about $0.001 a reply, so about $0.90 a month for a heavy Plus
user against MiniMax's $5.40. It has no pitch, so the phone plays it 1.15× faster without pitch
correction (about 2.4 semitones higher): Mert picked 1.15 by ear from 1.10, 1.15 and 1.20, and
the pet sounds small. It has no emotion either (R3 applies to MiniMax only). MiniMax stays
behind the same interface with `VOICE_PROVIDER=minimax`.

## Success criteria

- In the demo: hold the mic, speak, the reply appears, and a beat later Mochi says it out loud
  through the speaker, in a voice that sounds like that pet.
- Measured: talk days per person with the voice on against off, from first-party
  `talk_reply_voiced` (PostHog is off in this play, so the server's row is the number).

## Requirements

### The voice

- **R1. A counted talk reply is spoken in the pet's voice, and text and voice arrive together**
  (changed 2026-10-06, Mert; was text first, voice 2–3 s later). The phone says it will speak
  (`voice: true` on the talk), so the talk route starts the voice the moment its reply exists and
  the voice route hands that one over (`server/voice/make-voice.ts`), which saves a round trip.
  The phone keeps the thinking paws until the voice is ready, at most 3 s; after that the text
  shows and the voice follows. With the voice off or VoiceOver on, the text shows at once. The
  meow or bark plays with the text.
- **R1b. The pet shows it is speaking**: on Home, a light runs around the bubble's edge while
  the voice is on its way, then the edge turns the brand gradient and a badge with the speaking
  bars sits on its top edge while it plays (changed 2026-10-06; was the bars under the line), and
  its eyes move (looks at you and up at its words, through PetStage's `cue`, no change to the pet
  drawing). Reduce Motion: a still speaker, still eyes.
- **R2. The voice is picked on the server from the pet's species and preset**: eight voices,
  each a MiniMax voice with its own pitch and speed. Never from anything the phone sends.
- **R3. The reply's intent sets the voice's emotion** (warm words happy, harsh or upset sad,
  the rest neutral), read from the `pet_talks` row, not from the phone.
- **R4. Only a reply the server just counted is spoken.** The phone sends the message id and the
  reply's words; the server speaks them only if that message is this person's counted reply from
  the last 10 minutes, and each message once. The words are at most `TALK_REPLY_MAX`.
- **R5. Limits, by plan**: voiced replies a person a day are **5 free and 20 with Plus** (Mert,
  2026-10-06; was 60, then 30 for everyone), decided on the server from the plan. That is about
  $0.15 a month at most for a free user's voice and $0.60 for a Plus user's (about $0.21 and $0.78
  with the text). And 1,000 for the whole app a day (about $1 on Inworld), a safety switch. Past either, no voice and no error: the
  text stands, and talking goes on in text. The first time a day, the pet says so in a toast,
  "I'm out of voice for today. I'll keep writing!" (Mert, 2026-10-06), so it doesn't read as broken
  (`voice_limit_reached`).
- **R6. A failed voice keeps the text.** No error on screen, no retry, no "Try again" for the
  voice. The talk itself is never slowed or failed by the voice.

### Playing it

- **R7. Through the speaker, never the earpiece.** Before each play the audio mode is set for
  playback (not recording), which also moves output off the earpiece after listening.
- **R8. The silent switch, like Siri: what you ask to hear plays, what plays by itself follows
  the switch.** A reply to something spoken, and a personality's line you tapped, play even with
  the silent switch on; a reply to something typed and Meet's line follow it. Through the switch,
  other audio (music, a podcast) is lowered while the pet speaks; otherwise it mixes, never
  stopped. (Fixed 2026-10-06: iOS refuses to lower other audio for a sound the switch can
  silence, and that refusal kept the recorded lines and typed replies quiet.)
- **R9. One voice at a time.** A new reply, holding the mic, leaving Home, the app going to the
  background, or turning the voice off stops the one playing.
- **R10. With VoiceOver on, the voice doesn't play.** VoiceOver already reads the reply; two
  voices at once is noise.

### The setting

- **R11. Settings gains "Mochi's voice"**, on by default, a device preference like the notes
  toggle ("{name}'s voice", with the pet's name). Off: no voice request is made at all (no cost).

### Before Home (added 2026-10-06, Mert)

The voice is heard while the pet is made, not only after talking.

- **R14. The personality page says the personality shapes the voice** ("It shapes {name}'s voice
  too. Tap one to hear it.") and, on tapping a personality (even the chosen one), the pet says a
  short line in that voice: cuddly "Hi! I'm soft, sleepy and all yours.", curious "Ooh, what's in
  there? Can I look?", cool "Hey. I'm pretty chill. Mostly.", loyal "Wherever you go, I'm coming
  too." While it plays, that row shows the speaking bars (`SpeakingBars`; a still speaker with
  Reduce Motion).
- **R15. Meet says its first line out loud** as the pet lands: the bubble's own line for its
  preset (or the own-mix line for fine-tuned traits), in its voice. While it plays, the bubble's
  row shows the speaking bars and "{name} is speaking"; after, "Hear it again" plays it once more.
  Neither row shows with the voice off or VoiceOver on.
- **R16. These lines are recorded once and shipped in the app**: each line in each of the eight
  voices (24 clips, about 530 KB), made by `npm run voice:samples --workspace=@app/web` from
  `apps/mobile/assets/voice/lines.json`, the playback rate baked in. No request and no cost per
  play, and they work before sign-in (Mert chose this over a live call, 2026-10-06). They can't
  say the pet's or the person's name. The silent switch as R8 says, the Settings toggle and R10
  (VoiceOver).
- **R17. "Tell me about you" speaks the pet's answer** live, like a talk reply: `POST /pet/voice`
  with `from: 'intro'` speaks only an intro answer the server recorded for this person in the
  window, once, warm (happy). It counts toward R5's daily voices. Going home stops it.

### Privacy

- **R12. The privacy page says** the pet's reply, never what you said, is sent to fal.ai to be
  spoken, and the audio is kept by fal only to be played.
- **R13. Nothing about the voice is logged with the words.** Logs carry the status and a reason;
  `ai_usage` carries `purpose: 'voice'`, the characters, the time and the outcome.

## Events

Registered with the `events` skill before the code that fires them. Never the reply's words.

**First-party, recorded by the voice route** (`apps/web/src/lib/analytics/events.ts`,
`TALK_EVENTS`):

| Event               | When                     | metadata             | Dedupe |
| ------------------- | ------------------------ | -------------------- | ------ |
| `talk_reply_voiced` | a reply's voice was made | `voice` (the preset) | daily  |

**App, PostHog** (the `EventName` union in `apps/mobile/lib/analytics.ts`):

| Event                 | When                                      | metadata                                              |
| --------------------- | ----------------------------------------- | ----------------------------------------------------- |
| `voice_played`        | the voice started playing                 | `input: 'voice' \| 'typed'`                           |
| `voice_stopped`       | cut off before its end                    | `by: 'mic' \| 'reply' \| 'left' \| 'setting'`         |
| `voice_failed`        | no voice for a counted reply              | `stage: 'fetch' \| 'play'`, `error_kind` (fetch only) |
| `voice_changed`       | the Settings toggle                       | `enabled`                                             |
| `voice_limit_reached` | the day's voice used up, once a local day | none                                                  |
| `voice_sample_played` | a recorded line played (R14–R15)          | `screen: 'personality' \| 'meet'`, `preset`           |

The aha is the first voiced reply heard (`voice_played`). The drop-offs: `voice_failed`, and
`voice_changed { enabled: false }`. Not a money moment, not a lifecycle state.

## Out of scope

- Voicing anything but talk replies (reactions, the greeting, the intro's line). A later step.
- A voice picker, or cloning a voice from your own pet's recording.
- Streaming audio while it is made, and caching voices.
- Plus-only voice. Everyone gets it for the demo; see the open questions.
- Hands-free "Call Mochi" (ideas.md, "Not now").

## Decisions (taken 2026-10-06, Mert to confirm while testing)

Mert asked to build every phase and test together, so these follow the recommendation; each is
one constant to change.

1. **Inworld TTS-1.5 Max, played 1.15× faster** (Mert, 2026-10-06, after hearing both with
   `npm run voice:check`; MiniMax was the first pick, too dear at $5 a month for heavy Plus use).
   MiniMax stays selectable with `VOICE_PROVIDER=minimax`.
2. **The silent switch, like Siri** (R8).
3. **On by default** (R11).
4. **No voice with VoiceOver on** (R10).

## Open questions

- **The out-of-voice toast for a free user** could mention Plus's 20 a day (a natural upgrade
  moment). For now it says the same as for Plus.
- **The privacy page's wording** on fal keeping the audio file (fal's media retention).
