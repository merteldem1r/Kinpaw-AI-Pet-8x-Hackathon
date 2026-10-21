# Pet looks v3: a living pet — plan

Requirements: [`v3-pet-looks-requirements.md`](v3-pet-looks-requirements.md) (with the tracking
table). Research and Skia's edge cases and cost:
[`v3-pet-looks-research.md`](v3-pet-looks-research.md). One phase at a time; each ends with the
gates (`local-review`), a look in the Simulator, Mert's check on his iPhone where it says so, a
suggested commit message, and Mert's go before the next one.

**Where to pick up (2026-10-12):** Part A is done. In Part B, B0 is done on the Simulator, B1 is
built, B2 is started: go to [B2's "Open"](#phase-b2--light-and-volume) and B1's "Not done". The
order for the next session is in the requirements' [Tracking](v3-pet-looks-requirements.md#tracking).

**The order and why.** Events land before the UI that fires them (Phase 0). The rig lands before
anything moves (A1), with no visible change, so every later phase is small. Part A needs no
native rebuild; Part B starts with the one rebuild (B0), so a signing problem shows up on day one
of B, not at the end. A1's pose is what B reads, so none of A's behaviour is thrown away.

## Phase 0 — events

**Files:**

- `apps/mobile/lib/analytics.ts`: the Home group's comment gains `zone` on `pet_tapped` and
  `pet_stroked` (values as in the requirements), and `pet_hugged` (`{ mood }`) with the aha and
  the drop-off from the requirements; `pet_hugged` joins the `EventName` union.

**Verify:** `npm run check:events` (an unfired `pet_hugged` only warns until A4), typecheck.

**Done 2026-10-09.** `zone` documented on `pet_tapped` and `pet_stroked`, `pet_hugged` added;
`check:events` passes (106 mobile events; `pet_hugged` warns as unfired until A4).

## Part A — the living SVG pet

### Phase A1 — the rig (no visible change)

**Done 2026-10-09: looked at by Mert on his iPhone** (no change, as meant). Built as below, with three changes from
the first plan:

1. **No new `petRig.ts`.** `petDrawing` itself now returns the parts (`parts`, `order`), so
   there is one drawing, not a still one and a rigged one. `drawingShapes` lists every shape in
   drawing order, for checks and tests.
2. **The body and the head each draw the whole coat, clipped to their own outline.** A marking
   that crosses the neck moves with both. Where the two outlines meet it is drawn twice, which
   only shows for a see-through marking, so **every marking is opaque**: brindle's streaks, the
   one see-through pattern, are now their colour pre-mixed 60% over the fur (`composite`), which
   looks the same. A test holds the rule. (A cut-out of the head from the body's coat was tried
   first: it left a hairline seam where the two clips met.)
3. **The pose holds only what A2 moves** (the head's tilt and nod, each ear, the tail) beside the
   whole-pet values; the jaw, paws and blush join in the phases that use them.

**Checked:** the website's `PetSvg` for the 128 baseline pets (the eight looks and 120 seeded
random ones, Plus options included) in all four moods, 512 images, rendered to PNG with `sharp`
before and after and compared pixel by pixel with `pngjs`. Seven of nine patterns differ by at
most 8 shades of 255 in at most 26 pixels of 160,000 (edge rounding); spots and tortie by up to 29
shades in a few edge pixels at the neck; brindle's streak colour matches to within one shade, and
only its streak edges round differently. Identical to the eye. Gates green: secrets, template,
typecheck, lint, format, standards, events, env, store, every test suite (1,156 tests) and the
web build.

**Files:**

- `packages/brand/src/petDrawing.ts`: `petDrawing(parts)` returns the drawing as parts, each with
  its pivot in pet space: `tail` (its root), `body` (body, shoulders, its coat, belly, muscles,
  paws; the feet), `head` (head, its coat, muzzle, nose; the neck), `earLeft`, `earRight` (each
  ear on its own, tufts split per ear; its base). `order` puts a cat's ears behind the head and a
  dog's in front. Each part's `edge` (the sticker edge) is apart from its `fill`, so a renderer
  draws every part's edge first, under every fill, each moved with its part.
- `packages/brand/src/pet.ts`: brindle's streaks pre-mixed, opaque.
- `packages/brand/__tests__/petDrawing.test.ts`: the tests on the parts (order, pivots, each ear
  on its own side, the coat on the body and the head, every marking opaque).
- `apps/mobile/lib/petPose.ts` (new): the `PetPose` type and `usePetPose()`; `turnAbout` and
  `compose`, the matrix arithmetic, as worklets. `EyeMotion` is part of it.
- `apps/mobile/hooks/usePetBehaviour.ts` (new): breathing, blinks, glances, idle moves, the
  bubble glance and cues, moved out of `PetStage.tsx` unchanged, and the pause (R11): every loop
  and timer stops while Home isn't the screen shown or the app is in the background
  (`hooks/useAppActive.ts`, new), and starts again when it is back.
- `apps/mobile/components/pet/PetArt.tsx`: a `pose` prop in place of `eyes`; with one, the head,
  ears and tail are groups moved by their native `matrix` on the UI thread (the ears by the
  head's turn and their own); without one, plain groups, nothing animated.
- `apps/mobile/components/pet/PetStage.tsx`: gestures and layout only; it takes `active`.
- `apps/mobile/components/home/HomeRoom.tsx`, `app/(tabs)/index.tsx`: pass Home's `focused`.
- `apps/web/src/components/pet/PetSvg.tsx`: draws the parts (still); the tail's two groups keep
  the `pet-tail` class `LivePet`'s CSS wags.
- `apps/mobile/__tests__/petPose.test.ts` (new), `petArt.test.tsx` (a living pet in every look
  and mood).

**Verify:** gates; the pixel check above; Home on the iPhone behaves as before (breathing,
blinks, hops, the stroke and purr), and stops moving on another tab.

### Phase A2 — tail, ears and head move

**Done 2026-10-09: checked by Mert on his iPhone** (the tail, ears and head move: the native
`matrix` works there). **After his check**, the tail calmed down: it wagged fast nonstop when happy.
Now `tailMotion` gives a calm motion (a slow sway, or still) and a burst (a few quick wags, a
cat's quiver or flick) that comes every few seconds at random, and on a tap (`wag()`); a test
holds that no calm motion is fast. Built as below, with three changes from the first plan: the ears perk up on a tap and while the mic is held (not on hearing the pet's name,
which nothing detects); the tail keeps wagging through a hop (only the ears are thrown about: a
second animation on the tail would stop its wag); and the whole head follows the eyes a little
(moved and tilted, ears with it), which reads better than sliding the face alone.

**Checked:** gates green (every test suite, 1,197 tests, including `petMotion.test.ts`: species-
true tails, drooping ears, no part turned past 25°, which caught a sad ear plus a full twitch at
26° and lowered the twitch). The real drawing rendered in Node with the app's own matrices at the
extreme poses (happy tails at both ends of the swing, sad ears with a twitch, the listening tilt
with a look, ears thrown in a hop) for a tabby, a calico, a golden dog and a brindle dog: no gap at
any joint, and the head's markings and ears move with it. Not yet seen on a device: that the
native `matrix` prop moves the parts there.

**Files:**

- `apps/mobile/lib/petMotion.ts` (new): the numbers per species and mood: `tailMotion` (rest,
  swing, speed; a bobtail swings half, a curly tail 0.7), `earMotion` (rest, twitch, hop swing,
  perk; hanging and folded ears move a third as much by mood and more in a hop), the twitch
  timing, the listening tilt, the nod and how far the head follows the eyes.
  `__tests__/petMotion.test.ts` (new).
- `apps/mobile/hooks/usePetBehaviour.ts`: takes the appearance, `listening` and `speaking`; the
  tail loop (R3); the ears' posture by mood and listening, a twitch every 4–10 s, a flap in each
  hop, and `perk()` (R4); the listening tilt and the speaking nod (R5). Under Reduce Motion the
  tail and ears hold their mood's posture without moving, and the head doesn't tilt or nod.
- `apps/mobile/components/pet/PetArt.tsx`: the head follows `lookX` (`HEAD_FOLLOW`).
- `apps/mobile/components/pet/PetStage.tsx`: `listening` and `speaking` props; a tap perks the
  ears. `components/home/HomeRoom.tsx`, `app/(tabs)/index.tsx`: pass `voice.listening` and
  `replyVoice.speaking`.

**Verify:** gates. Simulator: each species in each mood; Reduce Motion on: tail and ears
still. **Mert's
iPhone:** the motion feels like the species; Perf Monitor at 60 fps with a hop, the tail and the
ears moving. If it drops, stop and talk about bringing B1 forward (R12).

### Phase A3 — the mouth moves with the voice

**Done 2026-10-09: checked by Mert on his iPhone** (the mouth moves while it speaks). As below,
with two changes from the first plan: one open mouth (an oval under the nose that grows with the jaw, the tongue at its bottom
once it opens wide) in place of four separate shapes, which reads the same at this size; and only
a meow or a bark opens the mouth (a cat purrs with it shut).

**Checked:** gates green (every suite, 1,206 tests: the loudness maths, the voice feeding the
mouth and shutting it, recorded lines not sampled, each mood its own mouth line, the mouth line
and the open mouth inside the muzzle on every pet). The faces rendered in Node for two cats and
two dogs, light and dark coats, in each mood and with the mouth half and fully open. Not seen
yet on a device: whether iOS gives samples for the reply's streamed file. Either way the mouth
moves: with no sample 300 ms in, it chatters until the voice stops.

**Files:**

- `packages/brand/src/pet.ts`, `art.ts`: `petParts` gives `mouth` (the mood's line: a happy
  smile, a calm cat's "w", a calm dog's small smile, a frown when sad; sleepy as calm) in place
  of `smile`, and `mouthOpen` (where the mouth opens, per species); `art.pet.mouthInside`.
- `apps/web/src/components/pet/PetSvg.tsx`: draws the mood's mouth in every mood (the website's
  pets gain their mouths too).
- `apps/mobile/lib/petMouth.ts` (new): `soundMouth`, the openness sound holds the mouth at (a
  Reanimated value); `opennessOf` (the loudness of a batch of frames, eased), `nextMouth` (opens
  at once, closes over a few batches), `popMouth`, `shutMouth`. `__tests__/petMouth.test.ts`.
- `apps/mobile/lib/petVoice.ts`: a reply's player samples its audio (`setAudioSamplingEnabled`)
  and each batch moves `soundMouth`; `release()` shuts the mouth; `voiceSampled()` says whether
  samples came. Recorded lines (Meet, Personality) don't sample.
- `apps/mobile/lib/petSounds.ts`: `popMouth()` for a meow or a bark.
- `apps/mobile/lib/petPose.ts`: `jaw`. `apps/mobile/hooks/usePetBehaviour.ts`: the jaw follows
  `soundMouth` on the UI thread; while the pet speaks with no samples after 300 ms, a chatter
  (uneven syllables and pauses, repeated) has the mouth until it stops. The mouth moves under
  Reduce Motion too (decision 3), only while Home is seen.
- `apps/mobile/components/pet/PetArt.tsx`: the face draws the mood's mouth line; a living pet's
  mouth opens with `jaw` (the line fades as it opens).
- `apps/mobile/__tests__/petVoice.test.ts` (sampling faked; the mouth test),
  `petArt.test.tsx`, `packages/brand/__tests__/petDrawing.test.ts` ("the mouth").

**Verify:** on Mert's iPhone: a reply spoken aloud moves the mouth in time with the words, and it
shuts when the voice ends or the mic is pressed; a meow or a bark opens it once.

### Phase A4 — touch zones and a hug

**Done 2026-10-09: checked by Mert on his iPhone** (each spot answers its own way). As below,
with two changes from the first plan: the paws became parts of their own (`pawLeft`, `pawRight`, in front of the body), so a paw
can lift for the high five; and a tap on the back keeps today's hello (a squish, the ears pricked,
a wag) rather than a hop.

**Checked:** splitting out the paws changed no pixel (the 512 baseline images identical, at
tolerance 0). `zoneAt` tested on every option of every attribute, both species and the looks: the
nose, chin, head, each ear (a cat's above the head, each kind of dog ear where it hangs), each
paw, the belly, the back and a long tail's tip. The lines tested (each zone its own, no repeat; a
chin scratch, a belly rub and a hug their own). The new poses rendered with the app's matrices:
a raised paw, a tail flicked from its sad rest, ears back for a hug (the lift raised from 9 to 12
units after: 9 was hard to see). Gates green (every suite, 1,217 tests; `check:events` no longer
warns about `pet_hugged`); the web build.

**Files:**

- `packages/brand/src/petDrawing.ts`: the paws as parts of their own; `DOG_EAR_OVALS` exported.
- `packages/brand/src/petZones.ts` (new): `ZONES`, `zoneAt(parts, x, y)` (front to back: nose,
  chin, a dog's ear, head, a cat's ear, paw, belly, back, the tail beside the body; off the pet,
  its back) and `toPetSpace` (a point on the stage in pet space).
  `packages/brand/__tests__/petZones.test.ts` (new).
- `apps/mobile/lib/petPose.ts`: `pawLeft`, `pawRight`. `components/pet/PetArt.tsx`: a lifted
  paw rises and turns its pad out.
- `apps/mobile/hooks/usePetBehaviour.ts`: `react(zone, x)` (the head: ears back, a lean into the
  hand, a wag; the chin: head up, eyes half shut, a purr; the nose: a blink and a sneeze; an ear:
  that ear flicks twice; the belly: a wriggle; a paw: a high five; the tail: it flicks away and
  the pet looks back at it; the back: the ears prick, a wag), `stroked(zone)` (a purr; a chin
  scratch half shuts the eyes; a belly rub is a wriggle; a back stroke an arch) and `hug(holding)`
  (it squeezes in, eyes shut, ears back; on release it springs back and wags). The purr moved
  here from `PetStage`.
- `apps/mobile/components/pet/PetStage.tsx`: a tap, the start of a stroke and a hold (600 ms)
  find their zone; `onPress(zone)`, `onStroke(zone)` (a stroke's zone is one of head, chin,
  belly, back: `STROKE_ZONE`), `onHug()`; a tap waits only for the hold to fail. VoiceOver:
  Pat head, Stroke, Scratch chin, Rub belly, Hug.
- `apps/mobile/app/(tabs)/index.tsx`, `components/home/HomeRoom.tsx`: `tapPet(mood, zone)` (a
  line for the spot; a pat on the head or a chin scratch makes the pet beam), `strokePet(mood,
zone)`, `hugPet(mood)` (a line, hearts); `pet_tapped` and `pet_stroked` send `zone`,
  `pet_hugged` fires.
- `apps/mobile/lib/petLines.ts`: `touchLine(zone, species, previous)` (each spot its own lines,
  the back today's hello), `strokeLine(species, n, zone)` (a chin scratch and a belly rub their
  own), `hugLine`. `__tests__/petLines.test.ts`.

**Verify:** on Mert's iPhone: each spot answers its own way (head, chin, nose, an ear, the belly,
a paw, the tail, the back), a stroke on the chin and on the belly, a hug (hold still), and VoiceOver's
five actions.

