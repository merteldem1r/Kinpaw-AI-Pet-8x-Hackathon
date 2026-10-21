# Pet looks v3: a living pet — requirements

The first v3 feature. Raised by Mert on 2026-10-09; direction agreed the same day: **alive and
soft**, a stylized animated pet that is more than 2D, not a realistic one. No 3D artist, so this
is built in code: first the pet we draw today, made to move (Part A), then the same pet drawn in
2.5D with Skia (Part B). The research (today's drawing, the market, every option, Skia's edge
cases and cost) is in [`v3-pet-looks-research.md`](v3-pet-looks-research.md); the phases are in
[`v3-pet-looks-plan.md`](v3-pet-looks-plan.md).

## Tracking

The one place to see where this update stands. Each phase's details and its "Done" note are in
the plan.

**Where it stands (end of the 2026-10-12 session).** Part A is done and checked by Mert on his
iPhone, and on `main` (pull requests 22 and 23). Part B is on `feat/v3-pet-looks`, pushed, not
merged, ten commits ahead of `main`:

- **Skia and `expo-sensors` are in the build** (B0), on the iPhone 17 Simulator. The iPhone's
  build is still the old one; a build without Skia keeps drawing the SVG pet.
- **The look is picked: Puppet** (decision 7), from nine finishes over two rounds.
- **The Skia pet is alive** (B1): it reads the same pose as the SVG pet, so it breathes, blinks,
  moves and answers a touch the same way. **Puppet's light is on it** (B2, started).
- **It is behind a dev switch** (R21): on Home, "Dev: SVG / Skia flat / Puppet pet"; and
  "Dev: pet screen" (`cozypet://dev-pet`) shows it without an account, with the frame time.
- Last gates: all green, 1,242 tests.

**The next session starts here, in this order:**

1. **Mert looks at the living Puppet pet** (the dev screen on the Simulator) and says what to
   change. It was picked from still pictures; it has not been judged moving.
2. **B2, what is open** (the plan, B2): shadows that follow the parts when the head tilts or the
   tail swings; the rim's colour from the sky's hour; tuning with Mert; the eight looks at each
   sky phase for him.
3. **B1, what is open:** a mood change crossfades the face, as the SVG pet's does.
4. **Mert's iPhone, after the second evaluation** (about 2026-10-13): `npm run ios -- --device`
   from `apps/mobile` in this workspace, the signing fix, then on the dev screen the frame time
   for SVG and for Puppet, a touch on each zone, and the mouth with a voice.
5. **B3** (a soft outline; no grain with a direction, decision 7), **B4** (head turn and tilt),
   **B5** (rollout on Home and Meet, the switch and the dev screen removed).

Waiting, outside this feature's phases: the website's app screenshots and recording still show
the pet before A5 (Mert, in a session of its own).

