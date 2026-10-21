# v2 Long-term memory — plan

> Requirements: [v2-memory-requirements.md](v2-memory-requirements.md). Each phase is shown to
> Mert and confirmed before the next (`working-with-mert`). At the end of each session, the
> day's work goes into [updates/v2.md](../updates/v2.md). Mert runs every git command; each
> phase ends with the gates and a suggested commit message.

Target: Phases 0–3 before the first evaluation (about 2026-10-06), so the demo shows the pet
remembering. Phases 4–5 follow.

> **Where we are (2026-10-05):**
>
> - **Done:** Phases 0–3, plus 3b ("Manage all"); Phase 4, "Tell me about you": 4a (the server)
>   and 4b (the screen), checked by Mert on his iPhone after three rounds of fixes (one page to
>   tell, the facts around the pet under the sky, the intro straight after the email code).
> - **Dropped, 2026-10-04:** the Groq model fallback. Mert has more than one Groq account and
>   swaps the key when a model's free day runs out.
>   **Phase 5, "I missed you", built 2026-10-05** (the voice lane), waiting for Mert's check:
>   the greeting route, the return lines and Home. No migration: time away is
>   `profiles.last_seen_at`, read and moved by the greeting alone (the lifecycle route no longer
>   stamps it), not a new `pets.last_seen_at`. A due question is asked after any time away, not
>   only after 6 hours, so someone who opens the app often is still asked.
> - **Next, in order:**
>   1. `talk:check --memory-only`, to measure the worried-before-an-event cases and `recalled`.
>   2. Phase 6, the finishing pass.
> - **Open question for Mert:** the intro prompt also gets the profile's name, so the pet said
>   "Hi Mert" when the person introduced themselves as Matthew. Should a name said in the intro
>   win?

## Phase 0 — Check the model can do it

> **Done 2026-10-03.** Built for real rather than in a scratch copy: memory is off unless a
> request carries it (`ReplyRequest.memory`), so the app's talking is unchanged until Phase 2.
> **Model decided 2026-10-03: `gpt-oss-120b`** (Mert took the recommendation).

**Built:**

- `packages/contract/src/v1/memory.ts`: the categories, kinds, caps, `checkFact`, the sensitive
  words (prefixes and whole words, so "agency" and "therapist" pass), `saysUnder13` and
  `nextDays`, with 76 contract tests.
- `server/talk/prompt.ts`: today, a 7-day calendar, the notes as quoted data with refs, and a
  short memory guide.
- `server/talk/reply-schema.ts`: `petReplyWithMemorySchema(refs)` and `parseMemoryOp`. A bad
  memory never fails the reply.
- Groq and the stub. The stub keeps "remember that …".
- `memory-reply.test.mts`; the web suite is 207 green.
- `scripts/talk-check.mts`: memory phrases (`MEMORY_PHRASES`, 28) and the memory bar, plus
  `--no-memory` (M6's check) and `--memory-only` (to tune on less quota).

**What the runs showed (2026-10-03):**

| Run                             | Intents  | Kept / 12 | Sensitive kept | Replace   | Moment kept      | Median | Tokens per call   |
| ------------------------------- | -------- | --------- | -------------- | --------- | ---------------- | ------ | ----------------- |
| 20b, first guide                | 98%      | 9         | 0 / 8          | 0 / 2     | yes              | 606 ms | 1,622 in, 119 out |
| 20b, short guide + calendar     | —        | **12**    | 0 / 8          | 0 / 2     | yes              | 706 ms | 1,508 in, 144 out |
| 120b, short guide (memory only) | —        | **12**    | 0 / 8          | **2 / 2** | no               | 959 ms | 1,508 in, 177 out |
| **120b, full**                  | **100%** | **12**    | 0 / 8          | **2 / 2** | yes (borderline) | 842 ms | 1,558 in, 157 out |

- **The first guide cost +70% input tokens** (about 950 → 1,620), not the +13% estimated.
  Shortened and measured, memory now adds about +55%: the guide, the calendar, the notes and
  the bigger answer shape. On a paid tier that is about a cent a month per free user.
- **The calendar fixed the dates**: "Friday" landed on Wednesday before it, and on the right
  day after.
- **`gpt-oss-20b` never replaces a fact**: it adds "Moved to Berlin" beside "Lives in
  Istanbul". **`gpt-oss-120b` does**, and labels intents better (100%). It was slower (842 ms
  against 606 ms) and costs about twice as much per token.