### Phase A4b — Meet's pet

Added 2026-10-09 (decision 4: the living pet on Home and Meet). Meet showed a still `PetArt` that
rose in once.

**Done 2026-10-09: checked by Mert on his iPhone.** Agreed with Mert before building: every
touch Home has (tap zones, a stroke, a hug), since `PetStage` already does them; the pet's body
answers and the bubble keeps the first line (no touch lines, nothing floats up); and one event of
Meet's own, so Home's touch drop-off stays counted against `home_viewed`.

**Checked:** gates green (every suite, 1,221 tests; `check:events` at 107 mobile events with
`pet_meet_touched` fired; the web build). `meetPet.test.tsx`: Meet's pet is the
living one with its VoiceOver actions, each touch sends `pet_meet_touched` with its kind and zone,
never Home's events, and the bubble keeps the first line.

**Files:**

- `apps/mobile/lib/analytics.ts`: `pet_meet_touched` (`{ kind: 'tap' | 'stroke' | 'hug', zone }`),
  registered first, with its aha and drop-off.
- `apps/mobile/app/(create)/meet.tsx`: `PetStage` (300 pt, happy) in place of `PetArt`, inside the
  same `RiseAndBreathe`, so the rise and the landing haptic are as before. `speaking` comes from
  the first line's clip: a recorded line isn't sampled, so the mouth chatters and the head nods
  for as long as it plays. `active` follows the screen's focus: sign-in opens over Meet, which
  stays mounted, and the pet stops under it (R11). A pat on the head, a chin scratch, a stroke
  and a hug make it beam for a moment (`usePetReactions`' `showMoment`).
- `apps/mobile/components/pet/PetStage.tsx`: a `hint` prop for VoiceOver ("Says hello" on Home,
  "Answers your touch" on Meet, where the bubble doesn't change).
- `apps/mobile/__tests__/meetPet.test.tsx` (new).

**Verify:** on Mert's iPhone: the pet rises in as before, then breathes, blinks, moves its tail
and ears; its mouth moves while it says its first line and on "Hear it again"; each touch answers;
after "Take {name} home", coming back from sign-in finds it moving again.

**Could follow, not built:** the first line's clip could move the mouth by its real loudness
(sampling a recorded line, as a reply is sampled) in place of the chatter.

### Phase A4c — Welcome's pets

Added 2026-10-09 (decision 6). Welcome showed three still `PetArt`s, each floating 4 pt.

**Done 2026-10-09: checked by Mert on his iPhone.** Agreed with Mert before building: all
three alive; every touch Meet has, on each; the cat's mouth moves as each line appears and the two
beside it look at it, silent; before A5.

**Checked:** gates green (every suite, 1,226 tests; `check:events` at 108 mobile events with
`welcome_pet_touched` fired; the web build). `welcomePets.test.tsx`: three living
pets with their touches, `welcome_pet_touched` with the pet, kind and zone, a patted side pet
happy for a moment, the cat's lines in turn, and only the cat's square letting touches through.
The touch area's numbers come from rendering the three looks in Node and measuring where each
drawing lies in its square (ginger: 25 % to 90 %; in the row, the tuxedo's drawing ends 12 pt
left of the cat's and the dog's begins where the cat's tail ends). What a render
can't show (a touch outside the cat's area reaching the pet under its square, the frame rate)
was left to Mert's check on his iPhone, which passed; no frame rate was written down.

**Files:**

- `apps/mobile/lib/analytics.ts`: `welcome_pet_touched` (`{ pet, kind, zone }`), registered
  first, with its aha and drop-off.
- `apps/mobile/components/welcome/WelcomePets.tsx` (new): the three pets, moved out of
  `app/index.tsx` with the cat's lines. Each is a `PetStage` (the cat happy, the others content)
  inside its `RiseAndBreathe`, so the rise is as before. `useCatSays`: the lines on one timer,
  and `talking` for 1.6 s after each new one, which is the cat's `speaking` (the mouth chatters,
  the head nods; not under Reduce Motion, since nothing is said aloud). Each new line is a `cue`
  for the side pets: they look at the cat. All of it stops while Create is over Welcome.
- `apps/mobile/components/pet/PetStage.tsx`: `shadow` (off: the three share the ground's),
  `breathDelay` (the side pets a third of a breath apart), and `touchInset`: with it, only a
  strip of the square takes touches and the rest lets them through (`pointerEvents="box-none"`
  and one view that takes the touch), since the cat's square lies over its neighbours'. A
  stroke counts after 54 % of a small pet's size (140 pt was wider than a 150 pt pet).
- `apps/mobile/hooks/usePetBehaviour.ts`: `breathDelay`.
- `apps/mobile/components/pet/RiseAndBreathe.tsx`: passes `pointerEvents` on.
- `apps/mobile/__tests__/welcomePets.test.tsx` (new).

**Not done, on purpose:** VoiceOver still reads the three as one image, as the spec says, so
their touches aren't VoiceOver actions there; the bubble no longer floats with the cat's breath
(the cat breathes under it).

**Verify:** on Mert's iPhone: the three rise in as before, then each breathes, blinks and moves
its tail and ears; the cat's mouth moves as each line appears and the others glance at it; a tap
on the tuxedo's tail (under the cat's square) moves the tuxedo, not the cat, and the same for the
dog's left ear; a stroke and a hug on each; "Meet your pet" and back finds them moving again;
Perf Monitor at 60 fps.

### Phase A5 — light polish

**Done 2026-10-12: checked by Mert on his iPhone** ("new look appears great"; bigger eyes kept,
decision 2). As below, with five changes from the first plan:

1. **The light is a field beside the flat colour, not a new kind of fill.** A shape's `gradient`
   is drawn in place of its `fill`, which stays, so a renderer that draws no gradient (and every
   test on colours) still has the flat one. It is in pet space, not per shape: the body and its
   shoulders share one light, the head and its cheek fluff another, and each moves with its part.
2. **Each fur's light and low tones are its base, shifted** (`shiftLightness`, +0.05 and −0.06 in
   OKLCH), worked out in `art.ts`. `mix` wasn't needed, and a dark coat's `shade` is lighter than
   its base, so it couldn't be the low tone.
