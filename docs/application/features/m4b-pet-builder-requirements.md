# M4b: The pet builder — requirements

> Added between M4 and M5 (Mert, 2026-10-01). Inputs: [product.md](../product.md) ("The pet":
> every pet is built from six attributes), the [screen spec](../UI/kinpaw-screen-spec-v1.md)
> (Pet art contract, Create · Start, Choose a friend, Make your own, Name, Events), the canvas
> exports `Create · Start`, `Create · Choose a friend (cat|dog)`, `Create · Make your own
(cat|dog)` in `../UI/screens/`, and the designer's code drop in
> [`../UI/kinpaw-pet-builder/`](../UI/kinpaw-pet-builder/README.md). Plan:
> [m4b-pet-builder-plan.md](m4b-pet-builder-plan.md). Written 2026-10-01.
>
> **Status: built and checked by Mert on 2026-10-01** (see [Decisions](#decisions)). Built step by step;
> each phase is confirmed with Mert before the next.

## Problem

A pet is one of eight fixed looks, drawn from 32 PNG files (8 looks × 4 moods). Nobody can make
a pet that is their own, and every new look or mood means new image files. The builder makes
every pet from species plus six attributes, drawn in code in any mood, and lets the person
either pick a ready-made friend or make their own.

## What is there today (research)

- **The code drop** is good and typechecked: `pets.ts` (types, the six attributes and their
  options, the illustration palette, the eight ready-made looks, name ideas, helpers, and the
  `petParts()` geometry) and `PetArt.tsx` (draws a pet with `react-native-svg`, no hex). The
  ready-made looks keep today's ids (`ginger` … `merle`), so every saved pet maps to one.
- **The catalog lives in `@app/contract`** (`src/v1/pets.ts`: `LOOKS`, `lookById`,
  `isPremiumLook`, `looksFor`, `DEFAULT_LOOK`), because the server validates saved pets with
  it. The designer's file puts it all in `packages/brand`; brand is for colours. So it is split
  (Decision 1). Two names clash: the designer's `PET_PRESETS` / `presetById` mean ready-made
  looks, while ours mean personality presets (`cuddly` …). The ready-made looks stay `LOOKS`.
- **Storage:** `pets.look` (text, not null) holds the look id. `GET`/`POST /api/app/v1/pet`
  send `look_id`; the premium check is `isPremiumLook(look_id)`.
- **The draft** (`lib/petDraft.ts`, key `kinpaw:petDraft:v1`) stores `looks: { cat, dog }` and
  `step: look | name | personality | meet`. A draft already on a phone must keep working.
- **Drawing:** `PetImage` + `lib/petArt.ts` (32 `require`d PNGs in `assets/pets/`) on Welcome
  (`app/index.tsx`), Look (`LookCard`), Name, Meet, Save (`login.tsx`) and Profile
  (`PetPortrait`, a head crop). `PetArt` has no head crop yet.
- **Not built:** Start, Make your own, name ideas; none of the seven new events is registered.
- **The spec names the Create routes `app/(onboarding)`**; ours are `app/(create)/`. The spec's
  `preset_id` means a ready-made look id; here it is `look_id`, so it never reads as the
  personality `preset`.

## Success criteria

- Every pet on every screen is drawn by `PetArt`, in the right mood, and the PNGs are gone.
- A person can take a ready-made friend, customize one, or build their own, and the saved pet
  looks the same on the next phone.
- A Plus option can't be saved without Plus, whatever the app sends.
- **Measured by:** `pet_create_path_selected` (`choose` vs `build`) and `pet_created` with
  `look_id` (or `custom`), so we can see how many people make their own.

## Requirements

**Foundation (Step A: no new screens)**

R1. The appearance catalog is in `@app/contract` (`src/v1/appearance.ts`): species, the six
attributes and their options (id, label, Plus or not), the ready-made looks, `appearanceSchema`
(Zod, replaces `parseAppearance`), and the helpers (`optionsFor`, `withSpecies`, `withAttribute`,
`randomAppearance`, `usesPremium`, `premiumOptionsIn`, `matchLook`, `appearanceKey`,
`nameIdeas`, `describeAppearance`). No colour in it.

R2. The pet colours (the coats, eye colours and face and edge colours) are in `@app/brand`
(`art.pet`, beside `art.sky`); every hex lives there. The shapes are beside them in
`packages/brand/src/pet.ts` (moved from `apps/mobile/lib/petParts.ts` on 2026-10-01 so the
marketing site draws the same pets; brand imports the contract's types, type-only), and the
typecheck fails if brand lacks a colour for a fur or eye id.

R3. `PetArt` (`apps/mobile/components/pet/PetArt.tsx`) draws any appearance in any mood, with
its contact shadow in the scheme's shadow tint, and takes the same props as `PetImage` (`mood`,
`size`, `label`, `shadow`, `style`). A mood change crossfades over `base`, or swaps at once
under reduced motion. It is decorative unless given a `label` (`describeAppearance` before the
pet has a name). A head crop (Profile, later the Talk header) positions it by `HEAD_CENTRE`, as
`PetPortrait` does today.

R4. `pets` stores the appearance as six text columns, `fur`, `pattern`, `eyes`, `ears`, `body`
and `tail`, beside `species`. `look` becomes nullable: the ready-made look it came from, or null
for a pet built or customized. Existing pets are filled in from their `look`, so nothing is
lost (Decision 3).

R5. `GET`/`POST /api/app/v1/pet` send and take `appearance` (species and six ids, validated by
`appearanceSchema`) and `look_id` (nullable). The server refuses a Plus option or a Plus look
from an account without Plus (`usesPremium`, 400), and a `look_id` whose recipe doesn't match the
appearance. (`look_id` becomes nullable: a change to a `v1` shape, acceptable because no store
build calls it.)

R6. The draft stores the appearance per species (`appearances: { cat, dog }`); its ready-made
look is derived from it (`matchLook`), never stored beside it. A draft from before the builder
(`looks: { cat, dog }`) is converted on read under the same key (its looks become their
recipes), never dropped.

R7. `PetImage`, `lib/petArt.ts`, `assets/pets/` and the stand-in SVGs are deleted; every screen
that showed a pet shows `PetArt`.

**Screens (Step C)**

R8. Create · Start, Choose a friend (the Look screen restyled, with Customize), Make your own,
and Name with ideas, exactly as the spec and the canvas show them, including every
interaction, state, accessibility note and line of copy there. The step order becomes
`start | look | build | name | personality | meet`; a relaunch resumes the step that was left.

R9. Plus options and Plus looks during onboarding: not selected, `warning` haptic, the status
line ("Odd-eyed is a Plus option. It comes with Kinpaw Plus."). Never the paywall during
onboarding.

## Events

Step A changes only properties; Step C registers the new events, before the screens.

| Event                            | Change                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| `pet_meet_viewed`, `pet_created` | `look_id` becomes the ready-made look id or `custom`, plus `appearance_key` (Step A) |
| `onboarding_step_viewed`         | `step` gains `start` and `build` (Step C)                                            |
| `pet_create_path_selected`       | New: Start card tapped. `path`: `choose`, `build`; `species`                         |
| `pet_customize_tapped`           | New: Customize on Choose a friend. `look_id`                                         |
| `pet_builder_viewed`             | New: Make your own appears. `from`: `start`, `customize`; `species`                  |
| `pet_attribute_changed`          | New: a free option picked. `attribute`, `option`                                     |
| `pet_option_locked_tapped`       | New: a Plus option tapped. `attribute`, `option`, `during_onboarding`                |
| `pet_surprise_tapped`            | New: Surprise me. `species`                                                          |
| `pet_builder_sky_changed`        | New (2026-10-01): the stage's time of day picked, a preview only. `time_of_day`      |
| `pet_name_idea_tapped`           | New: a name idea tapped. `fur` (never the name)                                      |
| `pet_name_submitted`             | Gains `from_idea`                                                                    |

All in the app's registry (PostHog); `pet_created` stays first-party, from the server. The
**aha** of the builder is a saved pet (`pet_created`, already M4's). The **drop-off** to watch
is Start → Make your own → Name: `pet_builder_viewed` without a later `pet_name_submitted`.
No money moment and no lifecycle change. `appearance_key` and `option` describe a drawing, not
a person, so they are safe properties.

## Out of scope

- Changing a pet's appearance after it is saved (no editor on Profile in v1).
- Opening the paywall from a locked option after onboarding (there is nowhere to build after
  onboarding yet); M7 wires `trigger: locked_option` when there is.
- New attributes or options beyond the designer's list.

## Decisions

Agreed with Mert, 2026-10-01:

1. **Split the code drop:** the catalog and the rules in `@app/contract` (the server needs
   them); colours and geometry in `@app/brand`; the component in the app.
2. **Six text columns** for the appearance, not one JSON column, the same way the traits are
   stored.
3. **Existing pets are filled in from `look`**, with a hand-written, data-preserving migration
   that Mert applies.
4. **Order:** Step A (this foundation), then M5 Home, then Step C (the screens), unless Mert
   moves Step C first.