- "Kara is barking at the mailman" was kept by 120b in one of two runs: a borderline case.
  The chip (R15) and the list (R16) cover it.

**The decision for Mert:** keep 20b (cheapest and fastest, but facts pile up instead of
updating), or move talking to 120b (`DEFAULT_GROQ_MODEL`, one constant; about $0.10 a month
per free user instead of about $0.05 on the paid tier).

## Phase 1 — The table, the rules and the store

> **Done 2026-10-03; table and rules checked by Mert, migration applied.** Two changes from
> the plan below, because the pet-looks session is editing `pets.prisma` and both event
> registries at the same time:
>
> - **Only `pet_memories` is in this migration.** The three `pets` columns (`intro_attempts`,
>   `intro_finished_at`, `last_seen_at`) move to Phases 4 and 5, which use them. `pets.prisma`
>   gains only the relation line (`memories PetMemory[]`), which writes no SQL, so this migration
>   doesn't depend on the other session's.
> - **The events are registered at the start of Phase 2**, where the first one fires.
>
> **Built:**
>
> - `prisma/schema/memory.prisma`
> - migrations `20261003193136_pet_memories` (generated) and `…193137_pet_memories_security`
>   (RLS on, nothing granted)
> - the score, the pick and the eviction in `@app/contract` (`memory.ts`,
>   `memory-score.test.mts`)
> - `server/db/memory.ts` (`memoryStore`: `list`, `pick`, `save`, `remove`, `due`,
>   `markFollowedUp`) and its database suite, `memory.test.mts`, with 13 tests
>
> **Checked:**
>
> - On a local replay: no drift, and `check:rls` covers all 13 tables.
> - Database suites: memory, pets and talk, 33 passing.
> - Contract 84 and web 209 passing.
> - Typecheck, lint and format clean.

**Files:**

- `apps/web/prisma/schema/memory.prisma` (new): `PetMemory`.
- `apps/web/prisma/schema/pets.prisma`: `memories PetMemory[]`, and on `Pet`:
  `introAttempts Int @default(0)`, `introFinishedAt DateTime?`, `lastSeenAt DateTime?`.
- The migration (CI writes it from the schema; the hand-written line turns RLS on for
  `pet_memories`).
- `packages/contract/src/v1/memory.ts` (new): the categories, kinds, caps (`MEMORY_CAP_FREE`
  30, `MEMORY_CAP_PLUS` 100, `MEMORY_IN_PROMPT` 6, `INTRO_FACTS_MAX` 8, `INTRO_ATTEMPTS_MAX`
  2), the sensitive word list, `normaliseFact`, `isSensitive`, `scoreMemory` and `pickMemories`
  (pure, shared, tested), and the Zod schemas for the memory wire and the model's memory
  operation. Exported from `src/v1/index.ts`.
- `apps/web/src/server/db/memory.ts` (new): `memoryStore`, taking the verified user id:
  - `list(userId)`
  - `pick(userId, said, now)`: scores, takes 6, sets `last_used_at` and returns them with refs.
  - `save(userId, op, refs, { cap, source, now })`: checks, dedupes, replaces, evicts past the
    cap, and drops expired events, in one transaction.
  - `remove(userId, id)`
  - `due(userId, today)`
  - `markFollowedUp(userId, id, now)`
- `apps/web/src/server/db/memory.test.mts` (new, the database suite): caps, eviction order,
  replace, dedupe, another person's id, event expiry, cascade on pet delete.
- `packages/contract/src/v1/memory.test.ts` (new): the score and the pick.
- The events: the `events` skill registers `MEMORY_EVENTS` (web) and the app events
  (`apps/mobile/lib/analytics.ts`) from the requirements' tables.

**Table `pet_memories`:**

