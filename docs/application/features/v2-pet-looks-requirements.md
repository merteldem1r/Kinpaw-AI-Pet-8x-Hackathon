# Pet looks v2: more options and a layered coat — requirements

Agreed with Mert on 2026-10-03: three phases (renderer groundwork, more single options, the
layered coat), built and checked one at a time. Photo to pet and coat length (fluffy) are later.
The brainstorm is in [`../ideas.md`](../ideas.md) ("More look options").

## What is there today

- **Catalog** (`packages/contract/src/v1/appearance.ts`): species and six attributes, each a closed
  list of ids with a label and a Plus flag; 8 ready-made looks; `appearanceSchema` (strict Zod),
  `randomAppearance`, `describeAppearance` (the VoiceOver label and the talk prompt's "who you
  are"), `nameIdeas` (by fur), `appearanceKey`.
- **Palette** (`packages/brand/src/art.ts`, `art.pet`): per fur `base`, `shade`, `stripe`, `dark`;
  irises; belly, white, `patchOnCream`.
- **Geometry** (`packages/brand/src/pet.ts`, `petParts`): a pure function from appearance and
  mood to shapes and colours.
- **Two renderers** of those parts, written out by hand: the app's `PetArt.tsx` (with animated
  eyes) and the site's `PetSvg.tsx`.
- **Storage**: `pets` keeps each attribute as text, validated by the route against the catalog,
  so a new option in an existing attribute needs no migration; a new attribute does. The phone's
  pet draft (`lib/petDraft.ts`) is parsed with `appearanceSchema`, and a draft that fails to
  parse is dropped.

What limits it:

1. A coat has one colour. Patterns draw in a shade of the fur; patches are white, except on
   `cream`, where an id check in `petParts` makes them ginger.
2. `socks` (Socks and bib) is a pattern, so stripes _and_ white socks is impossible.
3. Patterns are not clipped to the body; their coordinates are tuned by hand to stay inside.
4. Fur-specific rules are `a.fur === 'cream'` checks, not properties of the fur.
5. Every new kind of shape is written twice, once per renderer.

## Problem

The builder offers few options. Every coat is one colour, so a person can't make a pet that
looks like most real cats and dogs (a tabby with white socks, a calico, a Siamese, a husky). The
coming photo-to-pet feature needs a catalog that can describe a real animal's coat.

## Success criteria

- More looks are possible: from 6 furs × 5 patterns to 9 furs × 9 patterns × 10 marking colours
  × 5 white markings, plus more eyes, ears, tails and bodies.
- Observable: `pet_attribute_changed` shows the new attributes (`accent`, `white`) and options
  being picked, and the share of `pet_created` with `look_id: 'custom'` holds or grows.
- Nothing changes for existing pets: every saved pet and every ready-made look draws exactly as
  before Phase 3.

## Requirements

### Phase 1: renderer groundwork (no visible change)

- **R1.** Each fur's art holds what today depends on its id: its belly colour, the colour of
  white markings and patches on it, and whether it is dark. `petParts` checks no fur id.
- **R2.** Patterns are clipped to the pet's silhouette (body, shoulders, head) with an SVG
  `ClipPath`, in both renderers.
- **R3.** `@app/brand` turns `PetParts` into one ordered display list of plain shapes (ellipse,
  circle, path, polygon, with fill, stroke and an optional clip), in drawing order, with
  the sticker edge. The app's `PetArt` and the site's `PetSvg` each draw that list in a short
  loop. The face (eyes, brows, mouth, tongue) stays in each renderer, because the app animates
  the eyes.
- **R4.** Every ready-made look in every mood draws as before (checked by tests and by eye on
  Choose a friend and Make your own).

### Phase 2: more options (no migration)

- **R5. Fur, +3:** Snow (white), Cinnamon (red-brown), Lilac (blue-grey). Each has its full art
  and name ideas.
- **R6. Eyes, +3:** Hazel, Copper, Ice (pale blue).
- **R7. Ears, +2 each:** cat Folded (Scottish fold), Lynx (long tufts); dog Rose (folded back),
  Bat (large and upright). Ear ids stay unique across species.
- **R8. Tail, +2:** Bobtail (short), Plume (a full curl over the back). **Body, +1:** Tiny
  (kitten- or puppy-sized).
- **R9.** Every new option draws in every mood and every combination, with no shape outside
  the 200 × 200 view, and reads in `describeAppearance`.
- **R10.** Saved pets and drafts are unchanged; old ids keep their meaning.

### Phase 3: the layered coat

