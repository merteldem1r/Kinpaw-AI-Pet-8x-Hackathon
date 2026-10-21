# Kinpaw: product

> **Working name:** Kinpaw (placeholder, `🎨 REPLACE` until the final name is chosen).
> **Type:** iOS app (Expo) with a Next.js API, built on the 8x app template.
> **Context:** 8x Playmakers hackathon, October 2026. Runs on localhost only.
> **Status:** v1 done (2026-10-02); v2 in build. Last updated 2026-10-03.

This is the product truth for Kinpaw: what it is, who it is for, what v1 does and does not do,
and the decisions already made. The screen-by-screen contract is the
[v1 screen spec](UI/kinpaw-screen-spec-v1.md); the build order is the [roadmap](roadmap.md).
Where this file and the spec disagree on a product decision, this file is newer; fix the spec.

## What it is

A cozy AI pet that lives on your phone. It has needs you look after every day, a personality
you design, and it actually talks to you. It is a small daily ritual of comfort.

**The core feeling is "someone missed me".** Opening the app should feel like coming home to
a pet that is glad you are back.

## Who it is for

Young adults and adults who want a small, low-pressure daily ritual: people who like the idea
of a pet but can't have one, people who enjoy cozy games, and people who want a moment of
warmth in a busy day. Not children, and not a hardcore game audience: there is nothing to win
and nothing to lose.

## Why it works

- **A reason to come back.** Needs drop slowly over time, so there is always something gentle
  to do tomorrow.
- **No guilt.** The pet never dies, never leaves, and never punishes absence. At worst it is
  sad or sleepy, and it recovers the moment you care for it.
- **It talks back.** The pet speaks in the personality you gave it and knows how it feels right
  now: a hungry pet asks about dinner. That is what makes it feel like someone rather than
  something.

## The core loop

1. Open the app and see your pet in the light of the current time of day, with its mood and
   four needs: hunger, happiness, energy and affection.
2. Care for it: feed, play, pet, or talk.
3. The pet reacts: its needs rise, its mood and face change, and it says something.
4. Needs drift down while you are away, which gives you a reason to come back.

## v1 scope

The first-run path, then three tabs. Every screen, state, event and line of copy is specified
in the [screen spec](UI/kinpaw-screen-spec-v1.md).

| Area        | What v1 does                                                                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome     | The sky at the real time of day, three pets waiting, "Meet your pet" or "I already have an account".                                                                                                                                                                                   |
| Create      | Before sign-in, in three steps: cat or dog, then a ready-made friend (Choose a friend, with Customize) or your own design (Make your own) (Start), a name with ideas (Name), a personality preset with optional fine-tuning of six traits (Personality). The draft stays on the phone. |
| Meet        | The activation moment: the pet appears and says its first line.                                                                                                                                                                                                                        |
| Save        | Sign in with an email code to save the pet to the account.                                                                                                                                                                                                                             |
| My pet      | The home tab. The pet under a live sky, the four need meters, Feed / Play / Pet, a narrator line and a speech bubble from the pet.                                                                                                                                                     |
| Talking     | On Home, by voice: hold the mic and talk; the pet answers in its bubble, in its personality, aware of its needs, and what you said changes its needs a little. A small "type instead". Free users get a daily message limit. No Talk tab, no chat screen, no visible history (M6).     |
| Profile     | Who you are, the Kinpaw Plus panel (See plans, or Plus member), and your pet.                                                                                                                                                                                                          |
| Settings    | Haptics, sign out, help, terms and privacy, delete account. No appearance choice: the app follows the sky.                                                                                                                                                                             |
| Kinpaw Plus | The paywall: unlimited talking and premium looks (Change look on pet details uses them).                                                                                                                                                                                               |

## Out of scope for v1

