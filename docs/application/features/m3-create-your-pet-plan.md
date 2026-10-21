# M3: Create your pet — plan

> Requirements: [m3-create-your-pet-requirements.md](m3-create-your-pet-requirements.md).
> Written 2026-10-01. The v1 / later split was agreed with Mert on 2026-10-01.

Phases 1–3 are the foundations: art, catalog, draft, events. Every screen depends on them and
none of them is a screen. Phases 4–8 are the screens in the order a person meets them. Phase 9
is the v1 work. Each phase leaves the gates green.

## Phase 0 — Tabs: My pet · Profile · Settings

**Files:** `apps/mobile/app/(tabs)/_layout.tsx`; `apps/mobile/app/(tabs)/index.tsx` (title "My
pet"); new `apps/mobile/app/(tabs)/profile.tsx` and `apps/mobile/app/(tabs)/settings.tsx`,
split from M2's `you.tsx` (deleted); `apps/mobile/app/(tabs)/talk.tsx` deleted;
`apps/mobile/components/TabBar.tsx`; `apps/mobile/lib/analytics.ts`.
**Changes:** R13 and R14. Sign out, delete account and every event they fire move with their
rows, unchanged.
**Verify:** typecheck, lint, tests; `check:standards` (`account-deletion-in-app` with the screen
at `/settings`); `check:events`.

## Phase 1 — Pet art and `PetImage`

**Files:** new `apps/mobile/assets/pets/*.png` (32) and `apps/mobile/assets/pets/README.md`
(re-rendering from the SVGs, which stay in `docs/application/UI/pets/`); new
`apps/mobile/components/pet/PetImage.tsx`; new `apps/mobile/lib/petArt.ts` (the static
`require` map, by look and mood).
**Changes:** render each SVG to a 1024 × 1024 transparent PNG with `sharp` (scale only, the
baseline and centring stay the source's). `PetImage` wraps `expo-image` with
`transition` set to the `base` duration (0 under reduced motion), and an accessibility label.
**Verify:** `npm run typecheck`, `npm test`; a contact sheet of the 32 PNGs matches the SVGs;
size check (target under 3 MB for all 32; drop to 768 px if over). Done: 1.7 MB.

## Phase 2 — Catalog and sky colours

**Files:** new `packages/contract/src/v1/pets.ts`, its export in `packages/contract/index.ts`,
cases in `contract.test.mts`; `packages/brand` (new `art.sky` export and its test).
**Changes:** species, look, mood, preset and trait enums; the look table (name, species,
tier); the preset table (title, description, six levels 1–5, stored doubled 1–10); helpers
`isPremiumLook`, `presetTraits`. `art.sky`: the four phases' gradient stops, sun or moon
colour, and the two bridge tones, from the spec's sky table. A `phaseAt(date)` helper with
the spec's hours (05–12, 12–17, 17–21, 21–05) lives in the app (`lib/sky.ts`).
**Verify:** contract and brand tests; `npm test -w @app/mobile` (no-hex test still passes).

## Phase 3 — The draft and the events

**Files:** new `apps/mobile/lib/petDraft.ts` (load, save, clear, Zod schema, the AsyncStorage
key `kinpaw:petDraft:v1`), new `apps/mobile/contexts/PetDraftContext.tsx`;
`apps/mobile/app/_layout.tsx` (preload the draft with the theme pref; provide the context);
`apps/mobile/lib/analytics.ts`; new `apps/mobile/__tests__/petDraft.test.ts`.
**Changes:** the draft model and its persistence (R4); the v1 events from the requirements,
registered with the `events` skill, each group with its Step 2 comment; `onboarding_step_viewed`
gains the `look`, `name`, `personality` values.
**Verify:** unit tests for load (missing, corrupt, valid), save and resume step;
`npm run check:events` (new events warn as unfired until their screens exist).

## Phase 4 — Routing for the signed-out Create flow

**Files:** new `apps/mobile/app/(create)/_layout.tsx`; `apps/mobile/app/_layout.tsx` (the
group under the signed-out guard); `apps/mobile/app/index.tsx` (redirect to the draft's step).
**Changes:** the `(create)` stack (`look`, `name`, `personality`, `meet`), gestures off like
the onboarding stack; Welcome redirects when a draft exists (R5).
**Verify:** with a stub screen per route: signed out → each route reachable; signed in →
none reachable; a saved draft reopens at its step.

## Phase 5 — Welcome and `SkyBand`

**Files:** new `apps/mobile/components/pet/SkyBand.tsx`; `apps/mobile/app/index.tsx`
(rewritten); `apps/mobile/lib/constants.ts` (the M2 tagline and description replaced by the
spec's copy).
**Changes:** v1 Welcome (R7): static phase gradient, logo, three pets on one contact shadow
(Tuxedo, Ginger `happy`, Biscuit), copy, buttons, legal line, `welcome_*` events.
**Verify:** Simulator at each phase (change the device clock or pass a phase override in
development), dark and light; VoiceOver reads the pets as one image.

## Phase 6 — Look

**Files:** new `apps/mobile/app/(create)/look.tsx`, new `apps/mobile/components/pet/LookCard.tsx`.
**Changes:** R8 in the onboarding shell; draft writes; look events.
**Verify:** each species keeps its own pick; Calico and Blue merle refuse with the status line
and the haptic; VoiceOver reads the radio group.

## Phase 7 — Name and Personality

**Files:** new `apps/mobile/app/(create)/name.tsx`, `apps/mobile/app/(create)/personality.tsx`.
**Changes:** R9 and R10; draft writes; their events.
**Verify:** empty name refuses with the shake and the caption; a 21-character name is
refused; the preset persists across a relaunch.

## Phase 8 — Meet

**Files:** new `apps/mobile/app/(create)/meet.tsx`, new `apps/mobile/components/pet/PetBubble.tsx`
(shared with Home in M5).
**Changes:** R11; `pet_meet_viewed` and `pet_meet_continued`; "Take {name} home" → sign-in.
**Verify:** the full path from a fresh install on the Simulator and the iPhone; the funnel
events fire in order (logged in development); `local-review`.

## Phase 9 — Later (only when picked)

The fine-tune sheet and `TraitDotRow` with their events; Welcome and Meet motion; the sky's
sun, moon, stars and clouds (or left to M5). Each is its own small phase when it is picked.

## Risks

- **Routing is load-bearing.** A wrong guard either strands a signed-out person or shows
  Create to a signed-in one. Phase 4 is verified with stub screens before any real screen
  depends on it.
- **The draft is the only copy of a pet until M4.** It is validated on read and discarded only
  when unreadable; nothing in M3 clears a valid draft.
- **Bundle size.** 32 PNGs at 1024 px; Phase 1 checks the total before anything uses them.
- **Two onboardings for a while.** After Meet, sign-in still runs the template's onboarding
  until M4 replaces the gate. Expected, and stated in the demo notes.
- **No server, money or entitlement change.** Premium looks are read from a static catalog
  and never unlocked by the app.
