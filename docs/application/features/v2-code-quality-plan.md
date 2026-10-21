# v2: code quality — plan

> Requirements and the audit's findings: [v2-code-quality-requirements.md](v2-code-quality-requirements.md).
> Phases 0–3: branch `feat/v2-code-quaility-ui` (PR #19, merged). Phase 4: `feat/v2-code-quality`.
> **Last updated 2026-10-09: v2 code quality is done; Phase 5 waits for launch.**

## Where it stands

| Phase                    | Status                                                    | Next                                  |
| ------------------------ | --------------------------------------------------------- | ------------------------------------- |
| 0. First impressions     | **Done**, committed                                       | —                                     |
| 1. Correctness           | **Done**, committed                                       | —                                     |
| 2. Split the big screens | **Done**, with `IntroFlow` and `upgrade.tsx` (2026-10-09) | —                                     |
| 3. Tests                 | **Done**                                                  | Optional: the template routes (below) |
| 4. Consistency           | **Done** (2026-10-09)                                     | —                                     |
| 5. Before launch         | Deferred until after the demo (Mert, 2026-10-09)          | At launch                             |

Tests: 1,037 at the start → **1,145** (mobile 399 → 498, web 335 → 344). Every gate green,
`web:build` and an iOS bundle build.

**Uncommitted at the end of the session** (Mert commits): the Create · Start split
(`app/(create)/start.tsx`, `components/onboarding/PathCard.tsx`, `BuiltStage.tsx`,
`lib/petShowcase.ts`, `__tests__/petShowcase.test.ts`); Phase 3 (`__tests__/petAction.test.ts`,
`__tests__/talk.test.ts`, `hooks/useTalk.ts`, `apps/web/src/server/admin/`,
`apps/web/src/app/admin/(protected)/users/actions.ts`); these docs.

## Phase 0: first impressions — done

- Root `README.md` rewritten for reviewers first: what Kinpaw is, screenshots
  (`docs/assets/readme-screens.webp`), features, a Mermaid architecture diagram, the quality gates,
  running it locally. `apps/mobile/README.md` (739 lines of template) and `apps/web/README.md`
  rewritten for Kinpaw.
- Root `app.json` and the root `dependencies` removed; `DESIGN.md` names Kinpaw's accent;
  AGENTS.md says the app is English-only for now (i18next set up, unused).

## Phase 1: correctness — done

- `apps/mobile/lib/signIn.ts`: the code goes to the address as typed; `emailProblem`; Supabase
  errors mapped to plain lines (`signInFailure`, `signInErrorLine`); a network or rate-limit
  failure no longer counts toward the lockout; Apple and Google failures logged.
- `apps/web/src/server/api/time-zone.ts` (`requireTimeZone`) and `invalidInput()` in
  `app-errors.ts` replace 11 hand-built 400s.
- `appearance_changed` removed from the mobile registry (`check:events` clean).

## Phase 2: split the big screens — Home, login, Start done

| Screen                     | Lines     | Now in                                                                                                                                                                                    |
| -------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home `(tabs)/index.tsx`    | 734 → 508 | `lib/homeBubble.ts` (what the bubble shows, pure), `hooks/usePetReactions`, `usePetGaze`, `useIdleNudge`, `useNotesAsk`, `useReplyVoice`, `useIntroOffer`. No `eslint-disable` left.      |
| Login `(auth)/login.tsx`   | 880 → 268 | `hooks/useEmailOtp`, `useAfterSignIn`, `useThirdPartySignIn`; `petLine` in `lib/signIn.ts`; `components/auth/` (`EmailStep`, `CodeStep`, `AfterMessage`, `ProviderButtons`, `SheetPets`). |
| Create · Start `start.tsx` | 725 → 147 | `components/onboarding/PathCard.tsx`, `BuiltStage.tsx`; the showcase looks in `lib/petShowcase.ts`.                                                                                       |

Checked by Mert on the iPhone (Home) and the Simulator (login). Start: check the cards' motion
once more after committing.

**Also done 2026-10-09:**

| Screen                      | Lines     | Now in                                                                                                                                                                                       |
| --------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intro `intro/IntroFlow.tsx` | 564 → 64  | `components/intro/TellPage.tsx`, `ResultPage.tsx`; `hooks/useIntroTell` (the words, listening, sending); `lib/introPage.ts` (the copy and what the page says when, pure). Tests for both.    |
| Paywall `app/upgrade.tsx`   | 546 → 281 | `hooks/usePaywall` (plans, buy, restore, redeem, the alerts); `components/plus/PlanList`, `PlusMemberCard`, `TrialTimeline`; `priceLine`, `planSubtitle`, `renewalLine` in `lib/paywall.ts`. |

The paywall keeps Restore, the Terms and Privacy links and the auto-renew disclosure in its own
file, calling `paywall.purchase()` and `paywall.restorePurchases()` there: `check:store`'s
`paywall-legal-links` reads only the screen, so a reviewer sees every Apple 3.1.2 piece in one
place. **Check:** "Tell me about you" (talk, type, send, skip, the result) and the paywall (plans,
the trial line, Restore, the legal links).

`SkyScene` (668) and `PetStage` (494) are drawing and animation; splitting them gains little.

## Phase 3: tests — done

- `usePetAction` (7): optimistic, in order, only the last answer written back, refetch on failure.
  The key test was proven to fail with the hook's guard removed.
- `useTalk` (12): one at a time, the last three exchanges, the limit, retry under the same id,
  the voice. Found and fixed: the voice-hold timer was never cleared.
- The admin Plus grant and revoke (7): the logic moved from the `'use server'` file to
  `apps/web/src/server/admin/plus-grants.ts` (`createPlusActions`, dependencies passed in) so the
  admin check can be tested; a non-admin is refused before any read or write. Proven to fail with
  the check removed. **Check:** grant and revoke on `/admin/users` once.
- Also new in Phases 1–2: tests for `homeBubble`, every Home hook, `useEmailOtp`, `useAfterSignIn`,
  `petLine`, `petShowcase`.

**Left (optional):** the template routes `track`, `waitlist`, `contact`, `lifecycle/session` have
no tests. `dashboard/v1/summary` waits for `pulse`.

## Phase 4: consistency — in progress

**Done 2026-10-09:**

- **3. Constants:** `lib/petEffects.ts` holds the burst and care-effect types, `BURST_MS`,
  `CARE_EFFECT_MS` and `careEffectsFor` (new `__tests__/petEffects.test.ts`); `CODE_LENGTH` is in
  `lib/signIn.ts`. `petReactions` and `emailOtp` tests no longer mock Reanimated or AsyncStorage.
- **4. Dead code:** the six unused files, `components/Lines.tsx` (web), and the never-used
  `ActionSheet`, `CardSkeleton`, `SectionHeader`, `StaggerList`, `LoadMore`, `Marks`'
  `ProgressBar`, `makeThemed`, `formatCalendarDate`, `EASE_OUT`/`EASE_IN_OUT`, `PHASE_WORD`,
  `idConflict` and the web device twins `AppCard`/`ProgressBar`/`StatusBadge` removed; exports
  used only in their own file un-exported. Kept on purpose: the i18n helpers (item 6),
  `isPlayEventsEnabled` (the template's Play Events surface), `cssColor` (`@app/brand`'s API),
  and `recordPageview`: **nothing calls it, so `analytics_pageviews` is never written** (dwell
  tracking was never wired; decide whether to wire or drop it). `react-native-purchases-ui`
  still waits for Mert (native: a rebuild). knip reads no test files, so check each "unused
  export" with `git grep -w` before removing it.
- **2. Zod on the public routes:** `looksLikeEmail` and `emailAddress` in `@app/contract`
  (`common.ts`) are the one email check, for the app's sign-in and the website.
  `server/api/public-bodies.ts` parses the bodies of `waitlist`, `contact`, `delete-account`
  (the email request) and `track`; the routes' responses are unchanged. New: a contact name is
  capped at 200 characters, a deletion request needs `confirm: true` exactly (the page sends
  it), and a `track` body that isn't a JSON object is a 400 (it was a 500). Tests for the
  schemas and the refusal paths of `waitlist`, `contact` and `track`.
- **Decided 2026-10-09:** keep `react-native-purchases-ui` (no native rebuild now) and the
  unused i18n setup (v3); leave `recordPageview` and `analytics_pageviews` until a screen needs
  time-on-page.

- **1. Env reads: withdrawn, no change.** The org standard (`docs/STANDARDS.md`, `env-schema`)
  is that code reads `process.env.X` where it needs it and `lib/env.ts` validates the whole set
  once, at boot; `check:env` keeps code, schema and `.env.example` in step. Reading at call time
  is also what lets the route tests set a variable per test. Audit finding B8 was wrong.
- **5. `exhaustive-deps`: 24 suppressions → 2.** `hooks/useMountEffect.ts` for the 14 "once on
  arrival" effects (its one suppression is the point of its name); real dependencies where they
  never change (`NeedPill`'s shared values, `SkyScene`'s `useEvery` range as numbers, `PetStage`'s
  `busyFor` as a `useCallback`; Reanimated's `useReducedMotion` is a constant); `PetArt` keeps
  the last face in a ref; `hooks/useLatest.ts` for a value read but not followed (`Sheet`,
  `AppModal`, `FineTuneSheet`, `PetStage`'s cue) and the same inline ref in the web's
  `TrackEvent`. Left: `useMountEffect` and `useThemedStyles` (keyed on the palette, documented).
  `useEffectEvent` is the long-term tool, but `eslint-plugin-react-hooks` 5.2 doesn't know it.
  **Check:** the Create steps, the paywall, a sheet and an alert opening and closing, the pet's
  face and glances on Home.
- **6. i18n:** kept for v3 (decided above).

**Phase 4 is done.**

## Phase 5: before launch — deferred

Not for the hackathon demo ([demo-first](../../memory/demo-first-no-production-work.md)).

- The voice's in-memory state (`server/voice/once.ts`, the `jobs` map in `make-voice.ts`) and the
  talk route starting it without waiting: needs Next's `after()` and shared storage on Vercel.
- Throttling on public endpoints (`waitlist`, `contact`, `track`, `friends/lookup`).
- Delete the dev-only "reset photo tries" link on Create · Start (`resetPhotoTriesForDev`,
  [dev-reset-photo-tries](../../memory/dev-reset-photo-tries.md)).

## How each step is verified

From the repo root, the gates CI runs (the `local-review` skill):

```bash
npm run typecheck && npm run lint && npm run format:check && npm run check:events \
  && npm run check:standards && npm run check:store && npm test && npm run web:build
```

Jest prints in colour; to read its totals, run it with `--colors=false`. Hook tests with TanStack
Query need `gcTime: Infinity` and a tick after `mutate()`
([local-checks-and-traps](../../memory/local-checks-and-traps.md)).
