# M3: Create your pet — requirements

> Milestone M3 of the [roadmap](../roadmap.md). Inputs: [product.md](../product.md) ("The
> pet"), the [screen spec](../UI/kinpaw-screen-spec-v1.md) (Pet art contract, Shared logic →
> Pet created before sign-in, Welcome, Create · Look, Create · Name, Create · Personality and
> Fine-tune sheet, Meet Mochi, Events), the design canvas exports in `../UI/screens/` and the
> pet art in `../UI/pets/`. Plan: [m3-create-your-pet-plan.md](m3-create-your-pet-plan.md).
> Written 2026-10-01.
>
> **Status: agreed with Mert on 2026-10-01** (see [Decisions](#decisions)): the v1 / later split
> below, PNG pet art, and the tabs My pet · Profile · Settings.

## Problem

A new person opening Kinpaw sees the template's Welcome (dealt project cards) and must sign in
before anything else. The product's promise is the opposite: you meet your pet first, and an
account is only how you keep it. M3 builds that first-run path, signed out, from Welcome to
the moment the pet appears and says hello.

## What is there today (research)

- **Pet art exists as vectors.** `docs/application/UI/pets/` holds all 32 files of the art
  contract (8 looks × 4 moods) as SVG: 200 × 200 viewBox, transparent, cream sticker edge
  baked in, no raster or text inside. The feet sit on the same baseline in every file (93.9% of
  the height; the contract says about 91%, and what matters, the same line everywhere, holds).
  The body is centred; the tail extends to the right. 128 KB in total.
- **Routing:** `app/_layout.tsx` has three guarded worlds: signed out (`index`, `(auth)`),
  signed in but onboarding not completed (`(onboarding)`, the template's name + appearance
  steps), and signed in with onboarding completed (`(tabs)`). The spec places Create "in
  `app/(onboarding)`", but that group is signed-in only. **Create must be reachable signed
  out**, so it needs its own group under the signed-out guard. The template's `(onboarding)`
  stays until M4 replaces the gate ("has a pet on the server").
- **Reusable pieces:** `OnboardingShell` (back, progress dots, floating CTA with refusal
  shake and double-tap guard), `SegmentedControl`, `Card` (standard / selected tiers),
  `SelectionRow` (72pt, ring), `Sheet`, `TextInputField`, `Eyebrow`, `Glow`, `IconButton`,
  `Button` (large primary with arrow disc), `LogoMark` (the moon tile, from M2),
  `lib/haptics`, `lib/motion` (springs and durations), `themePref.ts` (the AsyncStorage
  pattern: preload before first paint, never throw).
- **New pieces the spec names:** `PetImage`, `SkyBand`, `LookCard`, `PetBubble`,
  `TraitDotRow`, the sky colours as `art.sky` in `packages/brand`.
- **State:** `docs/rules/state-management.md` allows a context for app-wide client state
  that isn't server data. The draft is that: Welcome reads it (to resume), four screens write
  it, and M4 sends it after sign-in.
- **No server, no table, no money in M3.** The `pets` table, its routes and the save are M4.
  The only entitlement touch is reading "is this look premium" from a static catalog; nothing
  is unlocked or written.
- **Events:** the mobile registry has the template's `onboarding_started`,
  `onboarding_step_viewed` (`step: 'name' | 'appearance'`) and `onboarding_completed`. None
  of the `welcome_*` or `pet_*` events exist yet.

## Success criteria

- From a fresh install, signed out: Welcome → Look → Name → Personality → Meet, the pet
  appears in its chosen look with its preset's first line, and "Take {name} home" leads to
  sign-in. On the Simulator and the iPhone.
- Closing the app mid-flow and reopening it resumes at the step left, with every choice kept.
- **Measured by** the create funnel: `welcome_viewed` → `welcome_start_tapped` →
  `onboarding_step_viewed` (`look`, `name`, `personality`) → `pet_meet_viewed` →
  `pet_meet_continued`. The step after which people stop is the gap in that funnel. The
  activation "aha" stays `user_activated` on the first chat reply (product decision); Meet is
  the feature's own success moment.

## v1 / later split (agreed)

**v1**, built now, demos the whole path:

| Area        | In v1                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Pet art     | All 32 images from the SVGs, and `PetImage` (species, look, mood, size, accessibility label)                                                |
| Draft       | Kept on the phone, resumed at the step left, cleared only by M4's save                                                                      |
| Welcome     | Logo and name, three pets on one shadow, the spec's copy, both buttons, legal line; a **static** sky gradient for the current phase         |
| Look        | Cat / Dog, the 2 × 2 look cards with selected and Premium states, each species remembering its pick, the locked-look status line and haptic |
| Name        | The pet above the field, 1–20 characters, the refusal ("Give them a name first.")                                                           |
| Personality | The four presets, Cuddly homebody preselected                                                                                               |
| Meet        | Eyebrow, "{name} is home", the glow, the `happy` pet, the preset's first line in a bubble, "Take {name} home" → the existing sign-in        |
| Events      | Every event v1 fires, registered first                                                                                                      |

**Later**, after v1 (in M3 if time allows, otherwise M8 polish or the milestone named):

| Area                  | Waits                                                                                      | Why it can wait                                                    |
| --------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Fine-tune sheet       | The sheet, `TraitDotRow`, "Custom" on Meet, and its three events                           | Presets alone give every pet a personality (roadmap: cut if tight) |
| Motion                | Welcome's rise-and-breathe, Meet's blur dissolve, the bubble's stagger, the landing haptic | The screens work and read without it (roadmap: cut if tight)       |
| Sky detail            | Sun, moon, stars and clouds on Welcome, and their ambient motion                           | Built once for Home in M5 and reused here                          |
| Sky drives theme      | Auto appearance following the sky (dawn by day, dusk at night)                             | M7 by the roadmap; v1 uses the current appearance setting          |
| Locked look → paywall | After onboarding, a locked look opens the paywall                                          | Only reachable after M4/M7; during onboarding it never opens       |

## Requirements

**Pet art and catalog**

R1. 32 PNGs in `apps/mobile/assets/pets/{species}-{look}-{mood}.png`, rendered from the SVGs
in `docs/application/UI/pets/`, transparent, square, the same baseline as the source. The
SVGs stay in `docs/application/UI/pets/` as the source; `assets/pets/README.md` says how to
re-render (🎨 REPLACE with the final art).
R2. One catalog, shared by the app now and the server in M4: species (`cat`, `dog`), the
eight looks with their names and tier (free / premium), the four moods, the four presets with
title, description and trait levels, and the six traits. It lives in `@app/contract` as Zod
enums and constants, with no endpoint yet.
R3. `PetImage` renders a pet by species, look and mood at a given size, with an accessibility
label ("{name}, {mood}" or the look name before there is a name), and changes mood with a
crossfade over the preset's `base` duration (instant under reduced motion).

**The draft**

R4. The pet draft holds species, the look picked per species, name, preset, the six traits
and the furthest step reached. It is stored on the phone (AsyncStorage, Zod-validated on read;
an unreadable draft is discarded, never a crash) from the Look step on, and read before the
first frame so routing never flashes.
R5. Signed out with a draft: opening the app goes straight to the step that was left.
Signed out without one: Welcome. The draft is never cleared in M3 (M4 clears it after a
successful save).

**Routing**

R6. The Create screens and Meet live in a new signed-out route group, reachable only while
signed out. Back on each step goes to the previous one with the draft intact; Back on Look
goes to Welcome. "I already have an account" and "Take {name} home" open the existing sign-in.

**Screens** (copy, states and accessibility as the spec's sections; the cuts above apply)

R7. Welcome, per the spec, with `SkyBand` drawing the current phase's gradient (the four
phases and hours from the spec's Home section, colours from `art.sky` in `packages/brand`).
R8. Create · Look, per the spec, including: Ginger and Biscuit preselected; a premium tap
selects nothing, plays `warning`, and sets the status line; cards form a radio group.
R9. Create · Name, per the spec.
R10. Create · Personality, per the spec, without the fine-tune row in v1. (Built after all on 2026-10-01: the row,
the sheet with six `TraitDotRow`s, "Custom" on Meet and its three events; the shared
`hasCustomTraits` decides "Custom" on the phone and `custom_traits` on the server.)
R11. Meet, per the spec, with the first line by preset.
**Tabs** (decided 2026-10-01; product.md, "Structure and scope")

R13. The tab bar is **My pet · Profile · Settings**, with icons `PawPrint`, `User` and
`Settings`. My pet is `app/(tabs)/index.tsx`, the home screen (still the placeholder until
M5). Talk leaves the tab bar until M6 builds it. M2's You screen is split: **Profile** has who
you are (email) and the Kinpaw Plus card; **Settings** has appearance, haptics, account
(manage subscription, sign out), help and legal, the version, and delete account.
R14. `tab_selected` reports `tab`: `pet`, `profile` or `settings`.

R12. No colour literal in app code: sky colours come from `art.sky`; everything else from
roles.

## Events

All mobile (PostHog sink; unconfigured locally, so `track()` no-ops, but the registry and
`check:events` bind). No first-party or Play Events moment: no account exists yet in M3, and
`pet_created` (first-party) is M4's. **No property carries the pet's name.**

| Event                                                             | Fires when                             | Properties                                                     | v1    |
| ----------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------- | ----- |
| `welcome_viewed`                                                  | Welcome appears                        | `time_of_day`: morning, afternoon, evening, night              | yes   |
| `welcome_start_tapped`                                            | "Meet your pet"                        | none                                                           | yes   |
| `welcome_signin_tapped`                                           | "I already have an account"            | none                                                           | yes   |
| `onboarding_step_viewed`                                          | A Create step appears (existing event) | `step`: look, name, personality (added to the existing values) | yes   |
| `pet_species_selected`                                            | Cat / Dog changes                      | `species`                                                      | yes   |
| `pet_look_selected`                                               | A free look is picked                  | `species`, `look_id`                                           | yes   |
| `pet_look_locked_tapped`                                          | A premium look is tapped               | `species`, `look_id`, `during_onboarding`                      | yes   |
| `pet_name_submitted`                                              | Continue with a valid name             | `name_length`                                                  | yes   |
| `pet_preset_selected`                                             | A preset row is picked                 | `preset`                                                       | yes   |
| `pet_meet_viewed`                                                 | Meet appears                           | `species`, `look_id`, `preset`, `custom_traits`                | yes   |
| `tab_selected` (changed)                                          | A different tab is tapped              | `tab`: pet, profile, settings (was home, talk, you)            | v1    |
| `pet_meet_continued`                                              | "Take {name} home"                     | none                                                           | yes   |
| `pet_finetune_opened`, `pet_trait_changed`, `pet_finetune_closed` | The fine-tune sheet                    | as the spec                                                    | later |

The events skill's Step 2, answered:

1. **Aha:** for this feature, reaching Meet (`pet_meet_viewed`). Product activation stays the
   first chat reply.
2. **Drop-off:** each step is its own event, so the funnel above shows where people stop.
3. **Discriminators:** `step` on `onboarding_step_viewed`; `species` and `look_id` on the look
   events; `preset` on `pet_preset_selected`; `time_of_day` on `welcome_viewed`.
4. **Money:** no. `pet_look_locked_tapped` is upsell interest, not a purchase.
5. **Lifecycle:** no. Sign-up happens in M4.

## Out of scope

- Saving the pet to the server, the `pets` table, the Save and sign-in restyle, the gate change
  and the returning-user path (M4). In M3, signing in after Meet runs the template's sign-in
  and onboarding and lands on the placeholder tabs; the draft stays on the phone, unsaved.
- Home, needs, Talk (M5, M6). The paywall from a locked look (M7).
- The final pet art (the SVGs are the stand-ins until then).

## Decisions

Agreed with Mert, 2026-10-01:

1. **The v1 / later split above.** v1 is the version built now; there is no separate MVP.
2. **PNG at runtime.** The SVGs are rendered to PNG (`assets/pets/*.png`), so the final art
   drops in by replacing files; the SVGs stay as the source.
3. **Tabs: My pet · Profile · Settings** (R13, R14). Talk and anything AI join later.
4. **Added to M3 (Mert, 2026-10-01):** the full sky (sun, moon, stars, clouds with their ambient
   motion, `SkyScene`), Welcome's pet entrance and breathing and Meet's entrance
   (`RiseAndBreathe`; the 6 pt blur is left out, opacity and rise only), the app following the
   sky with no appearance choice (the template onboarding's appearance step and Settings'
   Appearance removed), and Profile, Settings and Help cleared of template content. So the
   "Motion", "Sky detail" and "Sky drives theme" rows of the later table are done.
5. **Welcome first (Mert, 2026-10-01):** R5's resume-on-launch is replaced: Welcome is always the
   first screen, and "Meet your pet" continues a pet in progress from Look with its choices kept.