| Column                     | Type                                |
| -------------------------- | ----------------------------------- |
| `id`                       | uuid, primary key                   |
| `pet_id`                   | uuid, foreign key, cascade, indexed |
| `text`                     | varchar 80                          |
| `follow_up`                | varchar 80, nullable                |
| `category`                 | text                                |
| `kind`                     | text                                |
| `importance`               | smallint                            |
| `tags`                     | text[]                              |
| `follow_up_on`             | date, nullable                      |
| `followed_up_at`           | timestamptz, nullable               |
| `source`                   | text                                |
| `last_used_at`             | timestamptz, nullable               |
| `created_at`, `updated_at` | timestamptz                         |

`category`, `kind` and `source` are text, not enums, as elsewhere: the lists live in the
contract.

**Verify:**

- `npm run db:reset` (it replays the migrations), then `npm run test:db --workspace=@app/web`.
- `npm run check:rls`.
- `npm test`.
- `npm run check:events`.

**Stop here: the table and the rules shown to Mert before Phase 2.**

## Phase 2 — Memory in talking

> **Done 2026-10-03; checked by Mert on his iPhone** (saving, replace, the worried case).
>
> - **Events:** registered for the whole feature at once, since both registries are also open
>   in the pet-looks session: `MEMORY_EVENTS` on the web (`memory_saved`, `memory_deleted`,
>   `intro_completed`, `intro_skipped`, `greeting_shown`) and six app events. Only `memory_saved`
>   and `memory_chip_tapped` fire yet.
> - **The talk flow** (`talk-to-pet.ts`) picks the facts before the model call (a failure there
>   means no facts, never no reply) and saves after a counted reply. The cap comes from the
>   server's premium check. A replace's ref is turned back into its row id on the server.
> - **The route** returns `remembered` and records `memory_saved` with labels only.
> - **The app:** the chip is the bubble's action row ("{name} will remember that"), the same
>   row as "Try again", so Home's layout doesn't move. It shows while that reply is the line,
>   and tapping it opens the pet's details.
> - **Checked:** web 218, mobile 307 and contract 84 passing; lint and typecheck clean on the
>   changed files; `check:events` green.
> - **Found in Mert's first live try (2026-10-03):** Groq answered one "I've an exam tomorrow"
>   with a 400, and the pet said it lost its train of thought. Six identical requests went
>   through, so it is intermittent: Groq's strict mode refusing an answer that failed its own
>   schema check (`json_validate_failed`). `groq.ts` now tries such a request once more when the
>   first took under 5 s. It also logs a 400's error code, never its message, which can hold what
>   was said. Web 220 passing.
> - **Mert's second live try (2026-10-03):** the exam was saved right (an event on 2026-10-04,
>   "How did the exam go?") and was in the prompt, but "I'm a bit nervous today" got a generic
>   comfort reply. Two causes, two fixes:
>   - The fact said "tomorrow" forever. An event's day is now shown relative to today, on every
>     message ("coming up tomorrow", "in 3 days, Wednesday"), and new event facts leave the day
>     out of their text.
>   - The model didn't link "nervous" to the exam. Better wording alone took it from 0 of 7 to 0
>     of 4. Now plain code does it (`soundsWorried`, `isSoon`, `likelyWorry` in the contract): a
>     worried message lifts an event coming up within 2 days in the score, and marks that note
>     "probably why they feel this way: name it". 1 of 2 probes then named the exam.
> - **Still to measure:** two "worried the day before" phrases are in the check ("brought the
>   fact up by name"). Run `npm run talk:check -- --memory-only` on a fresh 120b quota;
>   today's is nearly used up. If it stays low, the next thing to try is moving the notes after
>   the answer rules (models weigh what comes last).

**Files:**

- `server/talk/reply-provider.ts`: `ReplyRequest` gains `memories` (refs and text) and
  `today`; `PetReply` gains `memory` (the operation, or null).
- `server/talk/reply-schema.ts`: the JSON schema and Zod gain `memory`. It is strict, so every
  key is required: `action: 'none' | 'add' | 'replace'`, `ref` (`''` when none), `text`,
  `follow_up`, `category`, `kind`, `importance`, `tags`, `follow_up_on` (`''` when none). The
  operation is checked separately, so a bad one never fails the reply (R13).
- `server/talk/prompt.ts`: today's date and weekday; "What you know about your person", the
  picked facts as quoted data with their refs; the memory guide with what to save, what never
  to save, how to write tags and follow-ups, and when to replace.
- `server/talk/groq.ts` and `stub.ts`: pass the memories through. The stub saves a fact for a
  phrase like "remember that …", so tests and CI exercise the path.
- `server/talk/talk-to-pet.ts`:
  - Before the call, `memoryStore.pick`.
  - After `talkStore.apply` returns `replied`, `memoryStore.save` with the cap from
    `isPremium`.
  - Nothing for `retried`.
  - A failed save is logged with no content.
- `packages/contract/src/v1/talk.ts`: the response gains optional `remembered`
  `{ id, text }`.
- `app/api/app/v1/pet/talk/route.ts`: passes `remembered` and records `memory_saved`.
- Tests: `prompt.test.mts`, `reply-schema.test.mts`, `talk-to-pet.test.mts` (a saved fact,
  a dropped sensitive one, a retry saving nothing, a failed save not failing the reply).
- App: `hooks/useTalk.ts` reads `remembered`; `components/pet/MemoryChip.tsx` (new) is the
  "Mochi will remember that" chip under the bubble; `app/(tabs)/index.tsx` places it.
  Tapping it goes to the pet's details (the list arrives in Phase 3; until then the chip only
  shows).

