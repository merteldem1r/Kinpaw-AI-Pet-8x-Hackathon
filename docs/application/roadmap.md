# Kinpaw: roadmap

> Last updated 2026-10-09. The product and its decisions: [product.md](product.md). The screens:
> [v1 screen spec](UI/kinpaw-screen-spec-v1.md).

> **Where we are (2026-10-09):** v1 is done (2026-10-02). v2 has memory, notes from the pet, the
> pet's voice, more looks, the pet from a photo, friends and the rebuilt website built; the daily
> postcard is not started; each feature's status is in [updates/v2.md](updates/v2.md). Code
> quality, after the week-1 evaluation (73/100, code quality 3/5), is done (Phases 0–4, merged
> 2026-10-09). **v3 has started with the pet's looks: a living pet** ([v3 below](#v3-started-2026-10-09);
> where it stands: the tracking table in
> [`features/v3-pet-looks-requirements.md`](features/v3-pet-looks-requirements.md)). The second
> evaluation is about 2026-10-13.

v1 is built in eight milestones over the hackathon (about 1 to 2 weeks). Each is one pull
request that leaves `main` demoable. v2 and v3 are candidates, not commitments.

## How each milestone runs

1. **Spec it.** The `spec` skill writes `features/<milestone>-requirements.md` and
   `features/<milestone>-plan.md` in this folder, from the product doc and the screen spec
   sections the milestone covers. Nothing is built before Mert has read them.
2. **Events first.** The `events` skill registers every event the milestone fires, from the
   spec's Events table, before the screens that fire them.
3. **Build and verify.** On the Simulator and on the iPhone, against the local stack.
4. **Gates.** The `local-review` skill runs what CI runs.
5. **Hand over.** The agent suggests a Conventional Commit message. Mert makes every branch,
   commit, push and pull request; an agent runs no git command that changes anything.

## v1

### M1: Product docs and repo organisation

Product doc, this roadmap, the project memory notes, and AGENTS.md pointing every session at
`docs/application/`. The `spec` skill writes into `docs/application/features/`.

**Demo:** a new session starts knowing what Kinpaw is and where everything lives.

### M2: Rebrand and clear the stage

- `packages/brand/brand.config.ts`: preset `dusk`, accent `#f2b66b`, name Kinpaw.
- `apps/mobile/app.json`: name, bundle ID and scheme (kept equal to `APP_SCHEME`), and the
  icon. This is a native change: the app is rebuilt, and the Xcode signing fix for Mert's
  iPhone may need redoing afterwards.
- The moon `LogoMark`, and the icon files in `apps/mobile/assets/icon/` (placeholder art until
  the final icon exists).
- Remove the sample features from the code on both sides: the Explore and Activity tabs, item
  detail, their hooks, components, contract endpoints, routes and stores. Keep their tables
  and Prisma models (no destructive migration). (Changed after M4, 2026-10-01: the tables and
  models were dropped by a hand-written migration of their own.)
- Three tabs: Home and Talk as placeholders; You merges the template's profile and settings.
  (Changed in M3, 2026-10-01: My pet · Profile · Settings. There is no Talk tab: talking is on
  Home, in M6.)

**Demo:** a rebranded Kinpaw app with three tabs, signing in with an email code.

### M3: Create your pet

- Stand-in pet art named by the art contract (`assets/pets/{species}-{look}-{mood}.png`), and
  `PetImage`. (Replaced in M4b by `PetArt`, which draws every pet in code.)
- `SkyBand` and the sky colours (`art.sky` in `packages/brand`).
- Welcome, Create · Look, Create · Name, Create · Personality with the fine-tune sheet, and
  Meet. The pet draft is kept on the phone.
- The routing change: signed-out users can reach Create; a saved draft resumes where it was
  left.

**Demo:** from a fresh install, design a pet and meet it, signed out.
**Cut if tight:** the fine-tune sheet (presets alone work), Welcome's entrance motion.
(The fine-tune sheet was cut in M3 and built on 2026-10-01: `components/pet/FineTuneSheet.tsx`,
reached from Personality; Meet says "Custom" when traits were changed.)

### M4: Save your pet

- The `pets` table and its security migration; the contract and routes to create a pet (safe
  to retry) and to read it.
- The gate moves from the template's "onboarding completed" flag to "has a pet on the server".
- The Save and sign-in screens: email step, code step, all states; Apple and Google hidden.
- Draft sync after sign-in with retry; the existing pet wins, with a gentle message.
- The returning-user path ("I already have an account").
- `pet_created` recorded first-party.

**Demo:** create a pet, sign in, land on a Home that shows your saved pet; sign out and back in.
**Cut if tight:** the returning-user trio on the sheet edge.

### M4b: The pet builder