- **R11.** The coat is four attributes:
  - `fur`: the base colour.
  - `pattern`: where the markings go. Solid, Stripes, Spots, Patches, plus Tabby (classic
    swirls), Tortie (mottled), Points (darker face, ears, paws and tail, as a Siamese), Saddle
    (a back saddle for dogs, tan points), Brindle (fine streaks).
  - `accent`, new: the markings' colour. `auto` (each pattern's colour today: a darker shade of
    the fur for stripes and spots, white for patches, ginger on cream) or any fur colour.
  - `white`, new: white markings. None, Mittens (paws), Socks and bib (today's `socks`, drawn
    identically), Bicolour (white lower half and chest), Van (mostly white, colour on the head
    and tail).
- **R12.** Today's `socks` pattern becomes `white: 'socks'` with `pattern: 'solid'`. The id
  `socks` keeps its meaning and drawing; only its attribute moves. Saved pets are converted on
  the database (`run-once.sql`) and, as a safety net, on read: an appearance with
  `pattern: 'socks'` parses to the new form. A draft on the phone parses too, so no draft is
  dropped.
- **R13.** `accent` defaults to `auto` and `white` to `none`, so an appearance sent without them
  (an old draft, an old client) is still valid.
- **R14.** The 8 ready-made looks are written in the new form and draw as before; `matchLook`
  still finds them for saved pets.
- **R15.** Builder: still six tabs. Fur and Pattern each hold two attributes; a small switch
  at the top of the options card picks the row (Main colour | Marking colour; Pattern | White
  markings). **Changed 2026-10-03, while building:** a switch, not two stacked rows, because
  two rows of preview tiles pushed Continue off the screen. On a Solid coat the Marking colour
  row says "Solid has no markings. Pick a pattern to see this colour." Matching shows as a split
  swatch: the coat beside the colour its markings take.
- **R16.** Plus (agreed 2026-10-03): Patches and Spots stay Plus (Calico and Blue
  merle are built from them); Tortie, Points, Brindle and Van are Plus; every accent is free.
- **R17.** `describeAppearance` names the full coat, e.g. "A ginger tabby cat with white socks
  and green eyes", so VoiceOver and the talk prompt know it. Its signature is unchanged.
- **R18.** The server validates `accent` and `white` like every other attribute, refuses Plus
  options from a free account (`refusePlusOptionsUnlessPremium`), and stores both. Change look
  writes them.

### Phase 4: a colour for the paws and chest (added 2026-10-03)

Mert asked for the white markings in other colours; agreed the same day (see "Decisions").

- **R19.** A new attribute, `trim`: the colour of the white markings. `white` (the default) or
  any fur colour but Snow (too close to white). Every colour is free. A pet without it (saved,
  drafted or sent before) reads as `white`, so it looks as before.
- **R20.** It colours everything the white markings cover: the paws (Mittens and up), the belly
  and muzzle (Socks and bib and up), the lower body (Bicolour) and the body (Van).
- **R21.** A dark colour on the muzzle keeps the face readable: the mouth line turns to the light
  ink and a dog's nose to the pink nose, as a dark coat's face lines already do.
- **R22.** The white markings are called **Paws & chest** in the builder. The Fur tab holds the
  colours (Main | Pattern | Paws & chest), the Pattern tab the shapes (Pattern | Paws & chest).
  With no paws & chest markings, the colour row says "No paws & chest markings. Pick some under
  Pattern."
- **R23.** `describeAppearance` names the colour ("golden socks", "a cream chest and belly"). The
  server stores and validates `trim` like the rest; Change look writes it.

## Events

No new event names. Changes to existing events, registered with the `events` skill before
Phase 3's builder change:

| Event (app)                                  | Change                                                                                                          |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pet_attribute_changed` (mobile, PostHog)    | `attribute` gains `'accent'` and `'white'` (Phase 3), then `'trim'` (Phase 4); `option` gains the new ids       |
| `pet_option_locked_tapped` (mobile, PostHog) | the same new `attribute` and `option` values                                                                    |
| `pet_created` (web, first-party)             | `appearance_key` gains accent and white (Phase 3), then trim (Phase 4); an older key is a prefix of the new one |

Phases 1 and 2 add option ids only, which the discriminators already allow (`option` is any
catalog id).

## Out of scope

- Photo to pet (its own spec, after Phase 3).
- Coat length (Fluffy), accessories (collar, bow, bandana).
- New ready-made looks on Choose a friend (its 4-per-species layout); the new coat makes
  Siamese, Husky, Beagle, Dalmatian easy to add later.
- A colour picker or any colour outside the palette.
- Android.

## Decisions

Answered by Mert on 2026-10-03:

1. **Plus split:** as proposed. In Phase 3, R16. In Phase 2, Lynx ears (the step up from
   Tufted, already Plus) and Ice eyes are Plus; every other new option is free.
2. **New furs:** Snow, Cinnamon, Lilac.
3. **Snow fur with white markings:** drawn, barely visible, as on a real white cat.
4. **A colour for the white markings** (Phase 4, asked 2026-10-03): in the Fur tab as its third
   row; every colour free; the white markings renamed Paws & chest.