**Verify:**

- `npm run talk:check` again: intents and memory, with the real prompt.
- On the Simulator, against Groq:
  - Say "I have an exam on Friday": the chip appears, and the row is in `pet_memories`.
  - Close the app, come back and say "I'm nervous": the pet brings up the exam.
  - Say "I've been depressed": nothing is saved.
- `ai_usage` shows the tokens per message.

## Phase 3 — "Mochi remembers…"

> **Done 2026-10-03, with R15b ("From Mochi's memory", Mert's idea); checked by Mert.**
>
> - **Contract:** `petMemories` (GET, `?time_zone`) and `deletePetMemory` (DELETE `:id`,
>   `?from=list|intro`), plus `recalled` on the talk response.
> - **Server:** routes under `pet/memories/` with 6 route tests. The cap comes from
>   `isPremium`. Someone else's id, or a malformed one, is a 404.
> - **Recall:** `recalled` in the answer shape, checked with `mentionsFact`, logged by its ref.
> - **App:**
>   - `useMemories` and `useForgetMemory`, with an optimistic delete and rollback.
>   - `MemoryList` on the pet's page, highlighting the fact Home's row was about.
>   - Home's row: "will remember that", or "From {name}'s memory".
>   - The list refreshes after a save.
>   - The `memory_full` paywall trigger, and a third Plus feature.
> - **Fixed on the way:** the web test kit captured Node's test-runner output (binary, over the
>   same stdout) as if it were log lines, which failed a test and hid 5 others' results. It now
>   keeps only JSON log lines and passes the rest through.
> - **Checked:** web 231, mobile 307 (the one failure is the pet-looks session's drawing test,
>   mid-edit), contract 86. Lint, typecheck, `check:events` and `check:store` clean.
> - **Not yet measured:** the `recalled` field with the real model. It goes into the next
>   `talk:check` run with the worry phrases.

**Files:**

- `packages/contract`: the `petMemories` and `deletePetMemory` endpoints.
- `apps/web/src/app/api/app/v1/pet/memories/route.ts` (GET) and `…/memories/[id]/route.ts`
  (DELETE), both new, plus route tests. DELETE records `memory_deleted`.
- `apps/mobile/hooks/useMemories.ts` (new): TanStack Query, with an optimistic delete and
  rollback.
- `apps/mobile/components/pet/MemoryList.tsx` (new), placed in `app/pet/[id].tsx`: the
  category icons, delete, the count against the cap, the empty state, and "Plus remembers up
  to 100" opening the paywall with `memory_full` (`lib/openPaywall.ts`, `lib/paywall.ts`).
- The paywall's line "Mochi remembers more about you" (R29).
- The screen spec: a "Pet details → Mochi remembers" section.

**Verify:**

- On the Simulator: the list shows the Phase 2 facts. Delete one, and it is gone after a
  refetch and from the next prompt.
- Another account's id returns 404 (route test).
- VoiceOver reads each fact and its delete.

