# Pet looks v3: a living pet — research

> **Raised:** 2026-10-09, by Mert: "the complete update and enhancement of the pet looks ... more
> realistic, dynamic and eye catching ... like My Talking Tom ... 3D, or first 2.5D".
> **Decided 2026-10-09:** alive and soft, not realistic; no 3D artist, so options A (the living
> SVG pet) then B (2.5D in Skia). Rive and 3D are later. What gets built:
> [requirements](v3-pet-looks-requirements.md) and [plan](v3-pet-looks-plan.md). Skia's edge
> cases and cost are in [section 10](#10-skia-what-to-know-before-choosing-it).

## 1. What we have today

| Layer     | Where                                                         | What it does                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog   | `packages/contract/src/v1/appearance.ts`                      | Species plus nine attributes (fur, pattern, accent, white, trim, eyes, ears, body, tail). About 36 million combinations per species, many alike. Stable ids, validated on the server, some Plus.                                                     |
| Shapes    | `packages/brand/src/pet.ts` → `petDrawing.ts`                 | Pure functions: an appearance becomes an ordered list of ellipses, circles, polygons and paths in a 200-unit box. Markings are clipped to the body and head; a cream sticker edge goes round everything. The website's `PetSvg` draws the same list. |
| Renderer  | `apps/mobile/components/pet/PetArt.tsx`                       | `react-native-svg`, one flat fill per part. A mood change crossfades the face. Only the eyes animate (blink, look).                                                                                                                                  |
| Motion    | `PetStage.tsx`, `RiseAndBreathe.tsx`                          | The whole pet moves as one rigid view: translate (breath, hop, slump), rotate (lean, purr), scale (squash, stretch). Idle moves by mood: hop, sway, stretch, look around, yawn, sigh, a glance at the care button it wants.                          |
| Touch     | `PetStage.tsx`                                                | A tap anywhere squishes it and says hello; a drag is a stroke: the eyes follow the finger, it leans, then purrs with a run of haptic ticks.                                                                                                          |
| Reactions | `usePetReactions.ts`, `ReactionBursts.tsx`, `CareEffects.tsx` | Hearts, treats, stars and z's float up; a happy face for a moment; need chips.                                                                                                                                                                       |
| Voice     | `lib/petVoice.ts`, `server/voice/provider.ts`                 | Inworld TTS on fal, played at 1.15×. `usePetGaze` makes the eyes glance while it speaks. The mouth does not move. Meow, purr and bark sounds.                                                                                                        |
| Photo     | `server/photo/`                                               | Gemini 2.5 Flash reads a photo into catalog ids (closed lists), the nearest free option where it found a Plus one.                                                                                                                                   |

The pet is drawn in about 30 places in 25 files, from a friend row's small avatar to the 260 pt
Home stage. The builder draws a grid of tiles at once.

**Why it reads as a 2D sticker, precisely:**

1. **Rigid.** Only the eyes move on their own. No tail, ears, head, mouth or paws. Secondary
   motion (the tail lagging behind a hop, an ear flicking) is most of what makes an animal feel
   alive.
2. **Flat.** One colour per part: no light, no volume, no fur.
3. **One pose.** Front-facing and standing. It can't turn its head, sit, lie down, curl up asleep,
   eat or walk.
4. **A still mouth.** It talks with its mouth shut. In an app whose pet speaks, this is the most
   visible gap.
5. **One skull.** Every cat and every dog has the same round head: no snout length, face shape or
   fur length, which is what makes a breed, and someone's own pet, recognisable.
6. **One reaction per gesture.** A tap on the head and a tap on the tail do the same thing.

## 2. The market: what "feels real" is

- **My Talking Tom** (Outfit7): Unity, full 3D, almost 1,000 animations kept to 10–15 MB. Its
  pull is reaction density: every place you touch (head, belly, tail, feet, a poke) has its own
  reaction, plus the voice. A cartoon, not a realistic cat.
- **Duolingo**: 2D vector characters in Rive whose mouth shapes blend through a state machine in
  time with speech (Video Call). The closest example to Kinpaw: an AI that talks, through a 2D
  character that lip-syncs.
- **Tolan** (Portola): a voice-first AI companion with stylized 3D aliens, sold by subscription,
  popular with young adults: Kinpaw's audience.
- **Pou, Finch**: simple 2D pets that win on the care loop, not on fidelity.

**Takeaway.** None of the winners is realistic. A realistic animal that talks lands in the
uncanny valley, and it would fight Kinpaw's cozy brand. The target is **alive and soft**:
stylized, with volume, reactive, lip-synced. The realism budget goes to motion (secondary
motion, timing), light (volume) and recognisability (your cat's colours and face), not to
individual hairs.

## 3. The options, cheapest first

| Option                  | New native code                           | Art needed                  | Keeps the code-drawn catalog         | Website                    | Effort               |
| ----------------------- | ----------------------------------------- | --------------------------- | ------------------------------------ | -------------------------- | -------------------- |
| A. Living SVG           | None                                      | None (code)                 | Yes                                  | Same shapes                | 1–2 weeks            |
| B. 2.5D in Skia         | Skia (one rebuild)                        | None (code and shaders)     | Yes                                  | CanvasKit, or keeps SVG    | 2–3 weeks            |
| C. Rigged 2D in Rive    | Rive + Nitro Modules (one rebuild)        | An animator, two rigs       | Partly: colours bound, parts swapped | Same `.riv` file           | 3–6 weeks + designer |
| D. Real 3D              | Filament, or three.js on WebGPU (rebuild) | A 3D artist and an animator | Yes, as blend shapes and a shader    | three.js, same `.glb` file | Months               |
| E. Your pet as 3D model | None (a server call)                      | None                        | No: one static mesh per photo        | Same `.glb` file           | Days, but a dead end |

### A. Living SVG: today's renderer, rigged

Split `PetArt` into parts that each move: the head (tilt, nod, a small turn), the ears (twitch,
flatten when sad, perk up at a tap), the tail (wag by mood, swish, curl), the jaw (open with the
voice), the paws (knead while stroked) and the chest (breath). Add soft gradients
(`react-native-svg` has them), cheek blush and a fuzzy silhouette edge.

No native change. The risk is performance: each animated SVG prop goes through the SVG view, so
fps on an older iPhone needs measuring with all parts moving.

### B. 2.5D in Skia

`@shopify/react-native-skia` (Expo SDK 55 bundles 2.4.18; it needs Reanimated 4 and
`react-native-worklets` 0.7, both already in the app). The same parts and catalog, drawn on a GPU
canvas with shaders:

- **Light and volume from the shapes.** The head is a circle, so treat it as a sphere: compute its
  normal per pixel, add soft light, a rim light and shadow where the head meets the body. Flat
  shapes become rounded without any 3D model.
- **Fur and patterns in a shader.** Noise-based tabby and brindle that look painted rather than
  ruled; a fuzzy, tufted outline.
- **A head that turns.** Slide the face across the sphere and shrink the far ear: a convincing
  2.5D turn.
- **Parallax.** Layers at different depths; with `expo-sensors` (native), the pet shifts as the
  phone tilts.

One native rebuild. On the website, Skia runs through CanvasKit (WebAssembly, a few MB), or the
site keeps drawing SVG.

### C. Rigged 2D in Rive: Duolingo's route

A designer builds a cat and a dog with bones and mesh deformation, and a state machine: idle,
moods, talking, reactions and touch zones. Data binding drives the colours (fur, accent, trim,
eyes) and swaps parts (ears, tails, bodies) as nested artboards; a viseme or mouth input does the
lip-sync.

- Runtime: `@rive-app/react-native` 0.5.4 (updated 2026-10-07), built on Nitro Modules; React
  Native 0.78+, iOS 15.1+.
- Price: the editor is free; exporting a file for an app needs a paid plan (Cadet, about $9 a
  month billed yearly). The runtimes are MIT and charge nothing.
- The website plays the same `.riv` file with Rive's web runtime.
- **Risk:** the drawing moves out of code into a binary file a designer owns. Every new option
  becomes design work, and nine patterns must follow the mesh as it deforms.

### D. Real 3D

A stylized, rigged cat and dog (`.glb`), mapped onto the catalog we already have:

| Attribute                         | In 3D                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| Body (tiny … buff)                | Blend shapes on one mesh                                                                          |
| Ears, tail                        | Swappable meshes bound to the same skeleton                                                       |
| Fur, pattern, accent, white, trim | One shader: base colour, a pattern mask (nine masks in one texture) × accent, a white mask × trim |
| Eyes                              | An iris colour                                                                                    |
| Moods, talking                    | Face blend shapes and a jaw                                                                       |

The four-part coat built in v2 maps one-to-one onto that shader. Fur: soft toon shading plus
8–16 "shells" for a fuzzy outline, a mobile budget.

Engines:

- **react-native-filament** (Margelo): Google's Filament on Metal, `.glb` only, an animator for
  skinned meshes. 1.11.0, May 2026. It needs `react-native-worklets-core`, a second worklet
  library beside the one Reanimated uses: to test before choosing.
- **three.js / React Three Fiber on `react-native-wgpu`** (0.5.17): three.js runs; React Three
  Fiber needs a bridge component and manual frame presentation. pmndrs' own native package says
  "do not use yet".
- **expo-gl**: the older OpenGL ES path.
- **Unity as a Library**: Talking Tom's engine; a heavy second toolchain inside the app. Not
  recommended.

Art: Blender. AI tools for a prototype: Meshy and Tripo do image-to-3D and quadruped auto-rigging
(Tripo rigs in about 30 seconds; Meshy has 500+ animation presets). Good enough for a spike, not
for a hero character (topology, face rig, weights). Production needs a 3D artist and an animator:
roughly 20–40 clips per species. The app grows by the models and textures, a few MB.

### E. A 3D model of your own pet

Image-to-3D on fal (Hunyuan3D, Trellis, Tripo: from about $0.02 to $0.50 a model) gives a static,
unrigged mesh with messy topology. A statue of your pet, not a living one. Possible as a keepsake;
not a path for the pet on Home.

## 4. Lip-sync and the voice

- **Now, by loudness.** `expo-audio`, already installed, has `useAudioSampleListener`: PCM frames
  while the voice plays, so loudness can open the jaw. Works with every option above, with no
  native change.
- **Later, by viseme.** Inworld TTS 1.5 returns word timing with phonemes and visemes
  (`timestampType: WORD`). We call Inworld through fal's wrapper; whether fal passes the
  timestamps through is unchecked. They would need dividing by the 1.15 playback rate.
- **For an animal, three or four mouth shapes are enough** (shut, open, wide, a round "o") on
  loudness with a little variation. Human visemes on a cat look uncanny.

## 5. Interactions: Talking Tom's real secret

- **Touch zones**, each with its own reaction: a head pat (eyes close, leans into your hand), a
  chin scratch (head tips up, purrs), a belly rub (wriggles; a cat might "trap" your finger), the
  tail (flicks away, looks back at you), a nose boop (blinks, sneezes), a paw (high five). A long
  press is a hug.
- **The phone itself** (`expo-sensors`, native): shake it and the pet gets dizzy; tilt it and its
  eyes and head follow.
- **Poses:** sit, lie down, curl up asleep at night, eat from a bowl after Feed, chase a toy after
  Play. Options A and B can do a few; C and D can do them all.

Each zone and pose is a new event: registered with the `events` skill before any code.

## 6. Looks the new renderers make cheap

What makes a pet recognisable as "mine":

- **Face shape and snout length.** Dogs from flat to long (pug, labrador, collie); cats round or
  wedge-shaped.
- **Fur length:** short, medium, long, fluffy (Maine Coon, Persian, Pomeranian).
- **True colour from the photo:** the photo's own fur, marking and eye colours, not only the
  nearest of nine. A Plus candidate.
- **Small details:** nose colour, eyebrow dots (Rottweiler, Doberman), a muzzle mask, cheek fluff,
  whiskers.
- **Breeds as ready-made looks:** Siamese, Maine Coon, Persian, British Shorthair; Corgi, Shiba,
  Husky, Pug, Dachshund, Golden.
- **Accessories:** collar, bandana, bow, glasses, hats. Already a roadmap candidate, and a Plus
  driver.

**Contract edge case.** `appearanceSchema` is `.strict()`, and the app reads a saved pet with it
(`petSchema`). A new key sent to an older app build fails to parse. Harmless on localhost; at
launch, the app must understand a new attribute before the server sends it, or the schema must
tolerate keys it doesn't know (docs/rules/mobile-data.md: `v1` never changes shape).

## 7. The photo, better

- **Any option, now:** ask the vision model for colours as well as ids (fur, markings, eyes), and
  for face shape and fur length once those exist. The ids still pick the catalog option; the
  colour is kept as the pet's "true colour". That is the "that's my cat" moment.
- **With 3D, later:** paint a coat texture from the photo onto the model. Research, not a plan.

## 8. Constraints from this repo

- **Every native module means a native rebuild**, and a rebuild can undo the free-account signing
  fix ([xcode-free-account-signing](../../memory/xcode-free-account-signing.md)). Put all native
  additions (Skia, sensors, Rive or a 3D engine) into one rebuild.
- **Two tiers of drawing.** The builder grid, friend rows and portraits draw many pets at once.
  Keep a cheap still renderer (today's SVG, or a cached snapshot) for those, and the rich one only
  where one pet is the hero: Home, Meet, the builder's preview, Welcome's centre pet.
- **Reduce Motion holds still; VoiceOver keeps its labels** (`describeAppearance`).
- **Events first** for zones, poses and new attributes.
- **No hex in app code:** shader colours come from `@app/brand`.
- **The website draws the same pet** (`PetSvg`, `LivePet`): each option has to say what the site
  does.
- **Performance:** Home already animates `SkyScene`. Measure on the oldest iPhone we support.
- **Tests:** `petParts` and `petDrawing` are unit-tested. With a `.riv` or `.glb`, the tests move
  to "every attribute maps to a rig input".

## 9. Recommendation: a ladder, one rung at a time

**The key decision is the architecture, not the renderer.** Build a renderer-agnostic rig: a
`PetPose` of shared values (head tilt and turn, each ear, the tail, the jaw, eye openness, where
it looks, breath, squash, the current pose) driven by one behaviour controller (moods, idle
moves, touch zones, the voice). Today's SVG reads the pose first; Skia, Rive or 3D read the same
pose later. The behaviour work is never thrown away.

1. **Step 1 (v3.0, 1–2 weeks, no native change).** The living rig in SVG: tail, ears, head, a
   mouth that moves with the voice, touch zones, gradients and blush. Measured by taps and strokes
   per session and time on Home.
2. **Step 2 (2–3 weeks, one native rebuild).** A Skia 2.5D renderer for the hero pet: light and
   volume, fur, a head that turns, tilt parallax. New looks: snout, fur length, true colour from
   the photo.
3. **Step 3 (one-week spikes, then decide).** A Rive rig against 3D (Filament or three.js, with an
   AI-generated, auto-rigged cat), side by side with Step 2, judged on looks, fps on an older
   iPhone, app size, art cost, and whether the catalog survives.
4. **Step 4.** The winner, with poses: sit, sleep curled up, eat, play.

## 10. Skia: what to know before choosing it

**What it is.** `@shopify/react-native-skia` puts Skia, the 2D graphics engine that draws
Chrome, Android and Flutter, into React Native. You draw in a `<Canvas>` with components that
look like SVG's (`<Circle>`, `<Path>`, `<Group transform>`), and on iOS it draws with Metal, on
the GPU. Two things SVG can't do make it worth it here:

- **Shaders.** Small GPU programs, written in SkSL (close to GLSL), that colour every pixel of a
  shape. That is how a flat circle gets light, a rim and fur. The shader is a string in our
  JavaScript, so once Skia is in the build, a new or tuned shader ships like any other JS
  change.
- **Animation without React.** A Reanimated shared value can be passed straight to a Skia prop.
  Every frame is drawn on the UI thread, with no React render and no bridge. Today each animated
  SVG prop goes through `react-native-svg`, which redraws its whole view when one prop changes.

Moving from `react-native-svg` to Skia is mostly mechanical: the shapes are already plain data in
`@app/brand` (`petDrawing`), so a Skia renderer is another short loop over the same list, as the
website's `PetSvg` is. What's new to learn is the shaders; the agent writes those, explains them,
and Mert checks the result by eye.

### Edge cases

| #   | Edge case                                | What happens                                                                                                                                                           | What we do                                                                                                                                                                                 |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | It is native code                        | The first install needs a native rebuild, which can undo the free-account signing fix. After that, Skia drawing and shader changes are JS and could ship over the air. | One rebuild, with everything native at once (Skia, and `expo-sensors` if tilt is agreed). Redo the signing fix ([xcode-free-account-signing](../../memory/xcode-free-account-signing.md)). |
| 2   | Version                                  | npm's latest is 2.14; Expo SDK 55 is tested with 2.4.18.                                                                                                               | Install with `npx expo install`, which picks the SDK's version. Upgrade with the SDK.                                                                                                      |
| 3   | App size                                 | About +6 MB on iOS (Skia's own figure).                                                                                                                                | Accepted.                                                                                                                                                                                  |
| 4   | Many canvases                            | Each `<Canvas>` is its own GPU surface. A builder grid of 20 canvases costs memory and time.                                                                           | Two tiers: Skia only for the one hero pet on a screen; tiles, rows and portraits stay SVG.                                                                                                 |
| 5   | A shader with a mistake                  | `RuntimeEffect.Make` returns null: no crash, nothing drawn.                                                                                                            | Compile shaders once, at module load; a Jest test compiles every shader (Skia's Jest setup runs real Skia in Node); a failed shader falls back to the SVG pet. Never a blank stage.        |
| 6   | First-frame hitch                        | The GPU compiles a shader the first time it is drawn.                                                                                                                  | Compile early; measure on the iPhone; warm up off screen if it shows.                                                                                                                      |
| 7   | Tests                                    | Jest needs Skia's own setup (`jestEnv`, `jestSetup`); today's tests mock `react-native-svg`.                                                                           | Add the setup for the Skia files only. The shapes stay unit-tested in `@app/brand`.                                                                                                        |
| 8   | Touch                                    | A canvas has no per-shape touch.                                                                                                                                       | Already how we do it: the gesture is on the wrapping view, and a pure function maps a point to a zone (head, belly, tail…). Same for SVG and Skia.                                         |
| 9   | VoiceOver                                | A canvas's content isn't readable.                                                                                                                                     | The label and actions stay on the wrapping view, as today.                                                                                                                                 |
| 10  | Colours                                  | A mobile test fails on any hex literal in app code.                                                                                                                    | Shaders take colours as uniforms from `@app/brand`; no colour is written in a shader.                                                                                                      |
| 11  | Battery and heat                         | A breathing pet redraws 60 times a second.                                                                                                                             | Stop drawing when Home isn't visible (another tab, the app in the background). Measure on the iPhone in a release build.                                                                   |
| 12  | Simulator and dev builds lie about speed | The Simulator uses the Mac's GPU; a dev build runs JS slower.                                                                                                          | Judge looks in the Simulator, speed on the iPhone ([local-checks-and-traps](../../memory/local-checks-and-traps.md), "build vs dev").                                                      |
| 13  | The website                              | Skia on the web needs CanvasKit, 2.9 MB of WebAssembly.                                                                                                                | The site keeps SVG: it gets the motion (same parts and pose), not the light and fur.                                                                                                       |
| 14  | Two renderers to keep in step            | A new part could be drawn in one and forgotten in the other.                                                                                                           | Both loop over `@app/brand`'s parts, so a new part is written once; a test checks both handle every shape kind.                                                                            |
| 15  | Reanimated versions                      | Skia needs Reanimated 4 and `react-native-worklets` 0.7 or later.                                                                                                      | Already ours (4.2.1, 0.7.4).                                                                                                                                                               |

### Development cost

Working days for the agent, plus Mert's checks between phases. The phases are in the
[plan](v3-pet-looks-plan.md).

| Part                  | Phases                                                                                                      | Estimate          |
| --------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------- |
| A. The living SVG pet | Events; the rig (no visible change); tail, ears and head; the mouth on the voice; touch zones; light polish | 7–10 days         |
| B. 2.5D in Skia       | Skia in the build and a spike; the Skia pet; light and volume; fur; head turn and tilt; rollout             | 9–13 days         |
| **Total**             |                                                                                                             | **about 4 weeks** |

The rebuild in B is the riskiest single day (signing). Everything in A ships without one.

## Sources

- [Rive React Native runtime](https://rive.app/docs/runtimes/react-native/react-native),
  [data binding: lists, images and artboards](https://rive.app/blog/data-binding-supercharged-lists-images-and-artboards),
  [Rive's export pricing](https://rive.app/blog/new-pricing),
  [Rive meshes](https://rive.app/blog/intro-to-meshes)
- [Duolingo: character visemes](https://blog.duolingo.com/world-character-visemes)
- [Unity: bringing My Talking Tom Friends 2 to life](https://unity.com/blog/bringing-my-talking-tom-friends-2-to-life)
- [react-native-filament README](https://unpkg.com/react-native-filament@1.11.0/README.md)
- [Shopify: WebGPU and Skia in React Native](https://shopify.engineering/webgpu-skia-web-graphics),
  [pmndrs/native](https://github.com/pmndrs/native)
- [Inworld TTS timestamps](https://docs.inworld.ai/tts/capabilities/timestamps)
- [Tripo rigging API](https://developers.tripo3d.com/en/models/rig),
  [Meshy rigging](https://docs.meshy.ai/en/webapp/guides/3d-model/rigging),
  [fal Hunyuan3D](https://fal.ai/models/fal-ai/hunyuan3d/v2)
- [Shell-textured fur](https://godotshaders.com/shader/fur-grass-with-shell-texturing/)
- [Tolan (Dealroom)](https://dealroom.co/companies/tolan/)
- [React Native Skia installation and app size](https://mintlify.com/shopify/react-native-skia/getting-started/installation)
- Package versions from npm on 2026-10-09; `useAudioSampleListener` checked in the installed
  `expo-audio`; Skia's SDK 55 version from Expo's `bundledNativeModules.json`.