3. **The blush is part of the face**, since its depth is the mood's: `petParts` gives the cheeks
   and the mood's depth, each renderer draws them under the eyes, and `petDrawing` stays the
   same in every mood.
4. **No cheek fluff on a dog whose ears hang or fold** (floppy, button, rose): the ears lie over
   the cheeks and the tufts poked out from under them. Cats and upright-eared dogs have it.
5. **The eyes' sizes moved into `@app/brand`** (`EYE`): three places drew them from their own
   numbers. Brown dot eyes gain the two glints too; the sad brows and the closed arcs (happy,
   sleepy) were widened to fit.

**Checked:** the website's `PetSvg` rendered in Node for the eight looks and 24 seeded random
pets in all four moods, before and after, and read by eye on both schemes: the fluff was redrawn
twice (the first read as a collar), the whiskers thinned, the shade eased. The before and after
sheets for Mert were made from these. Gates green: secrets, template, typecheck, lint, format,
standards (42 of 42), events (108 mobile events, no new one: nothing here is something a person
does), env, store (8 of 8), every suite (1,232 tests) and the web build. What a render can't show
(a gradient inside a part moved by its native `matrix`, the blush deepening on a touch, the frame
rate with the gradients and four more animated glints) was left to Mert's check on his iPhone,
which passed; no frame rate was written down.