> **Done 2026-10-01**, checked by Mert: Step A (PetArt everywhere, the appearance stored on the
> server) and Step C (Start, Choose a friend with Customize, Make your own, name ideas).

Added 2026-10-01. Every pet is built from species and six attributes and drawn in code
(`PetArt`); the 32 PNGs go. Step A (the shared code, the table and the API, the app drawing
with `PetArt`) comes before M5; Step C (Start, Choose a friend with Customize, Make your own,
name ideas) after it. Requirements and plan: `features/m4b-pet-builder-*.md`.

**Demo:** pick a friend, customize it, or make your own; it looks the same after sign-in.
**Cut if tight:** the cycling pet on Start, the name ideas' dice.

### M5: Home, the core loop

> **Done 2026-10-01**, checked by Mert on the Simulator. The needs live in their own `pet_needs`
> table. Beyond the plan: care buttons that show what the pet wants, and hearts, treats and stars
> after each action (`features/m5-home-core-loop-requirements.md`, Decision 6). Not built: the
> sun/moon tap and the shooting star (cut if tight).

- The shared needs logic: decay, the night window for energy, action effects, mood, lowest
  need, header and bubble lines (`lib/petLines.ts`), written once for app and server.
- The action route: the server applies decay, then the action, and returns the needs.
- The Home screen: needs panel with `NeedMeter`s, Feed / Play / Pet with optimistic updates
  and rollback, the pet bubble, tapping the pet, the sky and its tap lines, loading, refreshing
  and error states, refetch on returning to the app.
- Action taken recorded first-party.

**Demo:** the core loop: care for the pet and watch it react; come back later and see needs
have dropped.
**Cut if tight:** the shooting star, sky-tap lines, ambient sky motion.

### M6: Talk to your pet