**Stop: demo-ready memory. Updates log, gates, commit message.**

## Phase 3b — "Manage all": search, pages, ask before forgetting

> **Done 2026-10-03, at Mert's request; checked by Mert** (then the read-only card and the
> calmer dialog).
>
> - **Contract:** `petMemoriesQuery` gains `q` (at most 60), `cursor` (opaque) and `limit` (1–20).
>   The response gains `total`, `matched` and `next_cursor`.
> - **Server:**
>   - `memoryStore.page`: the facts scoped to the caller's pet in SQL. Expired events are left
>     out in SQL. The search is the text (`ILIKE`, with `%` and `_` escaped) or an exact tag.
>   - A keyset cursor on (created_at, id). The page and both counts are read in one
>     transaction.
>   - `server/api/memory-cursor.ts`: an opaque base64url cursor, checked before any query (a
>     made-up one is a 400).
> - **App:**
>   - The card shows the 5 newest and "Manage all {n}".
>   - `app/memories.tsx`: a debounced search, `useInfiniteQuery` pages of 20 with the last
>     results kept while a new search loads, a `FlatList`, pull to refresh.
>   - `MemoryRow` and `useConfirmForget` are shared: every ✕ asks first.
>   - A forget updates every cached list (the preview and every search's pages) and rolls back
>     on failure.
> - **Mert's review (2026-10-03):**
>   - The card is read-only: forgetting happens only on the full page.
>   - The button is full width ("See all {n} and manage").
>   - The "Forget this?" modal no longer jumps as it closes. It had cleared its message mid-fade,
>     so the bottom-anchored card shrank, and the row left the list under the fading backdrop.
>     Now the text stays until the fade ends and the forget runs after it. Leaving the page
>     mid-fade still sends it.
> - **Found by the database suite:** Prisma's `contains` doesn't escape `%` and `_` (a "%" search
>   matched every fact). They are escaped now, with tests for both.
> - **Checked:** database suites 36 (memory 16, with paging across a delete, search, expiry and
>   another person's facts), web 233 (route: search, limit and cursor round-trip, made-up cursors
>   and oversize input refused), mobile 310. Lint, typecheck and `check:events` clean.

## Phase 4 — "Tell me about you"

> **4a (the server) done 2026-10-04,** after Mert's decisions 6–11 (requirements, "Decisions"):
> 60 words, voice first, hint chips, chips one by one; only an answered call uses an attempt;
> attempts as rows; the line never stored; the v1 offer remembered on the phone; under 13 never
> sent to the model.
>
> - **Contract:** `src/v1/intro.ts` (`INTRO_WORDS_MAX` 60, `INTRO_FACTS_MAX` 8,
>   `INTRO_ATTEMPTS_MAX` 2, the send-or-skip body, the response), the `petIntro` endpoint, the
>   `intro_closed` error (409), and `intro_due` on `GET /pet` (additive).
> - **Database:** migration `20261004175119_pet_intro` (generated): `pet_intro_attempts` (one row
>   per answered call, keyed by the phone's message id), `pets.intro_finished_at`, and
>   `ai_usage.purpose` (`talk` | `intro`, default `talk`); `…175120_pet_intro_security` (RLS on,
>   nothing granted).
> - **Server:** `server/db/intro.ts` (`introStore`: `due`, `status`, `record` under a per-person
>   lock, `skip`); `memory.ts`'s saving moved into `keepFact` so the intro keeps facts by the
>   same rules in its own transaction; `talk/intro-prompt.ts` and `intro-schema.ts` (talking's
>   `FACT_RULES` and fact fields, shared); `ReplyProvider.intro` in Groq (one strict-call path
>   for both answers) and the stub; `talk/intro.ts` (the flow); `POST /api/app/v1/pet/intro`,
>   recording `intro_completed`, `intro_skipped` and `memory_saved` (source intro).
> - **Checked:** web 263 (intro flow 10, route 9, answers 10), contract 90, mobile 310; the
>   database suites on a replay (intro 10, with two calls at once; memory 16). Lint, typecheck,
>   format and the `check:*` gates clean. `check-standards.test.mjs` fails 2 tests on `main`
>   too: the CLI's 10.8 KB of JSON is cut at 8 KB by `process.exit` (not this change).
> - **Real calls (gpt-oss-120b, 2026-10-04):** 5–7 facts from a rich introduction, names kept as
>   "Goes by …", health, therapy, religion, a password and a phone number all dropped, about 930
>   tokens in and 300–850 out, 0.7–2.3 s. One run put "Friday" on the Wednesday (the other on
>   the right day): the chip and the list let the person catch it. Seven calls in a row hit
>   the 8K tokens-a-minute limit.

**Files:**

- `packages/contract`: the `petIntro` endpoint:
  - Body: `{ message_id, text, input, time_zone }`, or `{ skip: true, step }`.
  - Response: `{ facts, line, attempts_left }`.
- The intro prompt and schema: `server/talk/intro-prompt.ts` and `intro-schema.ts` (new), up
  to 8 facts and one line. `ReplyProvider` gains `intro(request)`, in Groq and the stub.
- `apps/web/src/server/talk/intro.ts` (new): attempts and retries (R22), saving (R21), ending
  (R24), `ai_usage`.
- `apps/web/src/app/api/app/v1/pet/intro/route.ts` (new), with tests. It records
  `intro_completed` and `intro_skipped`.
- `GET /api/app/v1/pet` gains `intro_due: boolean` (additive).
- App:
  - `app/intro.tsx` (new), in the with-pet stack of `app/_layout.tsx`. It is opened once, over
    the tabs, when `intro_due` is true after a save, and from the details page.
  - Its states: record, review, sending, result with chips, empty result, failed and "ask me
    later". It reuses `MicButton`, `useVoice` and the typing field from Home.
  - Existing pets get Home's one-time bubble (open question 1).
- The screen spec: an "Tell me about you" section with every state and its copy.

**Verify:**

- On the Simulator and the iPhone, with a new account, sign in to the intro:
  - Record, record again and edit: no request (the network log is empty).
  - Send: the chips appear, and ✕ deletes one.
  - Go home, then talk: the pet uses a fact.
- Skip ends the step for good.
- A third call is refused by the server (route test).
- The model down: go home, and the step is offered again from details.

> **4b (the screen) built 2026-10-04,** from the mockups Mert chose (`UI/mockups/
tell-me-about-you.html`: A · Stage, hints that light up, the ring with "37 / 60", chips popping
> in) and his approved copy; the contract is the screen spec's "Tell me about you (v2)".
>
> - **Screen:** `app/intro.tsx` (steps ask, check, thinking, result, empty, later), presented
>   over the tabs with no swipe away. `components/intro/`: `MicRing` (Home's MicButton in an
>   amber ring that fills toward 60 words), `HintChips`, `FactChips` (popping in 140 ms apart,
>   ✕ forgets at once with `from: 'intro'`).
> - **Logic:** `hooks/useIntro.ts` (`useIntroDue` from `GET /pet`'s `intro_due`, send and skip,
>   `intro_sent` and `intro_failed`); `lib/introHints.ts` (the word match, with tests);
>   `lib/introOffer.ts` (a fresh save opens it; the one-time Home offer remembered on the phone);
>   `useVoice` takes `maxWords`, `maxMs` and `talkEvents`, so the intro listens to 60 words for
>   30 seconds without Home's talk events.
> - **Entry points:** a new pet saved → Home opens the intro at once (`after_signup`); a pet from
>   before → Home's bubble once, "I don't know much about you yet. Will you tell me?" with "✦
>   Tell {name} about you" (`existing_pet`); the pet's page, a row above "{name} remembers…"
>   while it is open (`pet_details`).
> - **One line not in the approved copy:** when the recognizer itself fails, the bubble says "I
>   couldn't hear you just now. You can type instead."
> - **Checked:** mobile 315 (hints 5), typecheck, lint, events, store, format, standards.
> - **Mert's first try (2026-10-04), and the rework:** the words chip covered the hints, "Your
>   name" didn't light on "My name is…" (the pattern was case-sensitive), and the words cleared
>   after a pause (iOS 18 starts a fresh transcript per segment; `lib/transcript.ts` now keeps
>   the earlier pieces, which also fixes Home). Mert asked for one page instead of Ask and Check
>   (recording again adds to the end, ↺ clears), and a result with the pet big in the middle
>   and the facts floating around it (`FactOrbit`, replacing `FactChips`). `MicButton` gained
>   `showHint`. Checked: mobile 319 (transcript 4), typecheck, lint.
> - **Mert's second try (2026-10-04):** the facts overlapped, so they now sit in rows of at most
>   two above and below the pet (`FactOrbit`, rewritten), read-only (no ✕: no requests during the
>   moment), under Home's live sky with the lamp glow. A second account on the same phone didn't
>   get the intro, and waiting for the screen to settle (`InteractionManager`) didn't fix it (the
>   database showed the pet created as new, so the flag was set): a navigation during the switch
>   from sign-in to Home is dropped. Home then showed the flow in a full-screen `Modal`, whose
>   closing on Go home crashed the app on Mert's iPhone; now the root layout draws it as a plain
>   full-screen layer over the stack while `useIntroAfterSave()` is on (`lib/introOffer.ts`,
>   `components/intro/IntroFlow.tsx`; `app/intro.tsx` is a thin route for the other two entries).
>   Then, at Mert's request, **before Home**: a new pet waits in `lib/introOffer.ts` and goes into
>   the cache (opening Home) only when the intro ends. The "Tell {name} about you" button that
>   stayed after finishing was Home reading the stale `intro_due` while it refetched:
>   `useIntroDue` is now false while fetching, and the offer also needs it. The one-time offer is keyed by pet (`kinpaw:introOffered:v2:{petId}`).

## Phase 5 — "I missed you"

> **Built 2026-10-05**, waiting for Mert's check. As planned, except: time away is
> `profiles.last_seen_at` (moved by `profileStore.markSeen`, one statement), and the lifecycle
> route sets only the region now (`recordRegion`); the return line is asked once per foreground
> and only while Home shows (`hooks/useGreeting.ts`); `due()` skips an event with no question.

**Files:**

- `packages/contract`: the `petGreeting` endpoint. Body: `{ time_zone }`. Response:
  `{ away: 'none' | '6-24h' | '1-3d' | '3d+', follow_up: { id, question } | null }`.
- `apps/web/src/app/api/app/v1/pet/greeting/route.ts` (new): reads and moves
  `last_seen_at`, picks one due event and marks it followed up, and records `greeting_shown`.
  No model call.
- App:
  - `lib/petLines.ts`: return lines per bucket and species, with and without the person's name.
  - Home calls the greeting on open and on returning to the app, at most once per foreground.
    The return line takes the bubble before the needs line.
- Tests: buckets, a follow-up asked once, cleanup 14 days after.

**Verify:** move `last_seen_at` back by hand in the local database and reopen the app. Each
bucket's line appears, and a due exam is asked about once, then not again.

## Phase 6 — Finish

- The accessibility pass on the new screens (VoiceOver, Dynamic Type, reduced motion, 44pt
  targets).
- The privacy text: the facts kept and their deletion, and the words sent to the AI provider
  for the intro.
- The `store-review` rules a file can decide (`npm run check:store`).
- Docs: product.md's v2 decisions, the screen spec, `updates/v2.md`, and this file's status.

## Risks

- **A bigger strict schema could lower intent accuracy or slow replies.** Phase 0 measures it
  before anything is built. The fallback is `gpt-oss-120b`, or a second small call for memory
  only.
- **Groq's free tier** (200K tokens a day) runs out sooner with bigger prompts and the check
  script. That's fine for development and the demo; the paid tier comes before real users.
- **Wrong or embarrassing facts.** The chip shows each save, the list deletes, sensitive words
  are dropped on the server, and the prompt treats facts as data. Facts are personal data:
  they stay out of logs, events and `ai_usage`.
- **The migration adds a table and three nullable columns.** It's easy to reverse, and no
  `v1` response loses a field. Every response change is additive.
- **Entitlement:** the cap reads `isPremium` on the server. Nothing here writes `plan_type` or
  `premium_*`.
- **The intro shown at the wrong time** could catch a returning user or show twice. That's
  why `intro_due` comes from the server and `intro_finished_at` is set on Skip, finishing, or
  the attempts used up.