**Follows, not done:** the website's app screenshots and its recording
(`apps/web/src/lib/captures.ts`, taken from the Simulator on 2026-10-06) show the old pet beside
the site's live ones. Retaking them is a task of its own: the Simulator, the test account, and
two paid voice calls for the recording's sound.

**Files:**

- `packages/brand/src/shapes.ts`: `Gradient` (a radial light: centre, radius, stops) and
  `Paint.gradient`.
- `packages/brand/src/art.ts`: `highlight` and `lowlight` on every fur (`COAT_HIGHLIGHT`,
  `COAT_LOWLIGHT`); `art.pet.blush`.
- `packages/brand/src/pet.ts`: `EYE` (iris 4.6, pupil 2.6, dot 4, two glints; they were 3.6, 1.8,
  3, one glint), the wider `eyesHappy`, `eyesSleepy` and `browsSad`; `cheeks`, `blush` (happy
  0.6, content 0.36, sleepy 0.3, sad 0.14) and `BLUSH_DEEP` (0.85, when touched); `whiskers`
  (cats); `cheekFluff`.
- `packages/brand/src/petDrawing.ts`: `lit()`, the light from the upper left; the body, its
  shoulders, the head and the fluff are filled with it; the whiskers go over the muzzle, under
  the nose; the fluff has its share of the sticker edge.