Leave room for these, build none of them in v1 (v2 picks up long-term memory, notifications
and a postcard album: [v2 decisions](#v2-decisions)): an animated or 3D pet, a photo album, long-term
memory of what you said, a visible conversation history, the pet speaking aloud (text to
speech), other languages, streaks and push notifications, accessories, a multi-pet switcher,
room backdrops. Android, any hosted deployment, and a store submission are also out of scope (see
[Constraints](#constraints)). The [roadmap](roadmap.md) says when each might come.

## Key decisions

Decided, with the date. Change one here first, then in the spec and the code.

**Platform and environment**

- **iOS only** (2026-10-01). No Android work, testing or store config in v1.
- **Localhost only** (2026-10-01, hackathon rule). Local Supabase in Docker, `npm run web:dev`,
  the app on the iOS Simulator and Mert's iPhone. No Vercel, no hosted Supabase, no EAS, so no
  OTA updates or store builds. RevenueCat, Sentry and PostHog stay unconfigured.

**Brand**

- **Dusk preset, lamp-amber accent `#f2b66b`** (2026-09-30). The light scheme is dusk's `dawn`.
  Low needs use dusk's `errorText` coral, because dusk's `warningText` is too close to the
  amber accent to read as a change.
- **Name:** Kinpaw is a placeholder. The app icon has no text so it survives the final name.

**The pet**

- **Created before sign-in** (2026-09-30). The draft (species, look, name, preset, traits) is
  saved on the phone from the Look step on, and sent to the API after sign-in. If the account
  already has a pet, **the existing pet wins** and the draft is discarded with a gentle message
  (2026-10-01). v1 has one pet per account.
- **Needs** run from 0 to 100 and are **shown as whole numbers**; the server stores fractions so
  no decay is lost between changes (2026-10-02). **Low** means below 30. The pet never dies or
  leaves. Feed, Play and Pet have no cooldowns and no daily caps (talking's gains are capped,
  see [Talking](#talking)); **each tap gives less the fuller the need is**, so filling a low
  need takes about four taps (2026-10-02, Mert).
- **Decay is a daily rhythm** (2026-10-02, Mert; was 3 to 4 points an hour): by day hunger
  −12/h, happiness −9/h, affection −7/h, energy −5/h, so the pet needs you three or four times
  a day. **While it sleeps** (a fixed local night window, 23:00 to 07:00) the first three slow
  to a quarter and **energy recovers**, so mornings bring a peckish pet, not a starving one.
  Tune freely; the rules are `features/needs-rhythm-requirements.md`.
- **The server owns the needs.** It stores the values and the time they were stored, and
  applies decay before it applies an action. The app applies the same decay for display. The
  decay math is written once and shared by both, so they never disagree.
- **Mood, header and bubble lines are rule-based and local.** Only talking calls the AI.
- **The needs live in their own table, `pet_needs`** (2026-10-01), one row per pet, apart from
  its identity on `pets`: they change on every care action, the identity is written once. Mood
  is computed from them, never stored.
- **Every pet is built from six attributes** (2026-10-01): fur, pattern, eyes, ears, body and
  tail, plus species, drawn in code by `PetArt` in any mood, with no image files. The eight
  ready-made looks are presets of the same attributes. Create offers "Choose a friend" (a
  preset, optionally customized) or "Make your own". The pet stores its appearance, plus the
  preset it came from, if any. Plus options (Patches, Spots, Odd-eyed, Tufted) follow the Plus
  looks: shown with a lock during onboarding, checked again by the server on save.

<a id="talking"></a>

**Talking** (decided with Mert, 2026-10-01; replaces the Talk tab and text chat)

- **Talking happens on Home, by voice.** Hold the mic to talk and slide away to cancel, or tap
  once to start and again to stop (which also works with VoiceOver). A small keyboard icon
  beside the mic opens a one-line field ("type instead"); it is also what the mic becomes when
  the microphone or speech permission is refused. There is no Talk tab, no chat screen and no
  visible history.
- **Speech becomes text on the phone**, with Apple's on-device recognizer
  (`expo-speech-recognition`), and the words show live as you speak. Only text reaches the
  server, never audio. English only. The microphone and speech-recognition permissions are
  asked the first time the mic is pressed, never at launch.
- **The pet answers in Home's bubble**, in one or two sentences, in its personality (preset and
  six traits) and aware of its needs and mood, with its face, a haptic and a short pet sound
  (`expo-audio`). It does not speak aloud.
- **The AI understands; our code decides.** The model returns its reply, one **intent** from a
  fixed list and, optionally, a **suggested care action** (feed, play or pet). Shared code in
  `packages/contract` turns the intent into need changes, as it does for Feed, Play and Pet;
  the model never sets a number, so nothing said to it can do more than the kindest intent.
  The starting table (tune freely):

  | Intent         | For example                  | Happiness | Affection |
  | -------------- | ---------------------------- | --------- | --------- |
  | `affectionate` | "I love you", "good girl"    | +3        | +6        |
  | `kind`         | "I had a nice day"           | +2        | +4        |
  | `playful`      | "wanna race?"                | +4        | +2        |
  | `neutral`      | "what are you doing?"        | 0         | +2        |
  | `harsh`        | "I don't like you today"     | −6        | 0         |
  | `apology`      | "sorry, I didn't mean it"    | +4        | +2        |
  | `upset`        | "I'm so tired of everything" | 0         | +3        |

  **Energy never changes from talking**: it is physical, so only sleep and Play move it.

- **Gentle on harsh words.** The pet is visibly hurt and forgiving. Talking alone never pushes a
  need below 30 (low), and an apology repairs it. Someone who sounds **upset** is comforted,
  never answered as harsh, and the pet loses nothing.
- **Gains from talking are capped per local day**: at most +30 affection and +25 happiness
  (2026-10-02; were +20 and +15).
  After that the pet still answers warmly; the numbers stop moving.
- **A suggested action makes its button glow** ("are you hungry?" → Feed), when it can help.
- **Short memory, on the phone only.** The app keeps the last three exchanges in memory and
  sends them with each message, so the pet can follow a conversation; closing the app forgets
  them. Long-term memory is out of scope for v1; v2 adds it (see [v2 decisions](#v2-decisions)).
- **Nothing said is stored.** The text is used for one model call and discarded. `ai_usage`
  keeps, per call: the model, tokens, time taken, outcome and the intent label.
- **10 free messages per day, resetting at the user's local midnight** (2026-10-01), counted on
  the server. A message counts when its reply arrives; a failed reply, nothing heard, or the
  model not reachable does not count. Typed and spoken messages count the same. No text about
  the limit on Home (Mert, 2026-10-02): at 3 or fewer left, a small count sits on the mic; at 0
  the mic keeps its look with a small lock on it, and pressing it has the pet say it's all
  talked out and opens the paywall. Feed, Play and Pet keep working.
- **The model is Groq's free tier, `openai/gpt-oss-120b`** since 2026-10-03 (v2 memory: it
  updates a fact that changed, which 20b never did; [v2 decisions](#v2-decisions)). Before that
  `openai/gpt-oss-20b` (decided 2026-10-01, in place of a
  local Ollama model: the Mac's disk and memory are limited). Free with no card, fast, and its
  strict JSON schema mode guarantees the reply-and-intent shape; reasoning set low for speed.
  The free limits (about 200 messages a day, 8 a minute) fit development and the demo, not real
  users, and free models can be retired without notice. The server calls Groq through a small
  **reply provider** interface with a server-only `GROQ_API_KEY`; the phone never calls Groq.
  The model name is configuration (`qwen/qwen3.8-27b` and `openai/gpt-oss-120b` are the fallbacks
  on the same key). M6 opens by running about 40 test phrases through it: intent accuracy,
  valid output, in-character replies, latency. A stub provider with canned in-character replies
  stays for tests and CI. When Groq can't be reached or is rate-limited, the pet says so in its
  bubble. A paid model (Claude Haiku 4.5 is the candidate) can replace it later as one provider
  file plus a key. What someone says is sent to Groq for the reply, which the privacy text must
  say.
- **AI usage tracking** uses a minimal `ai_usage` table as a stand-in until the organizers
  share template-web's AI usage rule, which AGENTS.md says a play adopts once it makes an AI
  call.
- **One native rebuild** carries speech recognition, the pet sounds and a rewritten microphone
  purpose string (iOS has one, today worded for the photo picker's video). Mert redoes the
  Xcode signing fix after it.

**Money**

- **Kinpaw Plus** (placeholder name): unlimited talking and the premium looks (Calico, Blue
  merle). The paywall opens only from a limit (talking, a locked look after onboarding) or from
  the Profile tab, and never before the first conversation. Prices stay marked placeholders.
- **The server decides who is premium** (`profiles.plan_type`), never the app. RevenueCat is
  unconfigured, so premium is demonstrated with an admin grant written by server code
  (`/admin/users`, M7); a revoke undoes only a grant, never a store subscription.
- **Change look** (2026-10-02, M7): a saved pet's look can be changed from its details page,
  the species kept. A free account's Plus option opens the paywall; a Plus member's is
  unlocked. A pet keeps a Plus look it already wears if Plus ends: what you made while you had
  Plus stays, but nothing new can be picked.

**Structure and scope**

- **Tabs: My pet · Profile · Settings** (2026-10-01). My pet is the home screen. This replaces
  the spec's Home · Talk · You; the spec's You content is split between Profile and Settings.
  There is no Talk tab: talking lives on Home (2026-10-01). **Friends** joins as the second tab
  in v2 (2026-10-06): My pet · Friends · Profile · Settings.
- **Welcome is the first screen on every launch for anyone without a saved pet** (2026-10-01):
  signed out, or signed in before saving one. A pet in progress keeps its choices, and "Meet
  your pet" continues it from Start; the app never opens straight onto a Create step.
- **The app follows the sky, with no appearance choice for now** (2026-10-01). The light
  scheme (`dawn`) from 05:00 to 17:00, the dark one (`dusk`) from 17:00 to 05:00, changing when
  the app comes back to the foreground. Neither onboarding nor Settings offers Light / Dark /
  Auto; whether to bring a choice back is decided later.
- **Profile and Settings carry only what Kinpaw needs** (2026-10-01): no template rows. Profile
  is who you are and your pet; Settings is haptics, sign out, help, legal and delete account.
  Kinpaw Plus and managing a subscription come back with the paywall (M7).
- **You can set your name and photo, and the pet calls you by name** (2026-10-02). Edit
  profile, from Profile: a photo from the library (no camera, no crop for now) and a name. The
  pet's talk replies use the name now and then; its own lines don't yet. The photo is private:
  only its owner is ever sent a link to it
  ([profile-edit](features/profile-edit-requirements.md)).
- **v1 is the first shippable version; there is no separate "MVP"** (2026-10-01). Each
  milestone's requirements say what is in v1 and what waits for later, agreed with Mert before
  the build.

**Sign-in**

- **Email code only, locally** (2026-10-01). Apple and Google are hidden while they are not
  configured, but their code stays.

**Measurement**

- **`user_activated` fires on the pet's first reply when you talk to it**, spoken or typed
  (2026-10-01): talking with the pet is what sets Kinpaw apart from a plain care game.
- **Key moments are also recorded first-party**, from the server routes: pet created, action
  taken, talk reply received. The admin panel shows real numbers without PostHog (2026-10-01).
- Events never carry what was said, the pet's reply or the pet's name. The intent label is
  sent, except `upset`, which is sent as `other` because it hints at someone's state of mind.

**The codebase**

- **The template's sample features are removed**, from the code in M2 and from the database
  by a hand-written migration that drops their tables (2026-10-01).
- **English only.** The template's i18n scaffold is not used for v1 copy.

## v2 decisions

Decided with Mert on 2026-10-03, after the first reviewer's questions (`ideas.md`, "Reviewer
questions and the v2 order"). **These are the current direction, not final:** each is
confirmed in its feature's requirements before it is built, and may change on the way.

- **The v2 order: memory first, then a daily notification, then the postcard.** Long-term
  memory is the one feature that gets better the longer you use it, so it is what gives people
  a reason to open Kinpaw on day 7. The notification brings them back; the postcard album builds
  up. "Your pet from a photo" is a day-1 effect, so it moves after these.
- **Long-term memory is on the server, as short facts, never the conversation.** A
  `pet_memories` table; after a reply, the model returns at most one short fact (about 80
  characters) in the same call, with its `kind` (lasting or event), `importance` and a few
  `tags`. Nothing sensitive is kept (health, religion, politics, sexuality, ethnicity, money).
  You can see and delete what the pet remembers. Deleted with the pet and the account.
- **Memory has a cap, and the prompt never grows.** Up to **30 facts per pet, 100 with Plus**;
  **at most 6 go into each message**. Lasting facts stay for months, until corrected or pushed
  out by the cap; events (an exam on Friday) are asked about once after their date and dropped
  after about two weeks. When full, the lowest-scored fact goes.
- **Which 6 facts: a score in plain code, not a model.** A tag matching a word in your message,
  a follow-up that is due, importance, and not having come up lately raise a fact; having been
  used in the last hour lowers it. No embeddings for now (Groq has none); they can become one
  more signal later.
- **Memory is for everyone; Plus remembers more.** The core feeling is not paywalled.
- **You can see what the pet remembers and why it said something** (2026-10-03, built):
  - "Mochi will remember that" under a reply that kept a fact, and "From Mochi's memory" under
    one that used a fact, the latter only when the reply really mentions it.
  - The pet's page shows the 5 newest, read-only. "See all and manage" opens the full list,
    with a search, pages of 20, and a forget that asks first.
- **"Tell me about you" after sign-in, before Home.** A one-time step inside the going-home
  moment: talk (or type) for about 20 seconds, see your words, then "Send to Mochi". The facts
  found (up to 8) appear as chips you can remove before saving. Skippable. After sign-in, so
  the model is only ever called for a signed-in person, and no permission is asked before the
  email. Recording and editing are on the phone and free; the model is called on Send only, at
  most twice per account. It is a phase of the memory feature.
- **Your pet from a photo, built 2026-10-04/05 before the postcard** (Mert: it's the feature
  people will most want to try). Start offers **From a photo** and **Make your own**; Choose a
  friend is gone. One Gemini 2.5 Flash call on fal.ai reads the photo into the catalog's ids and
  our own code draws the pet; the photo is never kept. Signed out, **2 tries per iPhone, ever**
  (only reads the AI answered count); free accounts get the photo only when creating their pet;
  **Plus redoes it once a day** from Change look, reviewed before saving, and only a Plus photo can
  change the species. Plus options a free photo shows become the nearest free ones, with a note.
  The first photo asks explicit permission to send it to the AI (Apple 5.1.2(i)). Limits against
  abuse: per phone, 6 a day per network, 300 a day for the app, and fal's spending cap.
  `features/v2-pet-from-photo-*.md`.
- **The daily postcard: everyone gets one, Plus gets it painted.** A caption from the model for
  everyone; the picture is drawn in code (the pet's `PetArt` in a small scene) for free users
  and painted by an image model (fal.ai) for Plus. A free account's first postcard is painted,
  once, to show what Plus gives.
- **The daily note is local, in the pet's voice** (2026-10-04, built;
  `features/v2-notifications-*.md`). The phone schedules it when you leave: the moment a need
  would go low, at least 3 hours later, only 09:00–21:00, one a day and three in all, from a
  written bank of lines (no model call). It never mentions a remembered fact. The pet asks in
  its bubble after the first care; Settings has "Notes from Mochi". No push: a free Apple account
  can't sign it, and nothing here runs a server for it. Remote push comes with launch.
- **"I missed you": time away is the greeting's, on the server** (2026-10-05, built;
  `features/v2-memory-*.md`, Phase 5). Home asks `POST /pet/greeting` once per foreground; after 6
  hours, 1 day or 3 days the bubble's first line says so, and a remembered event whose day has
  come is asked about once ("I missed you, Mert! How did the exam go?"), even after a short time
  away. No model call. `profiles.last_seen_at` is read and moved by the greeting only: the
  lifecycle route no longer stamps it, since its cold-start call came first and left no time
  away to see. The same call counts the notes' opens (`notification_opened`) and their state.
- **Mochi speaks, in a real voice** (2026-10-06, built; `features/v2-voice-*.md`). A counted
  talk reply is read aloud a beat after the text, by Inworld TTS-1.5 Max on fal (about $0.001 a
  reply), in one of eight voices picked by species and personality, played 1.15× faster without
  pitch correction so the pet sounds small. MiniMax (pitch and emotion, six times the price) was
  the first pick and stays one setting away (`VOICE_PROVIDER`). Through the speaker; a spoken message is answered aloud even with the
  silent switch on (like Siri), a typed one follows the switch; not with VoiceOver on. "Mochi's
  voice" in Settings, on by default. Limits: 5 spoken replies a day free, 20 with Plus (decided by the server), and
  1,000 for the app a day as a safety switch.
- **Friends, by QR code** (2026-10-06, built; `features/v2-friends-*.md`). A Friends tab, second,
  shows your friends' pets in their mood. You add a friend by scanning their QR code with the
  iPhone's own Camera (a `cozypet://` link, so no native rebuild), by a shared link, or by typing
  their 8-character code; the app shows whose pet it is before adding. Showing your code is the
  consent, so a friendship is mutual at once, at most 50 each. A friend sees only your display
  name and your pet (look, name, mood, needs as low / okay / good), never your email, photo,
  memories, talk or Plus. Remove ends it for both; New code stops an old one. View only for now:
  no "send a paw", no in-app scanner yet.
- **Talking moves to `openai/gpt-oss-120b`** (2026-10-03, after the memory check): it
  updates a remembered fact that changed and labelled every intent right; about 140 ms slower
  and about twice the price per token of `gpt-oss-20b`.
- **Before real users, Groq's paid tier.** Its free tier's daily token limit is about 20 people
  at 10 messages a day. Estimated cost (list prices, check before quoting): about $0.05 a month
  for a free user, about $0.30 for a heavy Plus user with painted postcards.

## v3 decisions

Decided with Mert on 2026-10-09. Like v2's, the current direction, confirmed in each feature's
requirements before it is built.

- **v3 starts with the pet's looks: a living pet**
  ([`features/v3-pet-looks-requirements.md`](features/v3-pet-looks-requirements.md)). The pet
  stops being a still sticker: its tail, ears, head and mouth move, it reacts where you touch
  it, and it gains light and volume.
- **Alive and soft, not realistic.** A stylized animated pet that is more than 2D. Realistic
  animals that talk look uncanny and would fight the cozy feel.
- **Built in code, no artist.** First today's SVG pet made to move (no native rebuild), then the
  same pet drawn in 2.5D with Skia (one rebuild). Rive and real 3D wait until an artist joins.
- **The catalog stays as it is** for this feature: no new attributes, no schema change, nothing
  new behind Plus. New looks (snout, fur length, true colour from the photo), poses and
  accessories are later, each with its own spec.
- **The 2.5D pet looks like a soft toy: "Puppet"** (Mert, 2026-10-12, picked from nine finishes).
  Matte with a fine speckle, each part a soft solid that shadows the next; "the feeling of a
  plush toy, something softy and sweet". Never fur drawn as streaks: that read as wood.

## Constraints

The template's rules in [AGENTS.md](../../AGENTS.md) and [docs/rules/](../rules/) apply to
everything. The ones that shape this product most:

- **Events first.** Every event in the spec is registered with the `events` skill before the
  screen that fires it is built.
- **The app talks to `/api/app/v1` only**, through one shared contract. It never touches tables
  and never writes needs, entitlement or the talk count.
- **Store-review rules still bind the UI** even though nothing ships: the paywall keeps price,
  period, trial terms, Restore, Terms and Privacy; account deletion stays in the app.
- **No hardcoded colours in app code.** Sky and art colours live in `packages/brand`.

## Open questions

- [ ] **Final app name** to replace Kinpaw.
- [x] **The AI model**: answered 2026-10-01: Groq's free `openai/gpt-oss-20b` for v1 (see
      [Talking](#talking)); a paid model (candidate: Claude Haiku 4.5) before real users.
- [ ] **template-web's AI usage rule**: access requested from the organizers.
- [x] **"Room for more pets"**: answered 2026-10-02 (M7): kept off the paywall until more pets
      exist. Plus in v1 is unlimited talking and the Plus looks, which an existing pet can now
      take through "Change look" on its details page.
- [x] **Exact decay and recovery rates**: settled 2026-10-01 (M5 Decision 1), then replaced
      2026-10-02 by the daily rhythm: by day hunger −12/h, happiness −9/h, affection −7/h,
      energy −5/h; asleep (23:00–07:00) a quarter of that, energy +12/h. Constants in
      `packages/contract/src/v1/needs.ts`; `features/needs-rhythm-requirements.md`.
- [x] **Pet art:** answered 2026-10-01: no images. Every pet is drawn in code from six
      attributes (`PetArt`, the pet builder), so moods work for any combination.
- [x] **Voice:** decided 2026-10-01. Talking is by voice on Home, with replies in the bubble,
      and replaces the Talk tab and text chat (see [Talking](#talking)).