| Part                  | Phase                                       | Status                             |
| --------------------- | ------------------------------------------- | ---------------------------------- |
| —                     | Research and spec                           | Done 2026-10-09; agreed by Mert    |
| —                     | 0. Events                                   | Done 2026-10-09                    |
| A. The living SVG pet | A1. The rig (no visible change)             | Done 2026-10-09                    |
|                       | A2. Tail, ears and head move                | Done 2026-10-09                    |
|                       | A3. The mouth moves with the voice          | Done 2026-10-09                    |
|                       | A4. Touch zones and a hug                   | Done 2026-10-09                    |
|                       | A4b. Meet's pet                             | Done 2026-10-09                    |
|                       | A4c. Welcome's pets                         | Done 2026-10-09                    |
|                       | A5. Light polish: shading, blush, whiskers  | Done 2026-10-12                    |
| B. 2.5D in Skia       | B0. Skia in the build, and a spike          | Done on the Simulator; iPhone open |
|                       | B1. The Skia pet, the same as the SVG one   | Built 2026-10-12; Mert's check     |
|                       | B2. Light and volume                        | Started: Puppet's light is in      |
|                       | B3. Fur and a soft outline                  | Not started                        |
|                       | B4. Head turn and tilt                      | Not started                        |
|                       | B5. Rollout                                 | Not started                        |
| Later                 | See [Later](#later-own-spec-when-picked-up) | Not decided                        |

## What is there today

- **Catalog** (`packages/contract/src/v1/appearance.ts`): species and nine attributes, closed id
  lists, Plus flags, eight ready-made looks. Stored as one text column per attribute on `pets`.
- **Shapes** (`packages/brand/src/pet.ts`, `petDrawing.ts`): pure functions from an appearance
  to one ordered list of shapes in a 200-unit box: a sticker edge under everything, then the
  tail, body, ears and head, the markings clipped to the body and head, then the belly, paws,
  muzzle and nose. The face is drawn by each renderer.
- **Renderers**: the app's `PetArt` (`react-native-svg`, animated eyes) and the website's `PetSvg`
  (with `LivePet`, which already wags the tail in CSS).
- **Motion** (`PetStage`): the whole pet as one rigid view (breath, hop, lean, squash, purr) plus
  the eyes; idle moves by mood; a tap anywhere and a stroke anywhere.
- **Voice**: Inworld on fal, played by `lib/petVoice.ts` (expo-audio) at 1.15×; the mouth never
  moves. `expo-audio` has `useAudioSampleListener` and `setAudioSamplingEnabled` in the
  installed version.
- **Events**: `pet_tapped` and `pet_stroked` (`{ mood }`) exist, sent to PostHog by `track()`.

## Problem

The pet is a flat sticker that moves as one piece. Only its eyes have a life of their own: the
tail, ears, head and mouth never move, it has no light or volume, and it talks with its mouth
shut. Touching its head, its belly or its tail does the same thing. So it reads as a drawing of a
pet rather than a pet, and the core feeling, "someone missed me", has to come from the words
alone.

## Success criteria

- **Mert's check on his iPhone:** the pet looks alive, soft and more than 2D, and the motion feels
  like the pet's own (a cat moves like a cat, a dog like a dog), never mechanical.
- **People touch it more:** more `pet_tapped`, `pet_stroked` and `pet_hugged` per `home_viewed`,
  across more zones. **Finding:** `track()` goes to PostHog only, and PostHog is not set up on
  localhost, so these are not recorded until launch. Until then the judge is Mert's check.
- **Smooth:** Home holds 60 fps on Mert's iPhone in a release build with everything moving at
  once (a hop, the tail, a voice reply).
- **Nothing else changes:** after A1, the app and the website draw exactly today's pets at rest.

## Requirements

### Part A: the living SVG pet

R1. **One pose, one behaviour.** Each pet on Home has one set of animated values (its pose):
breath, hop, lean, squash, head tilt and nod, each ear, the tail, the jaw, the eyes (open, look),
the paws and a blush. One behaviour controller sets them (mood, idle moves, touch, the voice, the
mic). A renderer only reads the pose, so a later renderer (Skia) reuses all of the behaviour.

R2. **A drawing in parts.** `@app/brand` splits the drawing into parts that can move on their
own, each with its pivot: the tail, the body (with the belly and paws), the head (with the
muzzle, nose and face), and each ear. At rest the app and the website draw exactly what they draw
today: the sticker edge still runs under every part, and markings on the head move with the head.

R3. **The tail moves the way the species does, never nonstop.** A calm motion, and now and then
a burst (changed 2026-10-09 after Mert's check: a fast wag all the time looked wrong). A dog: a
slow sway, with bursts of quick wags every few seconds when happy and now and then when content;
low and still when sad, still when sleepy. A cat: a slow swish when content with a flick now and
then, held up when happy with the tip quivering in bursts; low when sad, still when sleepy. A tap
starts a burst. A bobtail moves less.

R4. **The ears are alive.** Now and then (every 4 to 10 seconds, never during a move) one ear
twitches. Both perk up when the pet is tapped and while the mic is held, and sit a little back
when it is sad. Floppy dog ears lag behind a hop and swing as it lands.

R5. **The head listens and talks.** While the mic is held, the head tilts and the ears perk up:
the pet is listening. While it speaks, the head nods a little. When its eyes look to one side, the
face moves a unit or two the same way, a first hint of depth.

R6. **The mouth moves with the voice.** While the pet speaks, its mouth opens with the voice's
loudness (from the audio player's samples). If the player gives no samples, the mouth chatters in
a natural rhythm for as long as it speaks. It opens briefly for a meow, a purr's start or a bark,
and shuts the moment the voice stops (the mic is pressed, the pet leaves Home). Three or four
mouth shapes, not human visemes. Every mood has a mouth line (today only happy has one).

R7. **Touch zones.** A point on the pet maps to a zone (a pure, tested function of the rest
shapes), and each answers in its own way, with a haptic and a line where one fits:

| Zone        | Tap                                            | Stroke                       |
| ----------- | ---------------------------------------------- | ---------------------------- |
| Head        | Eyes close happily, ears back, leans into you  | Leans in and purrs (today's) |
| Chin        | Head tips up, eyes half closed, purrs          | The same, longer             |
| Nose        | A blink and a little sneeze                    | —                            |
| Ear         | That ear flicks                                | —                            |
| Belly       | A wriggle and a giggle                         | A belly rub: a happy wriggle |
| Paw         | A paw lifts: a high five                       | —                            |
| Tail        | The tail flicks away, the pet looks back at it | —                            |
| Back, flank | A small hop (today's tap)                      | Arches into the stroke       |

A hold (about 600 ms) anywhere is a hug: the pet squeezes into it, eyes shut, hearts.

R8. **Light polish, app and website.** Soft gradients on the head and body made from each fur's
own colours (mixed in `@app/brand`, no new hex), a blush on the cheeks that deepens when happy or
stroked, whiskers on cats, a little cheek fluff. Small pets (tiles, rows) get it too: it is static.

R9. **Reduce Motion.** No idle motion, no tail or ears moving by themselves, no hops. A touch
still answers with its face, its haptic and its line. The mouth still moves while the pet speaks
(decision 3).

R10. **VoiceOver.** The label stays (`describeAppearance` or "Mochi, happy"). Actions: Stroke
(today's), Pat head, Scratch chin, Rub belly, Hug.

R11. **Performance first: only the hero pet moves** (Mert, 2026-10-09: "no unnecessary renders on
other pages"). The rigged, moving pet is on Home and Meet, and, since decision 6, Welcome's three
pets. Builder tiles, the builder's
preview, friend rows, portraits and the website's small pets are still drawings, with no timers
and no animated values. Home's pet stops every loop and timer while Home isn't visible (another
tab or a screen pushed over it) or the app is in the background, and picks up where it was when
it comes back. A still pet is redrawn only when its appearance or mood changes (`PetArt`'s
memo).

R12. **60 fps** on Mert's iPhone in a release build with every part moving. If the SVG renderer
can't hold it, Part B's Skia renderer moves forward rather than the motion being cut.

### Part B: 2.5D in Skia

R13. **A Skia pet for the hero.** `PetCanvas` draws the same `@app/brand` parts and reads the
same pose as the SVG pet. It replaces `PetArt` on Home and Meet only (decided 2026-10-09);
everywhere else stays SVG. At rest, without light, it matches the SVG pet's shapes.

R14. **Light and volume.** The head and body look round: a soft key light from the top left, a
shade at the bottom, a rim light tinted by the sky's time of day (warm in the evening, cool at
night), a soft shadow where the head meets the body, and a soft contact shadow. Markings and white
patches get the same light.

R15. **Fur.** A soft fur texture on the coat and a fuzzy, slightly tufted outline instead of a
hard edge. Subtle: cozy, not hairy.

R16. **A head that turns.** When the pet looks to one side, its face slides across the head as if
the head were round, and the far ear tucks behind. Up to about 25 degrees, never a profile.

R17. **Tilt** (decision 5). Tilting the phone shifts the pet's layers a few points against the
sky, and its eyes follow. `expo-sensors`, in the same native rebuild as Skia.

R18. **Never a blank stage.** If Skia isn't in the build or a shader fails to compile, the pet is
drawn by the SVG renderer.

R19. **Colours from `@app/brand` only**, passed to shaders as uniforms; the no-hex test passes.

R20. **Drawing pauses** when Home isn't visible, as in R11: a Skia canvas that isn't seen draws
nothing. One canvas per screen at most.

R21. **Side by side until approved.** A dev-only switch shows the SVG or the Skia pet on Home, so
Mert can compare on his iPhone; it goes once he picks.

## Events

Mobile only; `track()` sends to PostHog. No money moment, no lifecycle change, nothing
first-party (these are cosmetic: no need changes). Registered in `apps/mobile/lib/analytics.ts`
in Phase 0, before any UI fires them.

| Event         | New or changed        | Metadata                                                                                      | Fired when                                     |
| ------------- | --------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `pet_tapped`  | Changed: gains `zone` | `{ mood, zone: 'head' \| 'chin' \| 'nose' \| 'ear' \| 'belly' \| 'paw' \| 'tail' \| 'back' }` | A tap on the pet on Home                       |
| `pet_stroked` | Changed: gains `zone` | `{ mood, zone: 'head' \| 'chin' \| 'belly' \| 'back' }`                                       | A stroke long enough to count, once per stroke |
| `pet_hugged`  | New                   | `{ mood }`                                                                                    | A hold on the pet on Home                      |

- **The aha:** a person touches the pet more than once in a Home visit, in more than one zone.
- **The drop-off:** `home_viewed` with no `pet_tapped`, `pet_stroked` or `pet_hugged` (touch never
  found).
- **Discriminator:** `zone`. PostHog keeps every event, so no server dedupe list changes.
- Part B adds no events: the renderer is not something a person does.

Meet's pet (A4b) has one event of its own, so the Home numbers above stay Home's:

| Event              | New or changed | Metadata                                                                                             | Fired when                                     |
| ------------------ | -------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `pet_meet_touched` | New            | `{ kind: 'tap' \| 'stroke' \| 'hug', zone }` (`zone` as above for a tap or a stroke, none for a hug) | A tap, a stroke (once) or a hold on Meet's pet |

Its aha: a touch on the pet before taking it home. Its drop-off: `pet_meet_viewed` with no
`pet_meet_touched`. It answers whether people who touch the pet go on to `pet_meet_continued`.

Welcome's pets (A4c) have one too:

| Event                 | New or changed | Metadata                                                                                        | Fired when                                          |
| --------------------- | -------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `welcome_pet_touched` | New            | `{ pet: 'tuxedo' \| 'ginger' \| 'biscuit', kind: 'tap' \| 'stroke' \| 'hug', zone }` (as above) | A tap, a stroke (once) or a hold on one of the pets |

Its aha: a touch on a pet before "Meet your pet". Its drop-off: `welcome_viewed` with no
`welcome_pet_touched` (the first screen read as a picture). It answers whether people who touch a
pet go on to `welcome_start_tapped`. Discriminators: `pet`, `kind`.

## Out of scope (this spec)

- New look attributes (snout length, fur length, true colours), breeds, accessories: Later.
- Poses (sit, lie down, curl up asleep, eat, play) and walking across the room: Later.
- Lip-sync by viseme from Inworld's timestamps: Later; loudness is enough for an animal.
- Shaking the phone; Skia on the website; Rive; real 3D.
- Any change to `appearanceSchema`, the `pets` table, Plus or the photo read: this spec changes
  how a pet moves and is lit, not what it is. No migration, nothing load-bearing.

## Later (own spec when picked up)

Kept here so the whole update is tracked in one place.

1. **New looks** the 2.5D pet makes cheap: face shape and snout length (pug to collie), fur
   length (short to fluffy), nose colour, eyebrow dots, cheek fluff as an option. Each new
   attribute is a `pets` column (a migration) and a contract change; `appearanceSchema` is
   strict, so an older app must understand a key before the server sends it.
2. **True colour from the photo:** the photo read also returns the fur, marking and eye colours;
   the pet keeps them beside the catalog ids. A Plus candidate (then load-bearing: the server
   decides).
3. **Breeds as ready-made looks:** Siamese, Maine Coon, Persian, British Shorthair; Corgi, Shiba,
   Husky, Pug, Dachshund, Golden.
4. **Poses and places:** sit, lie down, curl up asleep at night, eat from a bowl after Feed, chase
   a toy after Play, walk across the room.
5. **Accessories:** collar, bandana, bow, glasses, hats (a roadmap candidate; a Plus driver).
6. **Lip-sync by viseme**, if loudness isn't enough: check whether fal's Inworld endpoint returns
   timestamps; divide them by the 1.15 playback rate.
7. **Rive or 3D**, if an artist joins: a one-week spike each, judged against the Skia pet.

## Decisions

Agreed with Mert on 2026-10-09:

1. **Part A first, Skia afterwards.** A1 to A3 can be in the demo for the second evaluation
   (about 2026-10-13); Part B, with its native rebuild, comes after it.
2. **Bigger eyes: yes.** Tried in A5 as a before and after, on the app and the website; kept
   (Mert, 2026-10-12).
3. **The mouth keeps moving under Reduce Motion.** Everything else holds still (R9).
4. **The rich pet on Home and Meet only, performance first** (R11, R13, R20).
5. **Tilt with `expo-sensors`: yes**, in the same rebuild as Skia (B0, used in B4).
6. **Welcome's three pets are alive too** (Mert, 2026-10-09, later the same day: "this is the
   first page where the user sees the application, it's important to make a good impression").
   It widens decision 4 for the SVG pet: all three move, each answers a touch as on Meet, the
   cat's mouth moves as each of its lines appears and the two beside it look at it, without
   sound. They stay SVG in Part B (R13: Skia on Home and Meet). Three living pets and the sky
   are the heaviest screen yet: if the iPhone can't hold 60 fps there, the side pets lose their
   idle moves before the centre cat loses anything (R12).

Agreed with Mert on 2026-10-12, in Part B:

7. **The 2.5D look is Puppet: a soft toy, not fur.** Mert's words for what he wants: "the
   feeling of a plush toy, something softy and sweet", and "most close to 3D with the
   separations of body, transitions on shadow". The first spike's fur, fine streaks down the
   coat, he rejected as "some kind of woody layer on top of the pet": no grain with a direction,
   ever. Of six finishes he kept Felt and Storybook; of three more built on them he picked
   Puppet: matte with a fine speckle, each part a soft solid that shadows the next. This
   replaces R15's "fur texture": B3 is a soft outline, nothing hairy.
8. **Each shape is lit by its own shader, not the pet as one layer** (decided by Claude from the
   spike, B0): it is crisp with no extra layer, and it can be drawn and tested without a
   device. A layer costs density × density pixels a point and can't be drawn by CanvasKit.
9. **No motion permission.** The tilt (B4) reads the accelerometer, which needs none;
   `expo-sensors` is added with `motionPermission: false`, so the app can never ask.

## Open questions

- **Puppet, moving:** Mert picked it from still pictures. Whether its numbers hold on the living
  pet, at Home's size, on the iPhone, is his to say (next session, step 1).
- **The frame time on the iPhone** with every shape's own shader: not measured yet (R12). If it
  is short of 60 fps, the first things to give up are the soft edges (a blur on every shape),
  then the tufts.
