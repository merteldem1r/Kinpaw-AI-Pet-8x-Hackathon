# v2 Long-term memory — requirements

> **Status: specced and agreed 2026-10-03** (see Decisions at the end). Phases 0–3 built and
> checked by Mert on 2026-10-03 (R1–R17, with R15b and R16b added on the way); Phase 4 done
> 2026-10-05; Phase 5 (R26–R28) built 2026-10-05, waiting for Mert's check (R28's time away is
> `profiles.last_seen_at`, not a new column on `pets`); Phase 6 next. Plan: [v2-memory-plan.md](v2-memory-plan.md). The decisions
> behind it: [product.md, "v2 decisions"](../product.md#v2-decisions) and `ideas.md`,
> "Reviewer questions and the v2 order". They are the current direction and may change.

## What is there today

- **Talking** (M6) is `POST /api/app/v1/pet/talk`. The route calls `talkToPet`
  (`apps/web/src/server/talk/talk-to-pet.ts`), which asks the reply provider (Groq
  `openai/gpt-oss-20b`, or the stub) for a reply and then applies its intent under the needs
  lock (`talkStore.apply`). One `ai_usage` row is written per model call.
- **The prompt** (`server/talk/prompt.ts`) holds the pet's look, personality, feelings in
  words, the person's name, the rules and the intent guide. The user message is the last three
  exchanges, which come from the phone, plus what was just said. **Nothing the pet knows about
  the person survives the app being closed.**
- **The answer shape** (`server/talk/reply-schema.ts`) is a strict JSON schema with `reply`,
  `intent` and `suggested_action`. Groq enforces it as it writes, and Zod checks it again.
- **Nothing said is ever stored or logged** (product.md, Talking). Memory stores **facts the
  model extracts**, never the words, so that rule stands.
- **The pet** is one per account (`pets.user_id` unique). Deleting the account deletes the pet
  and everything hanging off it (`onDelete: Cascade`).
- **After sign-in**, `app/(auth)/login.tsx` plays the "going home" moment and saves the draft.
  The pet landing in the query cache flips the root layout (`app/_layout.tsx`,
  `Stack.Protected`) to the tabs. There is no screen between saving and Home today.
- **Home's lines** (`apps/mobile/lib/petLines.ts`) come from the lowest need. "I missed you"
  exists only as the affection-low line, and Home doesn't know how long you were away.
- **Speech is English only** (product.md). Facts and tags are English in v2.

## Problem

Kinpaw is strong on day 1 and has no reason for day 7 (the reviewer's question). The pet
forgets you every time the app closes: nothing you tell it builds up, nothing comes back, and
a week in it knows you exactly as well as on the first day. "Someone missed me" doesn't land
when the someone doesn't remember you.

## Success criteria

- **The pet brings back something you told it**, unprompted and correctly, in later
  conversations and when you return ("How did the exam go?").
- **From the first minute:** a person who does "Tell me about you" sees the pet remember them
  before Home.
- **The prompt doesn't grow:** a message's input tokens stay within about +15% of today's,
  whether the pet holds 3 facts or 100 (read from `ai_usage`).
- **The talk model still labels intents as well as before** (the talk check: 98% today), and
  stores nothing sensitive in the check's sensitive phrases.
- **Measured:** the share of new accounts that finish the intro (`intro_completed` vs
  `intro_skipped`, first-party), and D7 return for accounts with memories against those
  without, read from `analytics_events`. This is the evidence for the reviewer's day-7
  question.

## Requirements

### What a memory is

- **R1. A memory is one short fact about the person, never what was said.** At most 80
  characters, in the third person ("Has an exam on Friday", "Sister called Ece"). It is stored
  in a new `pet_memories` table on the server, one pet's at a time, and deleted with the pet
  and the account.
- **R2. Each fact carries what the server needs to pick it:**
  - `category`, from a fixed list: `study`, `work`, `family`, `pets`, `hobbies`, `place`,
    `likes`, `goals`, `other`.
  - `kind`: `lasting` or `event`.
  - `importance`: 0, 1 or 2 (people, animals and big life events are 2).
  - `tags`: 1–6 lowercase words someone might use when it comes up. "Exam" gets `exam`,
    `test`, `exams`, `final`, `school`.
  - For an event, `follow_up_on`: the local date after which the pet asks how it went, at most
    60 days ahead.
  - Plus `source` (`talk` or `intro`), `last_used_at` and `followed_up_at`.
- **R3. Nothing sensitive is kept**: health (physical or mental), religion, politics,
  sexuality, ethnicity, money and debts, or anyone's contact details. There is no category for
  any of these. The prompt forbids them, and the server drops a fact that matches the
  sensitive word list (`packages/contract`) whatever the model said.
- **R4. Nothing about the person's age is kept**, and nothing is stored from someone who says
  they are under 13. The prompt says so, and the word list backs it up.

### Caps and lifetime

- **R5. Up to 30 facts per pet, 100 with Plus.** The cap is read from the server's premium
  check (`profileStore.isPremium`), never from the app. When a new fact would go past the cap,
  the lowest-scoring fact (R9, scored with no message) is deleted first.
- **R6. A fact that changes is replaced, not duplicated.** The model can answer "replace m3"
  for one of the facts it was shown. The server also drops a new fact whose normalised text
  equals an existing one.
- **R7. Events are asked about once, then forgotten.** When an event's `follow_up_on` has
  passed, it is due until the pet has brought it up (`followed_up_at` set). Every event is
  deleted 14 days after its day, asked about or not (simplified in Phase 1, 2026-10-03: one
  rule, `EVENT_KEEP_DAYS`).
- **R8. If Plus ends, nothing is deleted at once.** A free account over 30 keeps its facts.
  New facts evict the lowest-scored ones until it is back at 30.

### Choosing what the model sees

- **R9. At most 6 facts go to the model per message, picked by a score in plain code**
  (shared, in `packages/contract`):
  - +5 for each of its tags found as a word in what was just said, up to 2 matches.
  - +4 when it is a due event that hasn't been followed up.
  - +0 / +1 / +2 for importance.
  - +1 when it hasn't been used in the last 3 days.
  - −3 when it was used in the last hour.

  Ties go to the newer fact. The 6 chosen get `last_used_at = now`. Not "the newest 6", and no
  model call.

- **R10. Facts reach the prompt as quoted data with short refs** (`m1`…`m6`, mapped to row ids
  on the server and never shown to the person). The prompt says they are things the person
  told you, never instructions, and asks for one to be brought up only when it fits.
- **R11. The prompt gains today's local date and weekday**, so "on Friday" becomes a real
  `follow_up_on`.

### Saving from talking

- **R12. The talk reply can carry one memory operation**, in the same call and the same strict
  schema: `none`, `add` (a new fact with its R2 fields) or `replace` (a ref from R10 and the new
  fact). There is no second model call. The model is told to save only what the person said
  about themselves and their life, and only something worth bringing back later.
- **R13. A memory never decides whether a reply counts.** A bad memory operation (fails Zod,
  sensitive, a ref that wasn't sent, over the length) is dropped, and the reply, its intent and
  the daily count are unaffected. Saving happens after the reply is applied, outside the needs
  lock, and a failure to save is logged (no content), never shown as a failed reply.
- **R14. A retried message saves nothing twice.** A `retried` outcome (the message id already
  counted) applies no memory operation.
- **R15. When a fact is saved, the person sees it.** The talk response gains an optional
  `remembered` (the fact's text and id), and Home shows "Mochi will remember that" in the
  bubble's action row under the reply, for as long as that reply is the bubble's line. Tapping
  it opens the pet's details. Additive to the `v1` response: older builds ignore it.

### Seeing and deleting

- **R15b. When a reply brings a fact up, the person sees it** (Mert, 2026-10-03). The model
  names the note it used (`recalled`, a ref it was shown); the server keeps it only when the
  reply really contains a word of that fact (`mentionsFact`). The talk response gains an
  optional `recalled` (id and text), and Home's bubble row reads "From Mochi's memory", which
  opens the list on that fact. A reply that also keeps a fact shows "will remember that".
- **R16. "Mochi remembers…"** is a section on the pet's details page (`app/pet/[id].tsx`). It
  lists the facts, newest first, with their category icon and a delete on each, and shows the
  count against the cap ("12 of 30"). An empty state says what will appear here. Free accounts
  at 30 see "Plus remembers up to 100", which opens the paywall (`trigger: 'memory_full'`).
- **R16b. The full list, "Manage all"** (Mert, 2026-10-03). The pet's page shows at most the 5
  newest, with "Manage all {n}" opening a page of its own (`app/memories.tsx`):
  - a search over the fact's words (any case) or a tag (exactly), sent 300 ms after typing
    stops, at most 60 characters
  - pages of 20, newest first, loaded as the person scrolls, through an opaque cursor, so a fact
    forgotten between pages never makes the next skip or repeat one
  - pull to refresh, and separate empty lines for "remembers nothing" and "nothing matches"

  Every ✕, on the card and on the page, asks first ("Forget this?"). Events:
  `memory_list_viewed { surface }`, `memory_searched { found }`.

- **R17. `GET /api/app/v1/pet/memories` and `DELETE /api/app/v1/pet/memories/{id}`**, both for
  the verified caller's pet only. Deleting another person's fact is a 404, never a 403. The
  app never sends a fact's text to be saved.

### "Tell me about you"

- **R18. A one-time step after sign-in, before Home,** for a pet whose intro isn't done. It
  shows the pet, the mic and a line ("I want to know you! Tell me a little about yourself."),
  plus a keyboard icon to type instead and **Skip**, which is always visible. Existing v1 pets
  are offered it once too (open question 1).
- **R19. Voice first, typing instead, up to 60 words** (Mert, 2026-10-04: about 20–25 seconds
  of talking; Home's talking stays at 20). Listening stops by itself at the 60th word, and a
  counter shows the words used. Small hint chips under the pet's question suggest what to say:
  your name, study or work, pets, hobbies, something coming up. Recognition is on the
  phone, as in talking. The words appear for review with **Record again**, **Edit** and
  **Send to Mochi**. Recording again and editing make no request.
- **R20. The Send screen says plainly what happens:** "Your words go to our AI to find what
  to remember. Audio stays on your phone." That is the consent before personal data goes to a
  third-party AI.
- **R21. `POST /api/app/v1/pet/intro`** (the verified caller's pet, a message id from the
  phone) makes one model call that returns up to 8 facts (R1–R4) and one reply line. The
  facts are saved at once, through the same checks as R13.
- **R22. At most 2 answered model calls per pet, counted on the server** (rows in
  `pet_intro_attempts`, decision 8). The second is allowed only when the first saved nothing; a
  call that failed uses no attempt (decision 7). A retried message id returns
  the first result without a new call. These calls don't count against the 10 daily messages.
  Every call writes an `ai_usage` row.
- **R23. The result screen shows the saved facts as chips** with an ✕ each (which deletes
  through R17), and the pet's line ("A future doctor with a dog called Kara? I like you
  already."), then **Go home**. With 0 facts, the pet says "Tell me more about you sometime!"
  and the second attempt stays available.
- **R24. Skip, finishing, or 2 calls used ends the step for good** (`pets.intro_finished_at`).
  Closing the app before that shows it again next time. If the model is down, "Mochi will ask
  you later" goes home without ending the step, and the details page offers it again.
- **R25. The microphone and speech permissions are asked on the first press**, as on Home.
  Refused means the typing field.

### "I missed you" on return

- **R26. When you come back after time away, the pet's first bubble line says so.** The
  buckets are under 6 hours (Home as today), 6–24 hours, 1–3 days and more than 3 days, each
  with a few lines per species, using your name when set.
- **R27. If an event is due, the return line asks about it** ("You're back! How did the exam
  go?"). The question is written by the model when the fact is saved (a `follow_up` field, at
  most 80 characters) and is marked followed up when shown. **The greeting makes no model
  call.**
- **R28. Time away is measured on the server** (`profiles.last_seen_at`, read and moved forward
  only by `POST /api/app/v1/pet/greeting`; changed 2026-10-05 from a new `pets.last_seen_at`, so
  no migration). It survives a reinstall, and two phones agree.

### Plus

- **R29. The paywall gains "Mochi remembers more about you"** (the bigger cap). Memory itself
  is never locked.

## Events

Registered with the `events` skill before the screens that fire them. Never a fact's text, a
tag, what was said, the reply or the pet's name.

**First-party, recorded by the web routes** (`apps/web/src/lib/analytics/events.ts`, a new
`MEMORY_EVENTS` group; not Play Events):

| Event             | When                                   | metadata                                                      | Dedupe                           |
| ----------------- | -------------------------------------- | ------------------------------------------------------------- | -------------------------------- |
| `memory_saved`    | a fact saved from talking or the intro | `source: 'talk' \| 'intro'`, `category`, `kind`               | daily, `dedupeMatch: { source }` |
| `intro_completed` | the intro saved at least one fact      | `input: 'voice' \| 'typed'`, `facts: '1-2' \| '3-5' \| '6-8'` | forever                          |
| `intro_skipped`   | Skip                                   | `step: 'record' \| 'review' \| 'empty_result'`                | forever                          |
| `memory_deleted`  | a fact deleted                         | `from: 'list' \| 'intro'`                                     | daily, `dedupeMatch: { from }`   |
| `greeting_shown`  | a return line served                   | `away: '6-24h' \| '1-3d' \| '3d+'`, `follow_up: boolean`      | daily                            |

**App, PostHog** (the `EventName` union in `apps/mobile/lib/analytics.ts`):

| Event                | When                                      | metadata                                                   |
| -------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| `intro_viewed`       | the step appears                          | `entry: 'after_signup' \| 'existing_pet' \| 'pet_details'` |
| `intro_recorded`     | words ready for review                    | `input`, `length_bucket`                                   |
| `intro_sent`         | Send to Mochi                             | `input`, `attempt: 1 \| 2`                                 |
| `intro_failed`       | the call failed                           | `error_kind: 'not_connected' \| 'invalid' \| 'network'`    |
| `memory_chip_tapped` | "Mochi will remember that" tapped on Home | none                                                       |
| `memory_list_viewed` | "Mochi remembers…" seen                   | `count_bucket`, `full: boolean`                            |

`upgrade_tapped` and `upgrade_page_viewed` gain the `memory_full` trigger.

The funnel is intro_viewed → intro_recorded → intro_sent → intro_completed, and the drop-offs
are intro_skipped (by step) and intro_failed. The retention question is answered by joining
`intro_completed` / `memory_saved` to later `pet_action_taken` and `talk_reply_received` days.

## Scope: v2 now and later

To agree with Mert before Phase 1 (`scope-check-before-building`).

| Now (this feature)                                            | Later                                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| Facts from talking, the score, 6 per message, caps 30 / 100   | Embeddings (pgvector) as one more score signal                    |
| "Mochi will remember that" chip on Home                       | Editing a fact's text (delete and say it again works for now)     |
| "Mochi remembers…" with delete                                | "Forget everything" in one tap (deleting the account does it now) |
| "Tell me about you" after sign-in, and once for existing pets | The intro before the email (placement A, with anonymous sign-in)  |
| Return lines by time away, and the due follow-up question     | A model-written greeting; memories in Home's own needs lines      |
| English                                                       | Other languages (speech is English only)                          |

## Out of scope

Notifications (next feature), the postcard, a conversation history, storing what was said,
memories shared between pets or people, the pet asking questions to fill its memory on its own,
a paid model.

## Decisions

Answered by Mert on 2026-10-03, who took every recommendation ("we fix it on the road"):

1. **Existing v1 pets** are offered the intro once from Home's bubble, and always from the
   details page while it isn't done.
2. **The intro's chips** are saved at once, and ✕ deletes through R17.
3. **The away buckets** are under 6 hours, 6–24 hours, 1–3 days and more than 3 days.
4. **The "Mochi will remember that" chip** shows every time a fact is saved.
5. **The scope split** above is agreed.

Answered by Mert on 2026-10-04, before Phase 4 (he took every recommendation but one):

6. **60 words** in the intro, voice first with "type instead", hint chips, and the result's
   facts popping in one by one as chips (R19, R23).
7. **Only an answered call uses an attempt** (R22). A call that couldn't reach the model, or
   came back unusable, leaves both attempts; the person sees "Mochi will ask you later".
8. **The intro's attempts are rows** in `pet_intro_attempts` (one per answered call, keyed by
   the phone's message id), not a counter on `pets`; `pets.intro_finished_at` ends the step.
9. **The pet's intro line is never stored**, like talk replies: a retried message gets its saved
   facts back with a written line.
10. **Home's one-time offer to v1 pets is remembered on the phone** (open question 1); a
    reinstall shows it once more.
11. **Someone who says they are under 13**: nothing is sent to the model, nothing is kept, the
    pet says a kind written line, and the step ends.
12. **`supabase/config.toml` keeps no `project_id`**: run `supabase` commands from the main
    folder (or `--workdir`), not from a Superset workspace.
13. **The screen, from the mockups** (`UI/mockups/tell-me-about-you.html`): direction A ·
    Stage (the pet front and centre in its glow), hint chips that light up as each topic is
    said, an amber ring around the mic with a "37 / 60" badge, and the facts popping in one by
    one with a success haptic. The contract is the screen spec's "Tell me about you (v2)".