- `apps/mobile/components/pet/PetArt.tsx`, `apps/web/src/components/pet/PetSvg.tsx`: `Shapes`
  draws a gradient under an id of the pet's own (as the clip has); the blush; the eyes from
  `EYE`. In the app a living pet's blush deepens with the pose and each glint moves with the
  pupil.
- `apps/mobile/lib/petPose.ts`: `blush`. `apps/mobile/hooks/usePetBehaviour.ts`: a pat on the
  head, a chin scratch, a stroke and a hug deepen it for a moment (under Reduce Motion too: it is
  the face's answer, R9).
- `packages/brand/__tests__/petDrawing.test.ts` ("the light polish"), `apps/mobile/__tests__/petArt.test.tsx`.

**Verify:** gates (the no-hex test), `petDrawing` tests (every colour comes from the art). Before
and after screenshots of the eight looks on both schemes, app and website, for Mert. **On Mert's
iPhone:** Home, Meet and Welcome look as the sheets do; the head's light turns with the head; a
stroke deepens the blush and it fades; the eyes blink and look with both glints; Perf Monitor at
60 fps on Welcome.

**Part A done 2026-10-12:** every phase checked by Mert on his iPhone; the tracking table,
`updates/v3.md`, the roadmap and the spec's Pet art contract ("Style") updated.

## Part B — 2.5D in Skia

### Phase B0 — Skia in the build, and a spike

**Done 2026-10-12 on the Simulator; the finish is picked (Puppet) and the spike is gone. Open:
the build for Mert's iPhone, and the frame time there.** As below, with five changes from the
first plan:

1. **The Simulator first, the iPhone after the evaluation** (decision 1). The build was made from
   this workspace, so its `ios/` is new; the main folder's `ios/`, where the signing fix lives,
   and the app on the iPhone were not touched.
2. **Older builds keep working: `hasSkia()`** (`lib/skia.ts`, R18 brought forward). Importing
   Skia in a build without it throws, and the iPhone's build has none yet. So only a file loaded
   behind `hasSkia()` imports Skia; everywhere else the pet stays SVG.
3. **The spike is a screen of its own, and draws the real pet**, not a circle on Home: a
   dev-only route (`app/dev-light.tsx`, the "Dev: light spike" link on Home, or
   `cozypet://dev-light?finish=plush`, since the Simulator takes no taps). It shows
   one of the eight looks at Home's size with its head swaying, in a finish chosen from the
   small pets under it, and the time each frame took. It stays until the iPhone has been measured, then it is deleted.
4. **No motion permission.** `expo-sensors` is added with `motionPermission: false`: the tilt
   (B4) reads the accelerometer, which needs none, and with it off the pedometer's code is
   compiled out, so the app can never ask and there is no purpose string to write.
5. **Skia's install script is allowed** (`allowScripts` in the root `package.json`): it downloads
   Skia's prebuilt libraries, which the native build links.

**What the spike found so far (the Simulator):**

- **Both ways light the pet correctly.** Part by part, each shape has its own shader, given the
  part it lies on. As one layer, the flat pet is drawn into a layer and one shader lights it.
- **A layer drawn plainly is soft:** its shader isn't density aware, so the pet came out at one
  pixel a point. Drawn in pixels it is as crisp as the other, at the cost of a layer of
  density × density pixels a point (nine times on the iPhone).
- **A layer's shader can't be drawn by CanvasKit** (Skia in WebAssembly), so not in Jest or off
  screen in Node: it compiles there, no more. Part by part draws there, so it can be tested and
  looked at without a device ([`docs/memory/skia-checks.md`](../../memory/skia-checks.md)).
- **As one layer, everything takes the same light** (markings, the belly, the tail) with no
  work per shape; part by part, each shape names its part, and the tail, ears and paws stay flat
  until they are given one.
- **Part by part is the way** (decided the same day, with the second spike below): it is crisp
  with no extra layer, and it can be drawn and tested without a device, which is how the
  finishes were tuned. The layer's code is gone from the spike. On the Simulator both ran at
  16.9 ms a frame, which says nothing about the phone: the frame time on the iPhone is still to
  read.

**Mert's look at the first spike (2026-10-12): none of the three.** "Some kind of woody layer on
top of the pet": the fur was drawn as fine streaks running down the coat, and a grain that runs
one way reads as wood. What he wants is "the feeling of a plush toy, something softy and
sweet", and several versions to pick from. So the spike became a picker of finishes:

| Finish    | What it is                                                     |
| --------- | -------------------------------------------------------------- |
| Flat      | Today's pet, unlit, to compare against                         |
| Plush     | A soft toy: fuzzy edges that catch the light, a faint nap      |
| Squishy   | Smooth and round with a soft highlight, like a marshmallow toy |
| Felt      | Matte wool felt: darker into the edges, a fine speckle         |
| Teddy     | A tufty, mottled coat, like a teddy bear                       |
| Velvet    | Deep colour, with a glow along every edge                      |
| Storybook | Painted: warm where the light falls, cool in the shade         |

**Mert's pick from those (2026-10-12): Felt and Storybook.** The other four went. He asked for
two or three more "that feel plush, living, and most close to 3D with the separations of body,
transitions on shadow". So three were built on his two, with the pet's form brought out:

| Finish  | What it is                                                              |
| ------- | ----------------------------------------------------------------------- |
| Woolly  | Felt's nap with Storybook's warm and cool light, each part a soft solid |
| Puppet  | A felted puppet on a set: the deepest form and shadows, the most 3D     |
| Lantern | Storybook by lamplight: a warm glow from behind round every edge        |

What gives them form, each a number a finish sets (Felt and Storybook keep theirs at none, so
they are as he chose them, but for a softer edge to the head's shadow):

- **Part on part** (`contact`): beside the head's shadow on the body, the paws shadow the body
  round them, the body shadows the tail where it comes out from behind, a cat's head shadows
  its ears and a dog's ears shadow its head. Every shadow is round with a wide soft edge, and
  cool where the finish's light is warm.
- **A solid's light** (`core`, `bounce`, `glow`): a darker band just past where the light ends,
  the ground's warm light bounced into the shaded underside, and the sky's light on the far edge.
- **Modelled past the seven parts** (`sculpt`): the muzzle and the belly are lit as rounds of
  their own, so they stand out; the muzzle shadows the head under it; the tail is a tube (a
  soft light along one side, a soft shade along the other); the eyes sit in faint sockets; the
  nose has a glint.

What changed with it, all of which B1 and B2 keep:

- **One shader, a finish is its numbers** (`SOFT_LIGHT`, `FINISHES`): how far the light wraps,
  the fuzz at the edges, the matte darkening, a highlight, speckle, tufts, warm light and cool
  shade, a lift to pastel, and how far the shapes' edges blur. Mert's pick, or a mix of two,
  becomes B2's constants.
- **No grain with a direction.** Speckle and tufts only.
- **Every part is lit**: the tail, ears and paws take the oval about their shapes, so nothing
  looks stuck on (the first spike left them flat).
- **The head casts a soft shadow on the body**, and there is a soft contact shadow under the feet.
- **The face is drawn** (blush, eyes, mouth): without it no finish could be judged.
- **A shape's own `transform` is applied** (a dog's hanging ears, a tail moved for a small body).

**Checked:** the native build (Xcode 26.6, iPhone 17 Simulator): 0 errors. The app starts and
Welcome looks as before, which is also the first picture of A5's look from the app's own
renderer. The spike's three ways, each from a clean start, by screenshot. Part by part rendered
off screen in Node for ginger, tuxedo and snow. Gates green: secrets, template, typecheck, lint,
format, standards (42 of 42), events (108, no new one: a dev screen is not something a person
does), env, store (8 of 8), every suite (1,238 tests, `lightSpike.test.ts` new: both shaders
compile under CanvasKit, their uniforms match what they are given) and the web build.

**Mert's pick (2026-10-12): Puppet.** "I like the puppet most ... this is the closest for the
living pet 3D." The picker and the other finishes were deleted the same day; Puppet's numbers
are the pet's light (`lib/petLight.ts`, B2).

**For Mert, after the evaluation:** stop Metro in other workspaces and start it here
(`npm run mobile:start`), then `npm run ios -- --device` from `apps/mobile`, and redo the signing
fix in this workspace's `ios/` ([`xcode-free-account-signing`](../../memory/xcode-free-account-signing.md)).
Then the frame time, on B1's dev screen.

**Files:**

- `apps/mobile/package.json`, `package-lock.json`: `@shopify/react-native-skia` 2.4.18 and
  `expo-sensors` ~55.0.19, as Expo SDK 55 pins them. `package.json` (root): the install script.
- `apps/mobile/app.json`: the `expo-sensors` plugin, `motionPermission: false`.
- `apps/mobile/lib/skia.ts` (new): `hasSkia()`.
- `apps/mobile/jest.config.js`: Skia's Jest setup; a test that imports Skia names Skia's
  environment in its first comment.
- The spike (`lib/lightSpike.ts`, `components/pet/spike/`, `app/dev-light.tsx`, its test): in
  git's history from 2ca6be7 to fe343e5, deleted once Puppet was picked.
- `docs/rules/permissions-and-privacy.md`: the two packages in the table of what each SDK
  collects (nothing leaves the device).

**Verify:** a native rebuild on the Simulator and Mert's iPhone, then the signing fix
(`xcode-free-account-signing`); the app runs as before; gates. The spike's frame time on the
iPhone.

### Phase B1 — the Skia pet, the same as the SVG one

**Built 2026-10-12, seen on the Simulator; Mert's check is open.** As below, with four changes
from the first plan:

1. **The scene has no hooks.** `PetScene` is handed each part's move and the face's pose;
   `PetCanvas` makes them from the pose on the UI thread. So a test draws the scene off screen
   with plain values, pixel for pixel, and the app animates the same scene.
2. **The switch has three places, not two**: SVG, Skia flat (the same shapes, to compare the two
   renderers) and Puppet (B2's light). On Home it is a dev link that steps through them.
3. **A dev screen shows the living pet without an account** (`app/dev-pet.tsx`,
   `cozypet://dev-pet?renderer=puppet&look=4&mood=sad`): the Simulator is signed out and takes
   no taps, and Home needs a pet. It also reads the frame time. It goes at B5.
4. **The numbers both renderers share moved to `lib/petMotion.ts`** (how far a look moves the
   eyes, when a lid shows, how a paw turns, when the mouth's line goes): PetArt had them to
   itself, and two renderers with their own copies drift.

**Checked:** on the Simulator, one look in the three renderers side by side: the SVG pet and
Skia's flat one are the same shape for shape, A5's gradients included. The Skia pet lives: over
several screenshots its tail, head and ears are somewhere else each time, it blinks, and a sad
tuxedo has its brows and its frown. `petCanvas.test.tsx` draws every look in every mood, lit and
flat, off screen and reads the pixels (the head and the body solid, the corners clear).

**Not done:** a mood change swaps the face at once (PetArt crossfades it): before B5. Not seen:
a touch (the Simulator takes none), the mouth with a voice, and the frame time on the iPhone.

**Files:**

- `apps/mobile/components/pet/PetCanvas.tsx` (new): `PetScene` (the parts, the face, lit or
  flat), `PetCanvas` (the moves and the face's pose from the pose), `atRest`.
- `apps/mobile/components/pet/PetStage.tsx`: `renderer` (`svg`, `skia`, `puppet`); Skia's pet is
  `require`d only where `hasSkia()`.
- `apps/mobile/components/home/HomeRoom.tsx`: the dev switch and the link to the dev screen,
  only in development and only in a build with Skia.
- `apps/mobile/app/dev-pet.tsx` (new, dev only).
- `apps/mobile/lib/petMotion.ts`, `components/pet/PetArt.tsx`: the shared numbers.
- `apps/mobile/jest.config.js`: of Skia, only its ES-module build is compiled (compiled again,
  its CommonJS build loses a function).
- `apps/mobile/__tests__/petCanvas.test.tsx` (new).

**Verify:** gates. Side by side in the Simulator: the same pet, the same motion. iPhone: frame
time against the SVG pet.

### Phase B2 — light and volume

**Started 2026-10-12: Puppet's light is on the living pet.** The shader and its numbers came
from the spike as Mert picked them, so the dev switch's third place is the look he chose, alive.

**Done:** `apps/mobile/lib/petLight.ts` (the plan's `petShaders.ts`): `PET_LIGHT`, the one
shader; `PUPPET`, the look's numbers; every part a round (`partRounds`), the muzzle and the belly
rounds of their own (`ownRound`); the shadows part on part (`castsOn`: the head and the paws on
the body, the body on the tail, a cat's head on its ears, a dog's ears and the muzzle on the
head). In `PetCanvas`: the tail as a tube, the eyes in faint sockets, a glint on the nose, soft
edges. If the shader does not compile the pet is drawn unlit, never blank (R18).
`__tests__/petLight.test.ts`: the shader compiles, is given what it declares, has no grain with
a direction, and every part of every look is lit and shadowed.

**Open:**

- **The rim from the sky's hour** (`art.ts`: a rim colour per phase). Today it is the evening's.
- **Shadows that follow the parts.** They are placed for the pet at rest: when the head tilts or
  the tail swings, its shadow on the body stays put.
- **Tuning on the iPhone**, with Mert: Puppet was picked from still pictures at one size.
- The eight looks at each sky phase, for Mert.

**Verify:** gates. The eight looks at each sky phase, for Mert. iPhone frame time.

### Phase B3 — fur and a soft outline

**Files:** `apps/mobile/lib/petShaders.ts` (fur noise), `PetCanvas.tsx` (the tufted outline in
place of the hard edge) (R15).

**Verify:** gates; Mert's eye: soft, not hairy; small and large sizes.

### Phase B4 — head turn and tilt

**Files:** `apps/mobile/hooks/usePetBehaviour.ts` (a head turn from the look, R16);
`PetCanvas.tsx` (the face across the sphere, the far ear behind); `apps/mobile/hooks/useDeviceTilt.ts` (new, `expo-sensors`, only while Home is visible) and the
parallax (R17).

**Verify:** gates; iPhone: tilt and turn, battery and heat after ten minutes on Home.

### Phase B5 — rollout

**Files:** `HomeRoom.tsx` and `app/(create)/meet.tsx` use `PetCanvas` (not the builder; Welcome's
three stay the living SVG pet, decisions 4 and 6); drawing pauses when Home isn't visible (R20); the dev switch goes once
Mert picks (R21).

**Verify:** gates; a release build on the iPhone, 60 fps; Mert's check. Tracking table,
`updates/v3.md`, the spec's Pet art contract, and the roadmap updated.

## Risks

- **SVG speed (A2).** `react-native-svg` redraws its whole view when an animated prop changes;
  six moving parts at 60 fps may be too much on an older iPhone. Caught in A2 on the iPhone; the
  answer is B1 sooner, not less motion.
- **The rebuild (B0)** can undo the free-account signing fix; it is the first step of B, alone.
- **Audio samples from a remote file on iOS (A3)** are unverified; the chatter fallback makes
  the mouth move either way.
- **The demo (decision 1).** A phase half done on `main` before the evaluation would hurt
  more than no phase: each phase is its own pull request and leaves the pet whole.
- **Two renderers drift.** Both loop over `@app/brand`'s parts; a test checks each handles every
  shape kind.
- **The website changes in A1 and A5** (the parts, the gradients); A1's pixel check guards it.
- **Nothing load-bearing:** no schema, no money, no entitlement, no Play Stats API.