> **Done 2026-10-02**, Phases 0–4, each checked by Mert. Decided with Mert, 2026-10-01:
> talking is by **voice on Home**, with the reply in the pet's bubble. It replaces the Talk tab
> and text chat. Every decision is in [product.md, Talking](product.md#talking); the spec and
> its status are `features/m6-talk-requirements.md` and `-plan.md`. Talking is v1's activation
> moment (`user_activated` is the pet's first reply), so v1 isn't done without it.

Built in phases, each shown to Mert and confirmed before the next:

0. **Check the model.** Mert creates a free Groq key (`GROQ_API_KEY` in `apps/web/.env.local`);
   a script runs about 40 test phrases (kind, harsh, sarcastic, negations, questions, someone
   upset) through `openai/gpt-oss-20b` and scores intent accuracy, valid output, in-character
   replies and latency, with `qwen/qwen3.8-27b` as the comparison if it falls short. No app
   code.
1. **The server.** Events registered first (the `events` skill). The talk route (the verified
   caller's pet, the phone's time zone, a client-generated message id so a retry never counts
   twice); the reply provider interface with the Groq provider and the stub; the prompt from
   the traits, needs and mood; the structured answer checked with Zod and capped in length, with
   a written fallback line; the intent table, the floor at 30 and the daily caps in
   `packages/contract`, applied in the same locked transaction as Feed, Play and Pet; the
   10-a-day limit at local midnight; the `ai_usage` stand-in; `user_activated` and talk reply
   received recorded first-party.
2. **Typing on Home first.** The keyboard icon and its one-line field; thinking paws in the
   bubble; the reply with the face, haptic and bursts; the count on the mic at 3 or fewer; the
   locked mic and the all-talked-out line; not connected and failed states. The whole loop
   works on the Simulator before anything native changes.
3. **Voice.** One native rebuild: `expo-speech-recognition`, `expo-audio`, the microphone and
   speech-recognition purpose strings (the microphone string rewritten for talking). The mic:
   hold to talk, slide away to cancel, tap to start and stop; permission asked on first press,
   refused means typing; live words as you speak; a 15-second cap; "Hm? Say that again?" when
   nothing was heard; the pet's listening pose and its sounds. Mert redoes the Xcode signing
   fix afterwards.
4. **Finish.** The suggested action's glowing button; the last three exchanges kept on the
   phone and sent along; edge states; an accessibility pass (VoiceOver, the tap-to-talk path,
   reduced motion).

**Demo:** hold the mic and tell the pet about your day; it answers in character and its needs
rise; say something harsh and it's hurt but forgiving; run out of free messages.
**Cut if tight:** the listening pose, slide to cancel, the suggested-action glow, the pet
sounds.
**Later (v2):** the pet speaking aloud, long-term memory, a cloud model, other languages.

### Between M6 Phase 3 and Phase 4 (2026-10-02)

Built at Mert's request after trying M6 on his iPhone; each checked step by step with him.

- **Home fits one screen.** The four needs became small pills beside the pet (hunger and energy
  left, happiness and affection right); Feed, Play and Pet became a slim row of 56pt tiles; the
  mic keeps its own row under the pet (talking and care look different on purpose). The pet is
  sized to the screen (180–260pt) and Home no longer scrolls. A dock of five round buttons was
  tried and dropped. Spec "Home"; `ideas.md`, "Home fits one screen".
- **The need sheet.** Tapping a pill (it pops and flashes) opens a sheet that explains that need
  in plain words with light numbers read from the rules. Explain only. Event
  `need_info_opened`. Spec "Home" → "Need sheet".
- **Talking: 20 words a message** (voice stops at the 20th, the field takes no more, the
  server refuses more) and a smaller words chip. Spec "Talking (on Home)".
- **The needs rhythm.** Decay by day and a slower night, care that gives less as it fills,
  fractional needs shown whole, higher talk caps. Requirements and plan:
  `features/needs-rhythm-*.md` (Phases 1–3 done).

**Not yet:** the SE and Pro Max sizes on the Simulator, a day of play to tune the numbers.

### M7: Kinpaw Plus, Profile and Settings

> **Done 2026-10-02**, every phase checked by Mert (`features/m7-plus-profile-settings-*.md`).
> "Auto follows the sky" was already done before M7 (product.md: the app follows the sky, no
> choice). Added in M7: **Change look** from pet details, since otherwise nobody could use a Plus
> look (only signed-out, free people create pets); and `premium_grants.action`, so a revoke is
> audited like a grant (migration `20261002131125_premium_grants_action`).

- The app reads premium from the server's profile (`plan_type`), not only RevenueCat
  (`usePlus`), re-read on return to the app, on Home and when the paywall closes.
- The paywall restyle, opened with the right `trigger` from each place (`openPaywall`).
- Locked looks after onboarding (Change look) open the paywall; Plus unlocks them and unlimited
  talking everywhere at once.
- An admin grant and revoke on `/admin/users`, so premium can be demonstrated without
  RevenueCat; a grant is the dashboard's `granted`, never revenue.
- Profile's Plus panel ("See plans", or "Plus member"); Settings' "Manage subscription" only for
  a store subscription.

**Demo:** grant Plus in the admin panel; the counter and locks disappear in the app; change the
pet's look to Calico.

### M8: Polish

> **Done 2026-10-02** (`features/m8-polish-*.md`): the accessibility pass and the website
> brought in line with the app. The icon stays the placeholder moon cat for v1; the pet drawing
> stays as it is. Mert's three device checks moved to v2's first tasks. Found while
> speccing: the sun/moon tap, the shooting star, the website's name and favicon and the icon
> variants are already done; new in M8, **the website still shows a Talk tab and a chat
> screen**, so its mockups and copy are brought in line with the app; and an accessibility pass
> (tap targets, the paywall's price line at large text sizes).

- Tune the pet drawing (`PetArt`, `art.pet` in `packages/brand`) if needed, and the final icon
  variants. (There are no pet images any more: M4b draws every pet in code.)
- The deferred Home extras, if there is time: tapping the sun or moon, the night's shooting star.
- A motion, haptics and accessibility pass against the spec (VoiceOver labels, reduced motion,
  Dynamic Type, 44pt targets).
- The marketing site's name and favicon.

**Demo:** the full v1, end to end, on the iPhone.

### Alongside M8: Profile edit

> **Done 2026-10-02**, checked by Mert (`features/profile-edit-*.md`). Your name and photo on
> Edit profile, from Profile; the pet calls you by name in its replies. No migration and no
> native rebuild: the server side (uploads, the private bucket, `PATCH profile`) was already
> there.

**Demo:** set a name and a photo; Profile shows them; the pet says your name when you talk.

## v2: week 1 (decided with Mert 2026-10-02, reordered 2026-10-03)

> **Reordered 2026-10-03** after the first reviewer asked why someone opens Kinpaw on day 7
> (`ideas.md`, "Reviewer questions and the v2 order"; product.md, "v2 decisions"). The order
> is the current direction and may change.

The AI-companion core, before the first evaluation (about 2026-10-06), built in this order, each
specced into `features/` first:

1. **Long-term memory** (`features/v2-memory-*.md`): the pet keeps short facts you tell it
   (30 per pet, 100 with Plus; 6 per message, picked by a score) and brings them back; "I missed
   you" on return; "Mochi remembers…" to see and delete them; and **"Tell me about you"**, a
   one-time step after sign-in that fills the memory with up to 8 facts.
   **Progress (2026-10-05):** Phases 0–4 done and checked by Mert: memory in talking, "will
   remember that" and "From Mochi's memory", the list with search, pages and forget, and "Tell
   me about you" straight after the email code. Talking moved to `gpt-oss-120b`; the Groq
   fallback was dropped. **Phase 5, "I missed you", built 2026-10-05** (week 2's voice lane),
   waiting for Mert's check. Next: Phase 6.
2. **A daily notification in the pet's voice**, when it misses you: the reason to open the app.
   A native module (`expo-notifications`), so a rebuild.
   **Progress (2026-10-04):** Phases 0, 1, 2 and 4 done and checked by Mert on the Simulator and
   his iPhone: the pet asks after the first care, up to three notes on the lock screen, the
   Settings toggle. Phase 3, counting the opens (`notification_opened`, `notifications_state`),
   built 2026-10-06 on memory's greeting route, waiting for Mert's check.
3. **The daily postcard**: a caption for everyone; drawn in code for free users, painted by
   fal.ai for Plus (the first one painted for everyone). Kept in an album on the pet's page.
4. **Your pet from a photo** (`features/v2-pet-from-photo-*.md`): a vision model maps a photo
   of a real cat or dog onto the catalog. **Built 2026-10-04/05, ahead of the postcard** (Mert's
   call), in a third parallel session: Start's From a photo card, the read and the reveal, the
   out-of-tries and no-pet screens, and the Plus redo in Change look. Choose a friend removed.
   Next: Mert's check on the iPhone; the camera purpose string at the next native rebuild.

Alongside, in a parallel session: **simple social** (friends and their pets), kept small and on
its own branch. **Built 2026-10-06** (`features/v2-friends-*.md`, branch `feat/v2-social`): the
Friends tab, My code with its QR, adding by the iPhone's Camera, a link or a typed code, a
friend's pet page; waiting for Mert's check on the Simulator and the iPhone. Also the three device checks carried from v1. A short daily update to the
reviewers, from `updates/v2.md`. Week 2 candidates: one Play mini-game, snacks with free daily
treats, more look options, a share card, a photo with your pet. All of them, with edge cases,
are in `ideas.md` ("v2 brainstorm").

### Code quality (after the week-1 evaluation)

> **Phases 0–3 done 2026-10-08**, Phase 4 next ([requirements](features/v2-code-quality-requirements.md),
> [plan](features/v2-code-quality-plan.md)). Branch `feat/v2-code-quaility-ui`.

The week-1 scorecard gave code quality 3/5. An audit found the foundation strong and the points
lost in what a reviewer sees first and a few very large screens. In order: (0) the READMEs and
stray template files; (1) correctness (the sign-in code to the address as typed, plain error
lines); (2) Home, login and Create · Start split into tested hooks and components; (3) tests for
the optimistic care, talking and the admin Plus grant; (4) consistency (env reads, input checks
on the template routes, dead code); (5) the launch notes (the voice on Vercel, throttling).

**Demo:** the README on GitHub; the same app, with 1,145 tests behind it.

## v2 candidates

- **A paid AI model** in place of Groq's free tier, before real users, and adopt template-web's AI usage
  rule in place of the stand-in.
- **Streaks, done without guilt.**
- **The pet speaks aloud**: text to speech for its replies, in a voice that fits its personality.
- **More pets** and a switcher (a Plus feature).
- **Room backdrops** (a Plus candidate) and accessories.

## v3: started 2026-10-09

> Decided with Mert on 2026-10-09 ([product.md, "v3 decisions"](product.md#v3-decisions)). The
> order is the current direction and may change.

1. **Pet looks: a living pet** (`features/v3-pet-looks-*.md`): the pet moves part by part (tail,
   ears, head, a mouth that moves with its voice), reacts where you touch it, then gains light,
   volume and fur in 2.5D with Skia. Part A needs no native rebuild; Part B starts with one.
   **Progress (2026-10-12):** Part A done, checked by Mert on his iPhone and on `main` (the pet in
   moving parts, paused when unseen; the tail, ears and head; the mouth with the voice; touch
   zones and a hug; Meet's pet; Welcome's three; the light polish with bigger eyes). Part B
   under way on `feat/v3-pet-looks`: Skia is in the build on the Simulator; Mert picked the look,
   Puppet (a soft toy whose parts shadow each other); the Skia pet is alive in it behind a dev
   switch. Next: his look at it moving, shadows that follow the parts, the sky's rim colour, then
   his iPhone's build and the frame time after the second evaluation.

## v3 candidates

- **Launch**: hosted Supabase and Vercel, EAS builds and OTA updates, RevenueCat, Sentry and
  PostHog configured, the Play Stats API connected, App Store submission.
- **Android.**
- **An animated pet**: picked up as v3's first feature (above). A photo album of moments with it
  is still a candidate.
- **Localisation.**
