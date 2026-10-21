# M6: Talk to your pet — requirements

> Milestone M6 of the [roadmap](../roadmap.md). Inputs: [product.md](../product.md)
> ("Talking", "Money", "Measurement"), the [screen spec](../UI/kinpaw-screen-spec-v1.md)
> ("Talking (on Home)", Shared logic → "What you say (intents)" and "Talk limit and
> entitlement", Events) and the memory notes
> [ai-provider-deferred](../../memory/ai-provider-deferred.md),
> [ai-usage-stand-in](../../memory/ai-usage-stand-in.md),
> [monetization-v1](../../memory/monetization-v1.md) and
> [user-activated-first-chat-reply](../../memory/user-activated-first-chat-reply.md).
> Plan: [m6-talk-plan.md](m6-talk-plan.md). Written 2026-10-01.
>
> **Status: Phases 0–3 done and checked by Mert on his iPhone (2026-10-02); Phase 4 next.** The
> decisions were agreed with Mert on 2026-10-01 and 2026-10-02 (no limit text on Home: a locked
> mic). Still open: where each sound came from (for the licences) and whether the pet's sounds
> should play with the phone on silent (see [open questions](#open-questions)).

## Problem

After M5 the pet has needs, a face and a voice of lines we wrote, but it can't hear you. Talking
is the third reason Kinpaw works ("it talks back") and v1's activation moment
(`user_activated` is the pet's first reply), so until M6 the play has no activation at all.
M6 lets a person hold a mic on Home and talk to their pet; the pet answers in its bubble, in its
own personality, aware of how it feels, and what was said changes its needs a little.

## What is there today (research)

- **Home** (`apps/mobile/app/(tabs)/index.tsx`, 519 lines) already owns the bubble (`said`
  state, `PetBubble`), the reactions (`celebrate`: bursts and the happy face), haptics by meaning
  (`lib/haptics.ts`), the care buttons with a _wanted_ look (`careState`), and since M5 the pet
  stroke and the sky tap. It is near god-file size: talking must arrive as its own hook and
  components, not more code in this file.
- **`PetBubble`** already takes `onReply`, which adds a row under the line and makes the bubble a
  button. The failed-reply "Try again" row can reuse it.
- **The needs logic is shared** (`packages/contract/src/v1/needs.ts`): `decayNeeds`,
  `applyAction`, `moodFor`, `canHelp`, `wantedAction`. Talking's effects (the intent table, the
  floor at 30, the daily caps) belong beside them, so the app and the server can't disagree.
- **The care write path** (`petStore.act` in `apps/web/src/server/db/pets.ts`) locks the
  `pet_needs` row, decays to now in the phone's time zone, applies, stores. A talk reply needs
  the same transaction with a different effect.
- **Route pattern:** one `endpoints.ts` entry per route, built by `createAppRoute` (bearer check,
  Zod in and out). The action route validates the time zone with `isValidTimeZone`.
- **Premium** is read in the pet route by a private `isPremium(userId)`
  (`profileStore.appProfile(userId)?.planType === 'premium'`). The talk route is the second
  reader: the helper moves to one shared place, not a second copy.
- **Error codes** (`packages/contract/src/v1/common.ts`): `invalid_request`, `unauthorized`,
  `not_found`, `conflict`, `internal`, `unavailable`, `not_configured`. The app tolerates a code
  it doesn't know.
- **No AI code, no `ai_usage` table, no talk tables.** The env schema (`apps/web/src/lib/env.ts`)
  has no `GROQ_API_KEY`; Mert has the key in `apps/web/.env.local`, and a hand-written request
  through it worked on 2026-10-01.
- **First key test:** with a bare prompt ("label what the person said"), "I had a really nice
  day today!" came back `affectionate`; the table says `kind`. **The prompt must define every
  intent with examples, and the model check (Phase 0) measures accuracy before anything is
  built on it.**
- **Events:** the web registry has `LIFECYCLE_EVENTS.userActivated` (never fired yet) and
  `PET_EVENTS`; `trackPlayEvent` no-ops without `PLAY_INGEST_KEY`, so `user_activated` reaching
  the Play Events API is a no-op on localhost, as intended. The mobile registry has none of the
  talk events; it has `upgrade_page_viewed` but not the spec's `upgrade_tapped`, and two stale
  comments ("home_bubble_reply_tapped comes with Talk", "'talk' joins with the Talk tab").
- **No native modules for speech or audio**: `expo-speech-recognition` and `expo-audio` are new,
  so Phase 3 is a native rebuild. `app.json` already sets the iOS microphone string through
  `expo-image-picker`, worded for filming video; iOS has one microphone string for the app.
- **`PetArt` has four moods** (happy, content, sad, sleepy); a listening pose is new art.
- **No pet sound files** exist in `apps/mobile/assets/`.

## Success criteria

- A signed-in person holds the mic, says something, and within about two seconds of letting go
  the pet answers in its bubble, in character, with its face, sound and a haptic; its needs move
  by the intent table, within the floor and the daily caps.
- Typing instead does the same, with the same limit.
- Harsh words dip happiness without ever making a need low; an apology repairs it; someone who
  sounds upset is comforted and the pet loses nothing.
- A free account gets 10 replies a day, counted by the server, resetting at local midnight.
  Failures don't count.
- Nothing said, and no reply, is stored or sent to analytics.
- **The metrics:** activation rate = accounts with `user_activated` ÷ accounts with
  `pet_created`, and talk days per person (days with a `talk_reply_received`), both read
  first-party from `analytics_events`. The funnel: `talk_started` → `talk_message_sent` →
  `talk_reply_received`, with `talk_cancelled`, `talk_reply_failed` and
  `mic_permission_answered { granted: false }` as the drop-offs.

## v1 / later split (agreed with Mert, 2026-10-01)

**v1 (this milestone):** voice on Home (hold, slide away to cancel, tap to start and stop), live
words, type instead, the reply in the bubble with face, haptic, bursts and pet sound, the intent
table with floor and caps, the suggested-action glow, a short memory of three exchanges kept on
the phone, the 10-a-day limit with the counter at 3 or fewer and the all-talked-out state, every
failure state, the `ai_usage` stand-in, Groq's free `openai/gpt-oss-20b` behind a provider
interface with a stub.

**Cut if tight:** the listening pose, slide to cancel, the suggested-action glow, the pet
sounds.

**Later (v2):** the pet speaking aloud, long-term memory, a visible history, a paid model,
other languages.

## Requirements

### The model and the prompt

R1. **The reply provider** is an interface on the server: given the prompt's inputs, it returns
`{ reply, intent, suggested_action }` or a typed failure (`unavailable`: not reachable,
rate-limited or timed out; `invalid`: an answer that fails the schema). Implementations: **Groq**
(`openai/gpt-oss-20b` by default, reasoning effort low, strict JSON schema output) and a
**stub** with canned in-character replies chosen by simple keyword rules.

R2. **Which provider runs:** Groq when `GROQ_API_KEY` is set; otherwise the stub in development
and tests; otherwise the talk route answers `not_configured`. The model name is configuration
(`GROQ_MODEL`, defaulting to `openai/gpt-oss-20b`). Both are server-only variables, declared in
the env schema and `.env.example` (`check:env`). An agent never reads, writes or asks for the
key.

R3. **The prompt** speaks as the pet: its name, species, preset (title and description) and six
traits (1–10, described in words), its current needs (decayed to now) and mood, and the last
three exchanges sent by the phone, then what was just said. It follows the spec's AI brief: one
or two short sentences, warm, sassy allowed, never mean; hurt but forgiving after harsh words;
comforting after upset; never breaks character unless asked directly whether it's an AI.

R4. **The prompt defines every intent with examples**, including the edges: an everyday happy
statement is `kind`, not `affectionate` (affectionate is about the pet: "I love you", "good
girl"); sarcasm is judged by meaning; a negated harsh phrase ("I don't hate you") is not
`harsh`; anything that sounds like real distress is `upset`, never `harsh`.

R5. **The model's answer is checked** with Zod after Groq's own schema check: `reply` trimmed,
non-empty, cut at a sentence boundary to at most 200 characters; `intent` one of the seven;
`suggested_action` one of feed, play, pet or null. A failing answer is a failed reply (R14), not
a guess.

R6. **The model check (Phase 0):** about 40 labelled phrases (kind, affectionate, playful,
neutral, harsh, apology, upset; sarcasm, negations, questions) run through the real prompt and
provider, reporting intent accuracy per intent, valid-output rate, median and slowest latency,
and every reply for reading. It runs on demand, never in CI (it needs the key and spends free
quota). The bar to pass is an open question for Mert.

### What talking does to the pet

R7. **The intent table, the floor and the caps live in `packages/contract`**, next to
`applyAction`, as one function that takes the needs, the intent and what talking has already
added today, and returns the new needs: the table's happiness and affection change; energy and
hunger never change; talking alone never takes a need below 30, and a need already below 30
doesn't drop further; today's total gain from talking stops at +20 affection and +15 happiness.
Unit-tested in the contract suite.

R8. **The server applies it** in one transaction with the same lock as Feed, Play and Pet: decay
to now in the phone's time zone, apply the intent, store the needs, record the talk (R10). The
app never sends needs.

R9. **A suggested action** comes back with the reply. The app gives that care button the
_wanted_ look until it is used or the next message, only when `canHelp` says the action can
help.

### Counting, the limit and retries

R10. **Each counted reply is recorded without its words:** pet, the phone-generated message id,
the local day it counted for, the intent, and the happiness and affection it added. These rows
decide the daily count and the caps. They live in their own table, `pet_talks` (open
question 1), never in `ai_usage`.

R11. **The free limit:** 10 counted replies per local day for a free account, read from
`profiles.plan_type` on the server; premium is unlimited. When a free account has none left, the
route answers the limit without calling the model.

R12. **Retries never count twice.** The app sends a message id it generated; a request whose id
already counted gets a fresh reply but changes no needs and counts nothing (the words weren't
stored, so the first reply can't be replayed).

R13. **Every response says how many are left** today (`null` for premium), so the counter needs
no extra request.

### Failures

R14. A reply that fails for any reason (Groq unreachable, rate-limited, timed out after about 10
seconds on the server, an answer that fails R5) **counts nothing and changes nothing**. The
route answers a distinct code for "not connected" (unreachable, rate-limited, not configured) and
for any other failure, so the app can show the right line. Nothing raw reaches the person.

### Privacy and safety

R15. **Nothing said is stored or logged.** The words and the reply exist only in the request,
the call to Groq and the response. The server logger never receives them; errors log the
outcome, not the content. Events carry no words, no reply and no pet name.

R16. **`ai_usage`** (the stand-in): one row per model call, success or not: user, provider,
model, input and output tokens, latency, outcome, intent. RLS on, no grants (the usual security
migration). No words.

R17. **The privacy text** (`app/privacy.tsx` and the website's privacy page) says that what you
say is turned into text on your phone by Apple, sent to Groq to get the pet's reply, and not
stored by Kinpaw. `docs/rules/permissions-and-privacy.md` lists `expo-speech-recognition`,
`expo-audio` and Groq with what each collects.

### Home: typing (Phase 2)

R18. A keyboard button beside the mic opens a one-line field ("Say something to {name}", return
sends, 280 characters, trimmed, empty does nothing) that rides the keyboard; the pet and the
needs panel never move.

R19. **Sending** shows `TypingPaws` in the bubble and your words in the chip above the mic; the
mic and the field refuse a second message until the reply lands.

R20. **The reply** replaces the bubble's line; needs, header and mood come from the server's
answer; `success` haptic and hearts when a need rose, `press` otherwise; after `harsh`, the sad
face for a moment and no burst.

R21. **States**, with the spec's copy: reply failed ("{name} dozed off mid-thought… try again?"
with a "Try again" row that resends the same words and message id), not connected ("I'm a bit
sleepy… try again in a moment?" with "Try again"), limit reached (the mic keeps its look with a lock
badge; pressing it has the pet say it's all talked out and opens the paywall). Feed, Play and Pet keep working in
every state.

R22. **The count** (Mert, 2026-10-02: no text about the limit on Home) is a small badge on the
mic for a free account with 3 or fewer left; never for premium.

R23. **Short memory:** the app keeps the last three exchanges (what was said, what the pet
replied) in memory only, sends them with each message, and forgets them when the app closes or
the account signs out.

### Home: voice (Phase 3)

R24. **The mic:** hold to talk (listening starts with a `press` haptic; release sends); slide
away before releasing cancels; a quick tap starts listening and a second tap sends (the
VoiceOver path); listening stops by itself at 15 seconds and sends.

R25. **Speech recognition on the phone** (`expo-speech-recognition`), English (`en-US`),
on-device when available, with partial results shown live in the chip. Only the final text is
sent.

R26. **Permissions in context:** microphone and speech recognition are asked the first time the
mic is pressed, never at launch. Refused, restricted or unavailable: the mic row becomes the
type-instead field with the spec's caption. Each purpose string is specific (Apple 5.1.1), and
the one microphone string covers both talking and the photo picker's video.

R27. **Nothing heard** (released with no words): the bubble says "Hm? Say that again?"; nothing
is sent or counted.

R28. **The pet's sound** plays with each reply (`expo-audio`), one of three or four per species
chosen by mood, quietly,
respecting the silent switch; a missing or failed sound never blocks the reply. (Where the
sounds come from is open question 3.)

R29. **The listening pose** while the mic is on (cut if tight: the `content` face instead).

### Accessibility

R30. The mic and keyboard buttons have labels and hints; listening is announced; the reply is
read by VoiceOver through the bubble's live region; nothing important is only a sound or a
haptic; reduced motion stills the mic's pulse and the paws; every target is at least 44pt.

## Events

Answers to the `events` skill's questions, for the registries' doc comments:

- **The aha:** the pet's first reply when you talk to it → `user_activated` (canonical,
  lifecycle), once per account.
- **The drop-offs:** `talk_started` → `talk_message_sent` → `talk_reply_received`; leaks are
  `talk_cancelled`, `talk_reply_failed` and a refused mic (`mic_permission_answered`).
- **Discriminators:** `input` (voice, typed) on started, sent and received; `intent` on
  received; `reason` on cancelled; `error_kind` on failed; `source` on `upgrade_tapped`;
  `granted` on the permission.
- **Money:** none. `upgrade_tapped` opens the paywall; purchases are the paywall's own events.
- **Lifecycle:** `user_activated`, which also goes to the Play Events API (a no-op on
  localhost).

**Web registry** (`apps/web/src/lib/analytics/events.ts`), recorded first-party by the talk
route:

| Event                                     | When                                    | Metadata                                              | Dedupe                          |
| ----------------------------------------- | --------------------------------------- | ----------------------------------------------------- | ------------------------------- |
| `talk_reply_received` (new `TALK_EVENTS`) | A reply counted (not a retry, not free) | `input`, `intent` (`upset` → `other`), `need_changed` | daily, `dedupeMatch: { input }` |
| `user_activated` (existing `LIFECYCLE`)   | The account's first counted reply       | `activation_type: 'first_talk_reply'`                 | forever; also Play Events       |

**Mobile registry** (`EventName` in `apps/mobile/lib/analytics.ts`), to PostHog:

| Event                     | When                                          | Properties                                                           |
| ------------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| `talk_started`            | Listening starts, or the type field opens     | `input`                                                              |
| `talk_cancelled`          | Slid away, nothing heard, field closed unsent | `reason`: slid_away, nothing_heard, speech_failed, closed            |
| `talk_message_sent`       | Words sent                                    | `input`, `length_bucket`: short, medium, long                        |
| `talk_reply_received`     | The reply arrived                             | `input`, `intent` (`upset` → `other`), `latency_ms`, `messages_left` |
| `talk_reply_failed`       | Failed or timed out (20s on the phone)        | `error_kind`: timeout, not_connected, invalid_reply, network         |
| `talk_retry_tapped`       | Try again on a failed reply                   | none                                                                 |
| `talk_limit_reached`      | The free count hit 0, or the mic pressed at 0 | none                                                                 |
| `mic_permission_answered` | The permission prompts were answered          | `granted`                                                            |
| `upgrade_tapped`          | The locked mic pressed (it opens the paywall) | `source`: talk_limit                                                 |

The two stale comments in the mobile registry go. No property ever carries what was said, the
reply or the pet's name.

## Out of scope

The pet speaking aloud (text to speech); a visible history or any stored transcript; long-term
memory; other languages; a paid model or a second provider; streaming the reply word by word;
talking from anywhere but Home; the paywall restyle (M7); Android.

## Open questions

1. **Where the counted talks live.** _Answered by Mert, 2026-10-01: a separate `pet_talks`
   table._ One row per counted reply: message id as primary key, pet, local day, intent,
   happiness and affection added; no words. It holds the game state the limit and the caps
   depend on, so it survives `ai_usage` being replaced by template-web's module, and the message
   id as the key makes a retry impossible to count twice. `ai_usage` stays a pure usage log.
2. **The bar for the model check (R6).** _Answered by Mert, 2026-10-01: as proposed._ At
   least 85% of intents right overall, `upset` never labelled `harsh`, `harsh` never labelled
   `kind` or `affectionate`, every answer valid, and the median under 1.5 seconds. Below it, try
   `qwen/qwen3.8-27b`, then a better prompt.
3. **The pet sounds.** _Built 2026-10-01 from Mert's three files:_ a cat's meow and purr, a
   dog's bark (`apps/mobile/assets/sounds/`, clips under a second). **Open:** which site each
   came from (Freesound CC0 or Pixabay), to record the licences beside them; more dog sounds
   (a whine, a yip) when Mert finds them; and whether the sounds should play with the phone on
   silent (now they don't: the iOS "ambient" mode).
4. **Someone who sounds upset.** _Answered by Mert, 2026-10-01: the recommendation._ The
   pet's comfort only in v1; a quiet help-line link is decided before real users.
5. **Plus and Groq's shared quota.** _Answered by Mert, 2026-10-01: accepted for v1._ v1 is
   for testing the main features; premium, the free restrictions and their numbers are
   revisited after v1 (v1.5 or v2). The free tier allows about 200 replies a day across
   everyone; the stub is the fallback while developing.
