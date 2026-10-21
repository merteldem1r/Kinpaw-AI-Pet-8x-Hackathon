# Kinpaw: ideas

> Ideas Mert raises while building, kept here so none is lost. An idea is not a decision: when
> one is picked up, it moves into [product.md](product.md) (the decision) and the
> [roadmap](roadmap.md) (when), and its entry here says so. Newest first.

## Welcome's three pets alive

**Raised:** 2026-10-09, by Mert, after checking Meet's living pet · **Status:** picked up,
built and checked by Mert the same day ([plan, "Phase A4c"](features/v3-pet-looks-plan.md);
decision 6 in the
[requirements](features/v3-pet-looks-requirements.md#decisions)).

- **What:** the first screen's three pets move, answer a touch and the cat talks, as the pet on
  Home and Meet does.
- **Why:** it is the first thing anyone sees of the app; a living pet there makes the promise
  before a word is read.
- **Decided with Mert:** all three alive; every touch Meet has; the cat's mouth moves with its
  lines and the others look at it, silent; built before A5. **The agent's advice was** the same
  on each.
- **Edge cases:** the cat's square lies over its neighbours', so its touch area is only where it
  is drawn; three living SVG pets and the sky are the heaviest screen yet (the frame rate is
  checked on the iPhone, and the side pets' idle moves go first); Welcome stays mounted under
  Create, so everything stops while it is covered; VoiceOver still reads the three as one image;
  no sound on a first launch.

## v3: a living pet (looks and animation)

**Raised:** 2026-10-09, by Mert, as the first v3 feature · **Status:** picked up 2026-10-09:
alive and soft, built in code (the moving SVG pet, then 2.5D in Skia). Specced as
[features/v3-pet-looks-*](features/v3-pet-looks-requirements.md), with the research beside it;
the decision is in [product.md](product.md#v3-decisions).

- **What:** the pet stops being a still 2D sticker: more alive, more volume, more "my pet". 2.5D
  first, maybe 3D later. The reference is My Talking Tom.
- **Why:** the core feeling is "someone missed me"; a pet that moves, reacts where you touch it
  and moves its mouth when it talks sells that far better than a better drawing.
- **Decided with Mert (2026-10-09):** alive and soft, not realistic; no 3D artist, so Rive and
  3D wait. **The agent's advice was:** aim for alive and soft, not realistic (a realistic animal that talks
  looks uncanny and fights the cozy brand). Build a renderer-agnostic rig first (one pose, one
  behaviour controller), make today's SVG pet move with it (tail, ears, head, a mouth on the
  voice, touch zones), then a Skia 2.5D renderer, then a Rive-versus-3D spike before choosing.
- **Edge cases:** every native module is a rebuild, which can undo the signing fix; many small
  pets on one screen (the builder, friends) need a cheap still renderer; Reduce Motion;
  VoiceOver; the website draws the same pet; `appearanceSchema` is strict, so a new attribute
  breaks an older app; events first for every zone and pose.

## Show when the pet answers from memory

**Raised:** 2026-10-03, by Mert, testing memory on his iPhone · **Status:** picked up and
built the same day ([v2-memory-requirements.md](features/v2-memory-requirements.md), R15b).

**The idea.** When a reply uses something the pet remembers, show it, so the person sees "it
remembered me" and the developer sees which note a reply used.

**As built.**

- The model names the note it brought up (`recalled: "m1"`, in the same answer, a few tokens).
- The server shows it only if the reply really contains a word of that fact's text or tags
  (`mentionsFact`), so a reply that only claims to remember lights nothing.
- Home's bubble row reads "From Mochi's memory", and tapping it opens the list on that fact.
- The console logs `talk recalled a note` with the ref and whether it was shown, never the
  words.

**Edge cases:**

- A reply that both keeps and recalls shows "will remember that", since that is the newer news.
- A failed or rate-limited reply shows nothing.
- It changes the answer shape, so it is measured in the next model check.

## Reviewer questions and the v2 order

**Raised:** 2026-10-03, by a hackathon reviewer after the v1 demo, then worked through by Mert
and the agent · **Status:** decided as the current direction (product.md, "v2 decisions";
roadmap, "v2: week 1"); may change on the way.

**The reviewer asked:** if you could ship only a few v2 ideas before the first users, which one
and why? Why does someone open Kinpaw on day 7? What does a user who talks every day cost a
month, and how was the free limit picked? And: post a short update every day.

**Our answers.**

- **One feature: long-term memory.** It is the only idea that gets better the longer you use
  it, and it is the core feeling ("someone missed me"). Next, a daily notification.
- **Day 7.** v1 gives a reason to open the app on day 1, not day 7: nothing reminds you
  (no notification) and nothing builds up (nothing is there on day 7 that wasn't on day 1). v2
  adds the reminder (a notification in the pet's voice), a varied reward (memory brings things
  back; a postcard each day) and something you'd lose by leaving (what it remembers, the album).
  D1/D7 return can be read from first-party `analytics_events`, without PostHog.
- **Cost.** About 1,000 tokens a reply today (M6's check), about 1,100 with memory (6 facts in,
  one fact out, same call). At Groq's paid list price for `gpt-oss-20b` (about $0.075 in and
  $0.30 out per million tokens, to check on console.groq.com) a free user at 10 a day is about
  $0.05 a month; Claude Haiku 4.5 about $0.45. A painted postcard is about $0.003, so about
  $0.10 a month for Plus. **The real limit was Groq's free tier**: 200K tokens a day is about
  20 people at 10 messages, so the paid tier comes before real users.
- **The free limit of 10.** Chosen as a product number, not a cost one (talking was free on
  Groq). It also matches the game: talking adds at most +30 affection and +25 happiness a day,
  about 8–10 kind messages, so 10 free messages are a full day's relationship and Plus is for
  chatting more.
- **Daily updates**: from `updates/v2.md`, a short post per working day.

**The memory design, as discussed.**

- **On the server** (`pet_memories`), not the phone: it survives a reinstall, the server builds
  the prompt, and deleting goes through one route. The last three exchanges stay on the phone.
- **Short facts, never the conversation**: at most one per reply, about 80 characters, with
  `kind` (lasting or event), `importance` (0–2), 3–6 `tags` (words someone might use for it,
  in their language) and, for an event, a follow-up date. Written by the model in the same call
  as the reply.
- **Caps**: 30 facts per pet, 100 with Plus; 6 per message; events asked about once after their
  date, then dropped after about two weeks; when full, the lowest score goes. Plus's bigger cap
  costs nothing extra, since the same 6 are sent.
- **The score** (plain code, per message): +5 per tag matching a word in the message, +4 when a
  follow-up is due, +0/+1/+2 importance, +1 when it hasn't come up lately, −3 if sent in the last
  hour. Not "the newest 6": that would forget your sister after six new facts. Embeddings
  (pgvector) can join later as one more signal; Groq offers no embedding model.
- **A fact that changes** ("I moved to Berlin"): the model can replace an existing fact by its id
  instead of adding one.

**"Tell me about you" (Mert's idea).** After picking the pet, a screen with the pet and the mic:
say about 20 seconds about yourself; see your words; "Send to Mochi"; the model pulls out up to
8 facts in fixed categories (study, work, family, pets, hobbies, place, likes, goals, other),
shown as chips you can remove; the pet reacts in one line. The pet remembers you from the
first minute, which is also the clearest demo of memory.

- **Placement: B, after sign-in, before Home** (Mert, 2026-10-03), inside the going-home
  moment. Before the email (A) would mean an AI endpoint anyone can call without an account,
  and two permission prompts before the email, the funnel's weakest point. A could come later
  with Supabase's anonymous sign-in if people drop off at Save.
- **Retries cost nothing**: speech becomes text on the phone, so recording again and editing are
  free; the model is called on Send only, at most twice per account (the second only when the
  first found nothing or failed), counted on the server. Not counted in the daily messages.
  About $0.0002 a call.
- **Edge cases**: permission refused (type instead); nothing heard (asked again, no call); too
  little said (0 facts, a gentle line, the second try kept); the model down (go Home, ask later
  from the pet's page); the app closed mid-step (shown again until done or skipped); a returning
  user with a pet (not shown); v1 users (a one-time ask in Home's bubble); their name (not a
  fact: it lives in the profile); someone trying to steer the model (it can only return facts
  in a fixed shape, and facts go into later prompts as quoted data); rude content (dropped);
  someone saying they are a child (no age stored); made-up facts (fine, it's their pet).
- **Store review**: always skippable; the Send screen says the words go to our AI provider and
  audio stays on the phone (the consent Apple asks for before personal data goes to a
  third-party AI); facts removable before saving and later.

**The postcard, Plus-only painting (Mert's idea, adjusted).** Image generation only for Plus;
free users keep a daily postcard drawn in code (`PetArt` in a small scene) with a model-written
caption, so the day-7 habit stays free (about $0.005 a month) and the image cost falls on paying
users. A free account's first postcard is painted, once, to show what Plus gives. The paywall
gains "Mochi paints you a postcard every day" and "Mochi remembers more about you".

## v2 brainstorm (2026-10-02)

**Raised:** 2026-10-02, by Mert and the agent, as v1 closed · **Status:** brainstormed; long-term memory,
notifications and the postcard picked up 2026-10-03 ("Reviewer questions and the v2 order",
above), the rest not decided. The hackathon's first evaluation is at the end of week 1 (about 2026-10-06), the second
a week later; what Kinpaw needs most is a reason to come back every day, and AI that feels
like the pet, not like a chatbot. Mert has a fal.ai account with about $10 of credit.

### Mert's ideas

- **More look options** (2–3 more per attribute). The catalog is in `@app/contract`, but each
  option is drawn in code (`PetArt`), so the cost is the drawing, per option. Also more Plus
  options. Edge cases: saved pets keep their options; analytics' `appearance_key` grows.
  Brainstormed 2026-10-03: split the coat into layers, as real coats work, so a few drawings
  combine into many looks and a photo maps onto it: `fur` (base colour, +3: snow, cinnamon,
  lilac), `pattern` (where the markings go: + tabby, tortie, points, saddle, brindle),
  `accent` (the markings' colour, from the fur palette, or auto) and `white` (none, socks,
  tuxedo, bicolour, van; today's `socks` pattern moves here). Patterns are clipped to the
  silhouette (SVG `ClipPath`), so they can be drawn freely. Fur-id special cases (`cream`)
  become properties of each fur's art. Builder: one "Coat" tab with four rows. Built
  2026-10-03 as the three steps of `features/v2-pet-looks-*` (the builder keeps six tabs, with a
  row switch under Fur and Pattern).
- **A colour for the white markings** (Mert, 2026-10-03). Today Mittens, Socks and bib,
  Bicolour and Van are always white. A colour for them (White by default, or any fur colour but
  Snow) gives black-and-tan dogs (Doberman, Rottweiler), a real tricolour beagle (charcoal
  saddle, golden socks), a chocolate cat with a cream chest. Mocked up in the site renderer: it
  reads well. How: one attribute and one `pets` column, default `white`, so saved pets are
  unchanged; it colours everything the white markings cover (paws, chest, belly, muzzle, Van's
  body). Edge cases: a dark colour on the muzzle hides the dog's nose and the smile, so dark
  markings switch the face lines to the light ink, as dark coats do; with no white markings the
  colour has nothing to colour (a hint, as for Solid); "white markings" stops being the right
  name once they can be golden; the photo feature can detect tan points. Built 2026-10-03
  (`features/v2-pet-looks-*`, Phase 4): under Fur, renamed Paws & chest, every colour free.
- **A Welcome screen that comes alive** (Mert, 2026-10-03: "10/10 more attractive, interactive
  and dynamic"). Welcome's job is one tap, "Meet your pet", so the screen should give the core
  feeling ("someone missed me") in three seconds, before any ask. Brainstormed: the pets notice
  you (blinks, glances at each other and at you, a finger they follow); tapping one makes it
  react (happy face, hearts, a hop, a haptic, a line in a bubble); idle bubbles in the pets'
  voices that sell the features ("I remember what you tell me", "Feed me at 8?"); greetings by
  time of day (sleepy at night, a stretch in the morning); the side pets change coat now and
  then with a poof (showing the builder); swipe the centre pet for a new look; pick a pet right
  on Welcome and take it home (prefills the draft, shortens the funnel); tail wags and ear
  twitches (the drawing's tail and ears as their own animated layer). Edge cases: Welcome stays
  mounted under Create, so every timer pauses while it is covered; Reduce Motion holds still;
  VoiceOver reads one group plus each tappable pet; new events first (`welcome_pet_tapped`,
  maybe `welcome_pet_picked`) and the measure is whether interacting raises
  `welcome_start_tapped`; tilt or shake needs `expo-sensors` (a native module, a rebuild).
- **Your real pet from a photo.** Upload a photo; a vision model is given our catalog (species,
  fur, pattern, eyes, ears, body, tail, each as a closed list) and answers only with ids from
  it; the app builds the pet from them and opens the builder to adjust. Strongly on theme ("AI
  pet companion") and cheap: one structured vision call. Edge cases: not a cat or dog, several
  animals, a blurry photo (say so, open the builder); colours between two options (pick the
  nearest, the person adjusts); a Plus option detected for a free account (show it locked, as
  Change look does); the photo is never stored, and privacy text says it goes to the model.
- **Mini-games for Play.** One short game (catch the falling treats, chase the laser dot, fetch)
  instead of a plain tap; the score decides how much happiness it adds, within the daily caps.
  Edge cases: Play when too sleepy still says no; a game left halfway counts nothing; reduced
  motion and VoiceOver need a non-game path (the plain Play tap).
- **Snacks and credits.** Different snacks with different effects and costs, credits earned,
  granted, bought, or given with Plus. Edge cases: buying credits is a consumable in-app
  purchase (RevenueCat, unconfigured here) and ads need the tracking prompt (store review), so
  real-money credits wait for launch; credits are money-like, so they are written by server
  code only (non-negotiable 3), with a ledger table, never a counter the app sets.
- **Up to 5 pets with Plus.** Today one pet per account is in the schema (`pets.user_id` is
  unique) and in every route (`petStore.get(userId)`). A switcher on Home, per-pet needs, talk
  limits per account or per pet, Change look per pet. A refactor across the whole app; the
  paywall could then say "Room for more pets" again. Edge cases: Plus ends with 5 pets (keep
  them all, care for one? read-only?).
- **Friends by QR code.** Scan a friend's code in the app, see their pets, how they feel and
  look. A new tab or a Profile section, a friends table, a public pet view. Edge cases: the
  camera is a native module (`expo-camera`: a store build and a purpose string); what a friend
  may see (needs, not what was said); removing a friend; blocking; a demo needs two accounts.
  **Specced 2026-10-06** with Mert: [v2-friends](features/v2-friends-requirements.md) (the Camera
  app and a deep link, no rebuild; view only; the pet and display name only; a Friends tab).
- **A 3D animated pet** (v3). Options: (a) richer 2D motion of today's code-drawn pet (tail wag,
  ears, breathing, walking across the room) with Reanimated, cheapest; (b) Rive, a designer-made
  rig with the attributes as swappable parts; (c) real 3D (react-three-fiber with `expo-gl`,
  a rigged model per species, attributes as materials and swappable meshes), needs 3D art;
  (d) an image-to-3D model on fal.ai from the pet's picture, quick to try but not riggable.
  Researched 2026-10-09: see "v3: a living pet" at the top.

### The agent's ideas

- **Long-term memory.** After each talk the server keeps 0–1 short facts ("has an exam on
  Friday", "has a sister called Ece") in a small capped table, and the prompt brings the right
  one back later ("How did the exam go?"). The strongest "someone missed me" feature for its
  cost: Groq is already wired. Edge cases: never store what was said, only the extracted fact;
  a way to see and delete what the pet remembers (privacy, store review 5.1.1); a cap (say 30
  facts); nothing sensitive (health, politics) is kept.
- **"I missed you" on return.** The first line after time away depends on how long and on what
  the pet remembers. Uses the profile name the person set. Small and on theme.
- **The pet's daily postcard.** Once a day the pet "sends" a picture of its day: the model writes
  a one-line caption from its needs, mood and memory, and fal.ai draws it in one style from the
  pet's appearance description. Kept in an album on the pet's page: a collection, and a reason
  to open the app each day. Cost: about $0.003–0.03 an image, so $10 is hundreds to thousands.
  Edge cases: a daily cap per account; the image stored in our storage, not linked from fal;
  a failed draw keeps the caption; the drawing won't match `PetArt` exactly (say it is "drawn by
  Mochi").
- **A photo with your pet.** The person's selfie plus their pet's look, edited by an image model
  on fal.ai into one picture of them together. The biggest "wow", and shareable. Edge cases:
  a face is sensitive data (consent, never stored unless saved, privacy text); one or two a day
  free, more with Plus; moderation of what comes back.
- **The pet speaks aloud.** Its reply read out in a voice that fits its personality (on-device
  `expo-speech` is free but a native module; or a TTS model). Edge cases: the silent switch,
  a toggle in Settings.
- **"Someone missed me" notifications.** One gentle local notification a day when a need is low,
  in the pet's voice ("I saved you the warm spot"). The cheapest retention driver; a native
  module (`expo-notifications`) and the permission asked in context, after the first care.
- **A care log and gentle streaks** (see "A care log" below): "you looked after Mochi 5 days
  this week", no guilt when a day is missed.
- **A share card.** Your pet's portrait, name and a line as an image to share: the light version
  of social, with no friends graph.

## Profile photo: camera, crop and a smaller file

**Raised:** 2026-10-02, building [profile-edit](features/profile-edit-requirements.md) ·
**Status:** parked for the next native rebuild

- **Smaller photos.** `expo-image-manipulator` (a native module, so a rebuild and the Xcode
  signing fix again) resizes to 512px, about 60 KB instead of 1–3 MB: faster uploads on a weak
  connection, and never near the 5 MiB limit.
- **A crop step.** iOS's crop (`allowsEditing`) switches the picker to the old
  UIImagePickerController, which took 2–3 seconds to open, so it was dropped. With the
  manipulator, a crop screen of our own can come back over the fast picker.
- **Take a photo.** The camera purpose string is already in the build; the Simulator has no
  camera, so it is tested on the iPhone only.
- **For launch:** check the file's real type on the server (the bucket trusts the declared
  one), and a per-person limit on `POST /api/app/v1/uploads`.

## The pet uses your name in its own lines

**Raised:** 2026-10-02 · **Status:** idea

The talk replies use the name (profile-edit R16). The pet's local lines could too: the bubble's
needs lines, the tap and care reactions, the idle nudge ("{name}? You there?"). Edge cases: a
long name in a three-line bubble, no name set (the line must read well without one), and not
saying it so often it grates.

## Home fits one screen: need pills and slim care tiles

**Raised:** 2026-10-02 · **Status:** picked up and built 2026-10-02, before M6 Phase 4. The
design is in the [screen spec, Home](UI/kinpaw-screen-spec-v1.md#home).

**The problem.** Home scrolled. On an iPhone 15/16 Pro (852pt) it stacked about 950pt: the space
kept for the bubble above the pet (112pt), the pet (260), the mic row (~90) and the needs panel
(~250: a 2 × 2 grid of meters, then three 84pt care tiles, in a card).

**The decision (Mert's sketch).** The four needs become small pills on either side of the pet:
hunger and energy (the body) on the left, happiness and affection (the heart) on the right. The
pills only show. Talking keeps its own row under the pet (the mic, the keyboard beside it); Feed,
Play and Pet become a slim row of 56pt tiles with no card. The pet's size follows the screen's
height (180–260pt), and room the biggest pet doesn't use is shared above and below it.

**Tried first, and dropped (Mert, 2026-10-02):** one dock of five round buttons (Feed · Play ·
mic · Pet · Type). It fitted, but it crammed the bottom, left too much sky above the pet, and
made talking look like one more care action. Talking and care are different things, so they look
different: round amber controls for talking, coloured tiles for care.

**Edge cases settled in the spec:** low never rides on colour alone (the pill says "low"); the
bubble stays clear of the right-hand pills; the change effects (+20, sparkles, the ghost drain)
moved onto the pills; the talk row keeps one height with the typing field open, so the pet never
resizes; loading and error keep the same places; a badge never wraps; scrolling stays only for
the keyboard and the largest text sizes.

**Added the same day (Mert): a need sheet.** Tapping a pill opens a sheet that explains that need:
its level, what it is, what lowers and raises it, in plain words with the numbers that help you
plan, read from the game's rules. Explain only, one need per sheet. The one new event is
`need_info_opened` { need, low }.

## A care log

**Raised:** 2026-10-01 (in the M5 table design) · **Status:** parked until a feature needs it

**The idea.** An append-only `pet_actions` table: pet, action, when, the needs before and after.
`pet_needs` holds only the current state, and `analytics_events` keeps at most one row per
action per day, so neither is a history.

**What it would unlock:** streaks without guilt ("you looked after Mochi 5 days this week"), a
history view, the AI knowing what you did together recently, and debugging a surprising need.

**When we pick it up:** one insert in the same transaction as the action (`petStore.act`); an
index on `(pet_id, created_at)`; deleted with the pet; a retention limit if it grows (for
example 90 days), since only recent history is read.

## Talk to the pet by voice on Home

**Raised:** 2026-10-01 · **Status:** picked up 2026-10-01: it replaces the Talk tab and text
chat. The decisions are in [product.md, Talking](product.md#talking) and the build is roadmap
M6. Each open point below was settled there: speech to text on the phone, the permissions in
context with typing as the fallback, a short memory of three exchanges kept on the phone, the
counter and limit under the mic, need changes from a fixed list of intents (not affection +5),
nothing said stored, and a line in the bubble for every failure.

**The idea.** No separate Talk tab. On Home, where the pet is, a Speak button: you talk, your
words are transcribed, and the transcript goes to the AI model together with the pet's current
needs and mood and its personality (preset and six traits). The model answers in one or two
sentences, and the answer appears in the pet's speech bubble above it, where Home's lines
already appear.

**Why it fits.** It keeps the pet in view while you talk ("someone missed me" is about the pet,
not a chat log), it reuses the bubble that M5 builds, and it makes the AI the pet's voice
rather than a separate screen.

**What it would take, and the edge cases to settle when we come back:**

- **Speech to text.** On the phone (Apple's on-device recognition, through a native module:
  a store build, a microphone permission and a speech-recognition permission, each with a
  specific purpose string) or on the server (upload the audio, transcribe there: no speech
  permission, but audio leaves the phone and costs per minute). A typed fallback is still
  needed for people who can't or won't speak, and for VoiceOver users.
- **Permissions in context.** Ask for the microphone the first time Speak is tapped, never at
  launch; a refused permission leaves the typed fallback, not a dead button.
- **The reply.** Same reply-provider interface and dev stub as planned for M6
  ([ai-provider-deferred](../memory/ai-provider-deferred.md)); a 1–2 sentence limit in the
  prompt and a hard length cap on the server. Spoken replies (text to speech) are a separate,
  later step.
- **History.** The bubble shows one line. Does the pet remember the last few exchanges (a
  short history sent with each request), or is each one fresh? Long-term memory is v2.
- **Limits and money.** The 10-a-day free limit (product.md) still applies, counted on the
  server when a reply arrives. Where the counter and the "out of messages" card live without a
  Talk screen is a design question.
- **Needs.** Chat's affection +5 per reply stays.
- **Privacy.** Transcripts are personal data: never in analytics events, and the privacy
  disclosure changes if audio or transcripts are stored or sent to a provider.
- **Failure states.** Recognition fails, no speech heard, the reply fails or times out: each
  needs a line in the bubble, not a silent nothing.

## Your pet from a photo: what's left for launch

**Raised:** 2026-10-05, finishing [v2 pet from a photo](features/v2-pet-from-photo-requirements.md)
· **Status:** parked

- **Camera purpose string** (Apple 5.1.1): it says "to take a photo to upload, like a profile
  picture", which doesn't cover a photo of your pet for the AI. Change it at the next native
  rebuild (the notifications branch needs one), e.g. "Kinpaw uses your camera when you choose to
  take a photo: a profile picture, or your pet for Kinpaw to draw." `app.json` is a native
  change, so it can't ship over the air.
- **App Attest** before real users: proves a photo read comes from our app on a real iPhone, so a
  script can't spend fal credit by faking install ids (the network and app-wide caps bound it
  until then).
- **The picker's temporary copy** of the photo stays in the app's cache until iOS clears it;
  deleting it needs `expo-file-system` (native).
- **Talking sends text to Groq** with the disclosure only on the privacy page: Apple 5.1.2(i)
  asks for explicit permission there too. Same pattern as the photo: name the AI and ask once.
- **App Store privacy labels**: photos sent for processing (not kept by Kinpaw), and what fal
  keeps on its side, to confirm before the form is filled.
