# M4: Save your pet — requirements

> Milestone M4 of the [roadmap](../roadmap.md). Inputs: [product.md](../product.md) ("The
> pet", "Sign-in", "Structure and scope"), the [screen spec](../UI/kinpaw-screen-spec-v1.md)
> (Pet created before sign-in, Save Mochi and sign in, Events) and the canvas exports
> `Save Mochi · Email`, `Save Mochi · Code`, `Save Mochi · Wrong code`, `Sign in · Welcome back`
> in `../UI/screens/`. Plan: [m4-save-your-pet-plan.md](m4-save-your-pet-plan.md).
> Written 2026-10-01.
>
> **Status: agreed with Mert on 2026-10-01** (see [Decisions](#decisions)).

## Problem

After M3 a pet exists only on the phone. Signing in runs the template's sign-in screen (email,
code, Apple and Google buttons, development "Skip" buttons) and the template's "What should we
call you?" step, and the pet is never saved: a new phone, a reinstall or a cleared cache loses
it. The person who already has an account sees the same template screens. M4 saves the pet to
the account and makes signing in look and feel like Kinpaw.

## What is there today (research)

- **No pet on the server.** `apps/web/prisma/schema/` has `profiles`, the analytics tables,
  leads, `premium_grants` and the kept sample tables. The pet catalog (species, looks, moods,
  presets, traits) is already in `@app/contract` (`src/v1/pets.ts`, M3), ready for the server
  to validate against.
- **Route pattern:** every `/api/app/v1` route is one `endpoints.ts` entry built by
  `createAppRoute` (bearer check, input and output parsed with the contract). A create by a
  client-sent `id` that already exists answers 200, not 201: the API's idempotency pattern.
- **Security for a new table:** the generated migration plus a hand-written one, `ENABLE ROW
LEVEL SECURITY` and `REVOKE ALL ... FROM anon, authenticated` (`docs/rules/migrations.md`);
  `check:rls` fails without it.
- **The gate** (`app/_layout.tsx`): signed out → Welcome, `(auth)`, `(create)`; signed in with
  `user_metadata.onboarding_completed` false → the template's `(onboarding)` (now one step, your
  name); true → the tabs. The spec moves the gate to **"has a pet on the server"**.
- **Sign-in** (`app/(auth)/login.tsx`, 581 lines): email → `signInWithOtp`, six-box
  `CodeInput` → `verifyOtp`, resend cooldown, lockout after repeated wrong codes, native Apple
  and OAuth Google, and development-only skip buttons. Its flow, validation and events
  (`login_started`, `otp_sent`, `login_success`, `login_failed` with `method` and `reason`)
  stay; the layout and copy are new.
- **Events:** `pet_save_viewed`, `pet_created` and `pet_save_failed` aren't registered.
  `pet_created` is also a first-party moment (product decision), recorded by the server route
  through `recordUserEvent` (`apps/web/src/lib/analytics/record.ts`), which needs it in the
  web registry.
- **Load-bearing:** auth (the gate and the sign-in screen), and a new user-owned table. No money
  or entitlement column is written. The one entitlement check: a premium look can't be saved by
  a free account, decided on the server.

## Success criteria

- From a fresh install: create a pet, sign in with an email code on the Save screen, and land on
  My pet with that pet saved to the account. Sign out and back in: the pet is still there. On
  another Simulator or after a reinstall: signing in brings the same pet back.
- "I already have an account" signs in on the Welcome back screen and goes straight to My pet.
- **Measured by** `pet_save_viewed` → `login_success` → `pet_created` (first-party, so the admin
  panel counts saved pets without PostHog), and `pet_save_failed` for what goes wrong.

## v1 / later split (agreed)

**v1:**

| Area         | In v1                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data         | A `pets` table (one per account in v1), its security migration, a store, and two routes: read my pet, create my pet (safe to retry)                                             |
| Gate         | "Has a pet on the server" replaces "onboarding completed"; the template's `(onboarding)` screen is removed                                                                      |
| Save screen  | Sky band, top bar (Back, logo lockup), the pet breathing on the sheet's edge with its bubble, the email step and the code step in the sheet, every state in the spec's table    |
| Welcome back | The same screens for "I already have an account": the Welcome trio on the sheet edge, no bubble, the "Welcome back" copy                                                        |
| Saving       | After sign-in, the draft is saved, then cleared; a failed save keeps the draft and shows "Try again"; if the account already has a pet, it wins and the draft is dropped gently |
| Profile      | A "Your pet" row: portrait, name, personality (read-only)                                                                                                                       |
| Events       | `pet_save_viewed`, `pet_created` (first-party too), `pet_save_failed`; the template's sign-in events unchanged                                                                  |

**Later:**

| Area                  | Waits                                                                   | Why                                                                            |
| --------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Keyboard choreography | The sky collapsing and the pet shrinking to 96 pt as the keyboard rises | v1 keeps the field and button above the keyboard with plain keyboard avoidance |
| Apple and Google      | Their buttons on the Save screen                                        | Hidden by product decision while they aren't configured; their code stays      |
| Needs                 | Hunger, happiness, energy, affection on the pet                         | M5 adds them to the table with the logic that uses them                        |
| More than one pet     | A second pet, the multi-pet switcher                                    | v2 (product.md, out of scope)                                                  |

## Requirements

**Data and API**

R1. A `pets` table: id (client-generated UUID), owner (the profile, cascading on account
deletion), species, look, name, preset, the six traits (1–10), created and updated times. One
pet per account (unique on the owner). RLS on, nothing granted to the API roles.
R2. `GET /api/app/v1/pet` answers `{ pet }` with the caller's pet, or `{ pet: null }`. A failed
query is an error, never `null`.
R3. `POST /api/app/v1/pet` creates the caller's pet from `{ id, species, look_id, name, preset,
traits }`, validated with the catalog (the look belongs to the species, the name is 1–20
characters, the traits 1–10). Retrying with the same `id` answers 200 with that pet. If the
account already has a different pet, it answers 200 with **the existing pet** and
`existing: true`, and writes nothing. A premium look from a free account is a 400 (`invalid_request`, an issue on `look_id`). Records
`pet_created` first-party on a real create only.
R4. No `user_id` is ever read from the body: the owner is the verified caller.

**Gate and saving**

R5. Signed in, the app asks the server for the pet before showing anything (the splash holds,
as it does for the session today). With a pet → My pet. Without a pet and with a draft → save
the draft. Without a pet and without a draft → Create, signed in (see open question 1).
R6. Saving the draft: on success clear the draft and replace the stack with My pet so Back
can't return to Create. On failure keep the draft, show the spec's "Couldn't save {name} yet"
state with "Try again". If the account already had a pet, drop the draft, go to My pet, and
say so once: "You already have {name}. They're right here."
R7. The template's `(onboarding)` group and its `onboarding_completed` metadata are no longer
used (the screen is deleted; old metadata is ignored).

**Screens** (layout, copy and states per the spec's "Save Mochi and sign in", within the v1
split)

R8. The Save screen, email step and code step, replacing the template's login layout; the
template's sign-in logic (OTP send, verify, resend cooldown, lockout) is kept. Auto-verify on
the sixth digit.
R9. Welcome back, the same screens with the trio and the returning copy.
R10. Apple and Google buttons are not shown; the development-only skip buttons stay out of
release builds (as today) and out of the new layout.

**Profile**

R11. Profile shows "Your pet": the 40 pt portrait, the name and the preset title.

## Events

| Event                 | App         | Fires when                       | Properties                                      | Sinks                            |
| --------------------- | ----------- | -------------------------------- | ----------------------------------------------- | -------------------------------- |
| `pet_save_viewed`     | mobile      | The Save screen appears          | `mode`: save, welcome_back                      | PostHog                          |
| `pet_created`         | web (route) | The pet is saved (a real create) | `species`, `look_id`, `preset`, `custom_traits` | First-party (`analytics_events`) |
| `pet_save_failed`     | mobile      | Saving the draft fails           | `error_kind`                                    | PostHog                          |
| `login_*`, `otp_sent` | mobile      | Unchanged (template)             | `method`, `reason`                              | PostHog                          |

The events skill's Step 2: **aha** for this milestone is `pet_created` (the pet is safe);
**drop-off** is `pet_save_viewed` → `login_success` → `pet_created`; **discriminators** `mode`,
`species`, `look_id`, `preset`, `error_kind`; **money**: no; **lifecycle**: sign-up already
fires `user_signed_up` from the session route, unchanged. No property carries the pet's name or
the email.

## Out of scope

Needs, Home, the core loop (M5). Talk (M6). The paywall and Plus (M7). Renaming or changing
the pet after it is saved. Apple and Google sign-in. A second pet.

## Decisions

Agreed with Mert, 2026-10-01:

1. **Signed in, no pet → Welcome, then Create, signed in** (Welcome first changed 2026-10-01). The `(create)` steps are also reachable
   signed in without a pet, and Meet's "Take {name} home" saves straight away.
2. **Your own name:** the template's name step goes; Profile shows the name from the email.
3. **The v1 / later split above.**
4. **The "going home" moment** (Mert, 2026-10-01, after M5): once the code is right, the line
   under the code boxes becomes "✓ Signed in" and walking paw prints with "Taking {name} home…"
   ("Sniffing out your pet…" for Welcome back); the pet sends up hearts and its bubble moves
   through "Yay! Let's go home." → "Packing my favourite toy…" → "Is it far? I'm ready!". A
   successful save or find stays on screen at least 1.4 s before My pet appears
   (`useSavePet`'s `holdMs`); a failure shows at once. Under Reduce Motion the prints stand
   still and there are no hearts.
