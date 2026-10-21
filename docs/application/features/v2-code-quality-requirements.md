# v2: code quality — requirements

> **Status (2026-10-08): Phases 0–3 done, Phase 4 next.** Started after the week-1 evaluation
> (scorecard 73/100: code speed 3, code quality 3, initiative 3, UX/UI 3, comms 3, demos 4).
> Branch `feat/v2-code-quaility-ui`. The phases, what each changed and what is left:
> [v2-code-quality-plan.md](v2-code-quality-plan.md).

## Why

The week-1 scorecard gave code quality 3/5. An audit of the whole repo on 2026-10-07 found the
foundation strong and the score lost in what a reviewer sees first and in a few large screens:

**Already good (leave alone):** one route factory (`createAppRoute`: auth → input → handler →
response checked against the contract); one Zod contract shared by the app and the server; stores
built by factories over Prisma, with transactions and row locks; RLS on with nothing granted;
strict TypeScript with no `any`; no `console.*`; every CI gate green; 1,037 tests passing.

**What was wrong (the audit's findings):**

| #   | Area                 | Finding                                                                                                                                                                                |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | First impressions    | The three READMEs were still the template's (no word of Kinpaw).                                                                                                                       |
| A2  | First impressions    | Stray root files: `app.json` (`com.anonymous.app-template`), root `dependencies`, `DESIGN.md` titled "8x Play Template".                                                               |
| A3  | First impressions    | Commit history: typos, vague and duplicate subjects, 100-file commits.                                                                                                                 |
| A4  | First impressions    | AGENTS.md said the app is localised with i18next; no screen uses it.                                                                                                                   |
| B5  | Design               | God screens: `login.tsx` 924 lines (16 `useState`), Home 734 (16 `useState`, 14 `useRef`, 9 `useEffect`), `start.tsx` 725; also `IntroFlow` 565, `upgrade.tsx` 546, `_layout.tsx` 462. |
| B6  | Design               | 24 `react-hooks/exhaustive-deps` suppressions, one hiding a stale closure on Home.                                                                                                     |
| B7  | Design               | The time-zone check copied into six routes; the one-field 400 built by hand in eleven places.                                                                                          |
| B8  | Design               | ~~About 20 direct `process.env` reads bypassing `lib/env.ts`.~~ Withdrawn: the standard (`env-schema`).                                                                                |
| B9  | Design               | Template routes (`track`, `waitlist`, `contact`, `delete-account`) without Zod; the email regex copied.                                                                                |
| C10 | Correctness          | Login rewrote the email (stripped `+tag`, Gmail dots) and sent the code to the rewritten address.                                                                                      |
| C11 | Correctness          | Supabase's raw error text shown to the person.                                                                                                                                         |
| C12 | Correctness          | The wrong-code lockout lives on the phone only (a courtesy; Supabase's limits are the guard).                                                                                          |
| C13 | Correctness          | `appearance_changed` registered but never fired (turned out to be a dead entry: there is no theme choice).                                                                             |
| C14 | Security             | No throttling on public endpoints (`waitlist`, `contact`, `track`, `friends/lookup`).                                                                                                  |
| C15 | Production readiness | The voice keeps state in server memory and starts work after answering: fine on localhost, not on Vercel.                                                                              |
| D16 | Tests                | The app's trickiest logic untested: `usePetAction`, `useTalk`, Home's bubble, the hooks.                                                                                               |
| D17 | Tests                | The admin Plus grant and revoke (public server actions, money) untested. (Every Kinpaw route was in fact tested; the first count was wrong.)                                           |
| E18 | Dead code            | `knip`: 7 unused files, 53 unused exports, an unused dependency to confirm.                                                                                                            |
| E19 | Dead code            | The temporary dev-only "reset photo tries" link on Create · Start.                                                                                                                     |

## Requirements

- **R1.** No behaviour change from a refactor: same copy, timings, events and layout. Each step
  ends with every gate green and Mert's check on the Simulator or the iPhone.
- **R2.** Logic leaves screens for hooks or pure functions, each tested where it can go wrong.
- **R3.** A test that guards something risky is proven to fail without the code it guards.
- **R4.** Money and entitlement code keeps its guard first and is reviewed twice
  (non-negotiable 3).
- **R5.** The person never sees a provider's raw error text.
- **R6.** Mert runs every git command; each step ends with suggested Conventional Commits.

## Decisions (with Mert)

| Date       | Decision                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-08 | The sign-in code goes to the address as typed, trimmed and lower-cased only (no `+tag` or Gmail-dot rewriting).                             |
| 2026-10-08 | The root README is for reviewers first; the template's own sections are trimmed, not kept in a separate file.                               |
| 2026-10-08 | The screenshots in the README are one image (`docs/assets/readme-screens.webp`), so it renders in any viewer, not only GitHub.              |
| 2026-10-08 | The stray root dependencies are removed (verified: lockfile changed only the root entry, hoisted versions identical, an iOS bundle builds). |
| 2026-10-08 | The Play Stats API is not touched or tested here until the `pulse` MCP is connected (non-negotiable 2).                                     |

## Out of scope

New features, any change to what a screen shows, a native rebuild, the Play Stats API.
