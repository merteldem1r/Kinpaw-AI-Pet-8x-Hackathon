# Kinpaw v1 screen spec

Sep 30, 2026 · @sena

## How to use this spec

Build these screens on the 8x template with the **dusk** preset and one accent, **#f2b66b** (lamp amber). The design canvas "Kinpaw v1 screens" is the visual reference; this doc is the contract. Where they disagree, this doc wins.

- **Rebrand** only in `packages/brand/brand.config.ts`: preset `dusk`, accent `#f2b66b` (🎨 BRAND), app name `Kinpaw` (🎨 REPLACE, placeholder). Set the splash and adaptive-icon background in `apps/mobile/app.json` to the dusk ground.
- **Scheme**: Auto by default, which follows the sky: the preset's light scheme by day, dark at night, across the whole app. Settings offers Auto / Light / Dark to lock it. Light renders the preset's `dawn` palette. **Changed 2026-10-01 (product.md):** the app follows the sky with no appearance choice for now; neither onboarding nor Settings offers one.
- **Pet name**: every `Mochi` in copy is the user's pet name, `{name}` below.
- **Register every event in section Events before building the screen that fires it.** An unregistered event is dropped silently.

### Colour by role, never by value

No hex in app code; the template's test fails on one. The hex column is what the canvas shows in dusk, for checking only.

| Role                                                          | Used for                                                                                      | Dusk value (check only)               |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------- |
| `bg`                                                          | Screen ground                                                                                 | #090f1e                               |
| `well`                                                        | Input fields, disabled buttons, failed-reply bubble                                           | #0d1525                               |
| `surface`                                                     | Needs panel, look cards, sheets, preset rows                                                  | #121b2d                               |
| `surface2`                                                    | Mochi's bubbles, limit card                                                                   | #192336                               |
| `surface3`                                                    | Segmented thumb, Premium pill, sheet handle                                                   | #222d42                               |
| `textPrimary` / `textBody` / `textSecondary` / `textTertiary` | Headings / reading / supporting / captions and inactive tabs                                  | #eff2f9 / #d2d8e2 / #b4bbc9 / #8e96a5 |
| `brandGradient` + `onBrand`                                   | Primary buttons, send button                                                                  | #f6c386→#eeaa58, #131b2e              |
| `brandInk`                                                    | Accent text, icons, links, need bars, focus                                                   | #f2b66b                               |
| `brandDim` + `brandBorder`                                    | Secondary buttons, selected rows and cards, tab lens                                          | amber 16% / 40%                       |
| `brandGlow`                                                   | The wash behind the pet on Meet Mochi and the Paywall only; Home's atmosphere is the sky band | amber 30%                             |
| `errorText`                                                   | **Low need** bar, icon and "· low"; failed-reply caption                                      | #f6908d (coral)                       |
| `errorBorder`                                                 | Dashed edge of the failed-reply bubble                                                        | coral at \~45%                        |
| `tintTrack`                                                   | Empty part of need bars, empty trait dots                                                     | text at 10%                           |
| `borderHairline` / `borderSoft` / `borderGlass`               | Dividers / card edges / top-lit glass edge                                                    | text at 8% / 12%, white 12%           |
| `overlay`                                                     | Behind the fine-tune sheet                                                                    | shadow tint 62%                       |

The coral for low needs is dusk's existing `errorText` semantic role, not a new colour. Dusk's `warningText` (#f4c767) is too close to the amber accent to read as a change, which is why it is not used.

### Type by role

**Serif is the narrator, Inter is Mochi's voice.** Headers and titles use the display face; everything Mochi says (the Home bubble) is Inter.

| Role       | Where                                                                     |
| ---------- | ------------------------------------------------------------------------- |
| `display`  | Meet: "{name} is home"                                                    |
| `title`    | Home header (narrator line)                                               |
| `question` | Onboarding questions                                                      |
| `h3`       | Sheet titles, error and limit card titles                                 |
| `body`     | Home bubble, leads                                                        |
| `bodySm`   | Error and limit card body                                                 |
| `label`    | Buttons, row titles, look names, trait names                              |
| `caption`  | Need labels, counters, preset descriptions, footnotes, tab labels (11/14) |
| `eyebrow`  | Date on Home, "Step N of 3", preset name on Meet                          |

### Motion, haptics, accessibility

- **Motion** uses the preset's four springs and durations only; no bounce. Need bars fill on `smooth`. Pet mood swaps crossfade over `base`. Tapping the pet presses to 0.98 and returns on `settle`. Bubble text swaps with the outgoing line leaving first, never a crossfade of two lines.
- **Reduced motion**: nothing travels or scales; bars and moods change instantly; typing paws hold still at 70%.
- **Haptics** by meaning: a need rises → `success`; action with no change (already full) → `press`; tap pet → `select`; locked look → `warning`; send → `press`; load or reply error → `warning`.
- **Accessibility**: 44pt targets; roles cap Dynamic Type; low state never rides on colour alone ("· low" word + VoiceOver "Hunger, 58 percent, low"); the pet image has a label with name and mood; the typing bubble announces "{name} is typing".
- **Data**: mock values live only in `lib/mockData.ts` for development. Production shows loading, empty and error states, never fake data.

## Pet art contract

Every pet is drawn in code from its species and six attributes; there are no pet image files. The eight ready-made looks are just presets of the same attributes. Source: `pets.ts` (data, palette, presets, helpers, geometry; lives in `packages/brand`) and `PetArt.tsx` (renderer, `react-native-svg` only), from the pet builder code drop. **Changed 2026-10-03** ([v2-pet-looks](../features/v2-pet-looks-requirements.md)): the catalog is `@app/contract` (`appearance.ts`), the colours `@app/brand` (`art.pet`, everything that differs by fur on its fur), the shapes `@app/brand` (`petParts`, then `petDrawing`: one ordered list of shapes with the pattern clipped to the body and head). The app's `PetArt` and the site's `PetSvg` draw that list and add the face.

| Attribute                     | Options (Plus = premium)                                                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fur                           | Ginger, Cream, Grey, Charcoal, Chocolate, Golden, Snow, Cinnamon, Lilac (the last three added 2026-10-03)                                                                                 |
| Pattern                       | Solid, Stripes, Tabby, Saddle, Patches (Plus), Spots (Plus), Tortie (Plus), Points (Plus), Brindle (Plus). **Changed 2026-10-03:** Socks and bib moved to White markings                  |
| Eyes                          | Brown, Amber, Green, Blue, Hazel, Copper, Ice (Plus), Odd-eyed (Plus) (Hazel, Copper, Ice added 2026-10-03)                                                                               |
| Ears                          | Cat: Pointy, Round, Folded, Tufted (Plus), Lynx (Plus). Dog: Floppy, Perky, Button, Rose, Bat (Folded, Lynx, Rose, Bat added 2026-10-03)                                                  |
| Body                          | Tiny (added 2026-10-03: a kitten's or puppy's body under the same head), Slim, Round, Chonky, Buff (Plus, added 2026-10-01: broad shoulders for a V shape, pec and ab lines on the belly) |
| Tail                          | Long, Fluffy, Curly, Bobtail, Plume (the last two added 2026-10-03)                                                                                                                       |
| Marking colour                | Matching (the pattern's own colour), or any fur colour; all free (added 2026-10-03)                                                                                                       |
| Paws & chest (white markings) | None, Mittens, Socks and bib, Bicolour, Van (Plus) (added 2026-10-03)                                                                                                                     |
| Paws & chest colour           | White, Cream, Golden, Ginger, Cinnamon, Chocolate, Grey, Lilac, Charcoal; all free (added 2026-10-03)                                                                                     |

| Preset     | Species | Recipe                                                    | Tier |
| ---------- | ------- | --------------------------------------------------------- | ---- |
| Ginger     | cat     | ginger, stripes, brown, pointy, round, long               | Free |
| Smoke      | cat     | grey, stripes, green, pointy, slim, long                  | Free |
| Tuxedo     | cat     | charcoal, solid + white socks, amber, pointy, round, long | Free |
| Calico     | cat     | cream, patches, brown, pointy, round, fluffy              | Plus |
| Biscuit    | dog     | golden, solid, brown, floppy, round, long                 | Free |
| Pepper     | dog     | charcoal, solid + white socks, brown, perky, slim, long   | Free |
| Snow       | dog     | cream, solid, brown, floppy, chonky, fluffy               | Free |
| Blue merle | dog     | grey, spots, blue, floppy, round, long                    | Plus |

- **Moods**: `content`, `happy`, `sad`, `sleepy` work for every combination; only the face changes: the eyes, the mouth, and how deep the cheeks blush (most when happy, least when sad). Happy dogs show a small tongue.
- **Style**: soft vector, a cream sticker edge around every pet, picture-book proportions. **Changed 2026-10-12 (v3 pet looks, A5; it was flat):** the head and the body are lit from the upper left in the fur's own lighter and darker tones; the eyes are large, with two glints; the cheeks blush; cats have whiskers; cats and dogs with upright ears have a little fluff at the cheeks. Dark furs (charcoal, chocolate) switch the face lines to a light ink so eyes stay visible.
- **Contact shadow**: drawn by `PetArt` (`shadowOpacity` 0.55 on dusk, about 0.22 on dawn).
- **Data**: the pet stores `appearance` (species + six attribute ids), validated with `parseAppearance()`, plus `preset_id` when it came from a ready-made look.
- **Premium honesty**: Patches and Spots are Plus because the Plus looks are built from them; otherwise anyone could build Calico for free.
- **Accessibility**: `PetArt` labels itself, e.g. "A ginger striped cat with brown eyes, looking happy".

## Shared logic

Four needs drive everything on Home: what the pet looks like, what the narrator says and what Mochi says. All of it is rule-based and local; only talking calls the AI, and even then our code, not the model, decides the need changes.

### Needs

- `hunger`, `happiness`, `energy`, `affection`: 0–100. The server stores them as fractions plus `updatedAt`; the client applies decay since then and **shows whole numbers**. Every threshold (low, full, too sleepy, mood, the lowest need) reads the whole number shown, so a need that shows 90 is full on both sides. **Low** = below 30. (**Changed 2026-10-02**, were integers: whole numbers threw away decay on every change. `features/needs-rhythm-requirements.md`.)
- **Decay, a daily rhythm** (**changed 2026-10-02**, was −3 to −4 an hour day and night): by day (07:00–23:00, the phone's time) hunger −12/h, happiness −9/h, affection −7/h, energy −5/h. While the pet sleeps (23:00–07:00) the first three fall at a quarter of that (−3, −2.25, −1.75) and energy recovers +12/h. From full, hunger is low after about 6 hours: the pet calls you back three or four times a day, and wakes up wanting breakfast, not starving.
- The pet never dies or leaves. At 0 it is only sad or sleepy, and recovers as soon as needs rise.
- Feed, Play and Pet have **no cooldowns or daily caps** (Mert, 2026-10-02: nothing remembers recent actions). **Each tap gives less the fuller the need is** (**changed 2026-10-02**, were flat): the gain is the base times the room left, `base × (100 − value) / 100`, at least 3, never past 100. From low, Feed goes +30, +18, +11, +6.5, then it's full. The reaction line is the feedback. Talking's gains are capped (below).

Starting values; tune freely (`packages/contract/src/v1/needs.ts`: `ACTION_GAIN`, `MIN_GAIN`, `SIDE_HAPPINESS`, `PLAY_ENERGY_COST`).

| Action              | Effect                                                   | If it can't help                                        | Reaction lines (cycle)                                                                                                            |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Feed                | hunger: base 40 × room left; happiness: 3 × room left    | hunger ≥ 90: no change, "I couldn't eat another bite."  | "Mmm. Crunchy. Thank you." / "Best. Dinner. Ever." / "You remembered the good kind!"                                              |
| Play                | happiness: base 35 × room left; energy −10               | energy < 15: no change, "Too sleepy to play. Tomorrow?" | "Again! Again!" / "I almost caught it. Almost." / "You're terrible at hiding. I love it."                                         |
| Pet                 | affection: base 30 × room left; happiness: 3 × room left | none                                                    | "Mmm. Right there." / "Okay. You can stay." / cat: "I purred so loud the neighbours heard." dog: "My whole back half is wagging." |
| Talk reply received | by intent, below                                         | none                                                    | the pet's own reply                                                                                                               |

### What you say (intents)

Changed 2026-10-01 (product.md, "Talking"); replaces "affection +5 per chat reply". The model
names one intent; this table, in `packages/contract`, decides the change. Starting values; tune
freely.

| Intent         | For example                  | Happiness | Affection |
| -------------- | ---------------------------- | --------- | --------- |
| `affectionate` | "I love you", "good girl"    | +3        | +6        |
| `kind`         | "I had a nice day"           | +2        | +4        |
| `playful`      | "wanna race?"                | +4        | +2        |
| `neutral`      | "what are you doing?"        | 0         | +2        |
| `harsh`        | "I don't like you today"     | −6        | 0         |
| `apology`      | "sorry, I didn't mean it"    | +4        | +2        |
| `upset`        | "I'm so tired of everything" | 0         | +3        |

- **Energy never changes from talking.** Hunger doesn't either.
- **The floor**: talking alone never takes a need below 30. A need already below 30 doesn't
  drop further from talking.
- **The daily cap**: talking adds at most +30 affection and +25 happiness per local day
  (**changed 2026-10-02**, were +20 and +15, to match the faster day); past it, the reply still
  comes and the numbers stay. What talking adds is a whole number, even though the needs are
  fractions.
- Decay is applied first, as for every action.

### Mood (picks the image)

1. `sleepy` if energy < 30
2. else `sad` if the lowest need < 20
3. else `happy` if the average of all four ≥ 75
4. else `content`

The Home error state always shows `sleepy`; loading shows `content`.

### Header and bubble lines

The header is the narrator (serif); the bubble is Mochi (Inter). Both come from the **lowest need**, or from the all-good row when every need is 70 or more. Lines live in `lib/petLines.ts` with cat and dog variants where they differ.

| Lowest need | Header (narrator)          | Bubble (Mochi)                                                                                 |
| ----------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| affection   | {name} missed you          | You're back! I kept your spot warm.                                                            |
| hunger      | {name}'s tummy is rumbling | Is it dinner o'clock? Asking for me.                                                           |
| energy      | {name}'s getting sleepy    | Stay a minute? I am almost asleep.                                                             |
| happiness   | {name}'s a little bored    | I've counted every dust bunny. Play with me?                                                   |
| all ≥ 70    | {name}'s happy you're here | cat: Best evening ever. Don't tell the other cats. dog: Best evening ever. My tail won't stop. |

- After an action, the bubble shows that action's reaction line; the header recomputes from the new needs.
- **"I missed you" (v2, added 2026-10-05,** [v2-memory-requirements.md](../features/v2-memory-requirements.md) **R26–R27).** When the app opens or comes back, Home asks the server once per foreground. After 6 hours or more away the bubble's first line is a return line in place of the needs line, by time away and species, with the person's first name when set (`{you}`, as in the notes): 6–24 hours "There you are! I kept your spot warm." · cat "Oh, you're back. I wasn't watching the door. Much." / dog "You're back! I heard your steps before you got here." · "{you}! I saved you the comfy side."; 1–3 days "You're back! I missed you. Not even pretending." · cat "Look who's here. I missed you. Don't tell anyone." / dog "You're back! My tail hasn't stopped since I saw you." · "{you}! I missed you. Tell me everything?"; more than 3 days "You came back! I kept everything just how you left it." · cat "There you are. I kept your spot warm the whole time." / dog "You're home! I saved up all my wags for you." · "{you}! I missed you so much. I'm so happy you're here." A remembered event whose day has come is asked instead, once, after any time away: "Oh, {you}! / Oh, hi!", "You're back(, {you})!", "I missed you(, {you})!" or "You came back(, {you})!" before its question ("How did the exam go?"). The line stays until anything else is said and is gone once Home is left. The intro's one-time offer comes before it. `greeting_shown` is recorded first-party.
- **Tapping the pet** shows a random line from a small local list ("Hi. Hi. Hi.", "What? I'm just looking at you.", "You smell like outside.", "I was very good while you were gone."), changes no needs, and presses the pet to 0.98.
- The eyebrow is the weekday and part of day: morning (05–12), afternoon (12–17), evening (17–21), night (21–05), e.g. "Wednesday night".

### Talk limit and entitlement

- Free: 10 messages a day to the pet, spoken or typed, resetting at local midnight, counted by the server. A message counts when its reply arrives; a failed reply, nothing heard, or the model not reachable does not count.
- Premium (`Kinpaw Plus`, 🎨 REPLACE): unlimited talking, premium looks ("more pets" is an open question in product.md).
- The paywall opens only from a limit (talking, a locked look after onboarding) or from the Profile tab, and never before the first conversation.

### Pet created before sign-in

The pet draft (species, look, name, preset, traits) lives in local state, persisted to storage, from the Look step on. After sign-in it is saved to the API, then the draft is cleared. If that save fails, keep the draft and retry; the Save screen shows the error.

### Notes from Mochi (v2)

> **Added 2026-10-04** ([v2-notifications-requirements.md](../features/v2-notifications-requirements.md)).
> The rules are `apps/mobile/lib/nudge.ts`; the lines are `apps/mobile/lib/notificationLines.ts`.
> Change a line there and here together.

Local notifications in the pet's voice, scheduled on the phone when the app goes to the background and cancelled when it opens. Nothing shows while the app is open.

- **When:** the first moment a need would show below 30 after you leave, but never within 3 hours of leaving, and only from 09:00 to 21:00 local (a later moment moves to the next 09:00). Then once a day, 24 hours after the one before, in the same window. **Three in all**, then nothing until the app is opened.
- **What:** the title is the pet's name; the body is a line for the lowest need at that moment. Day 1 uses the "first" lines, days 2 and 3 the "later" ones, never the same line twice in a row. `{you}` is the first word of the person's name (20 characters at most); without one, those lines are skipped. No remembered fact, no follow-up, nothing said, ever.
- **Tone:** cozy and first person, like the bubble. It misses you; it never guilts you (no starving, crying, dying, "you forgot me", lonely, alone).

| Need      | Day 1 ("first")                                                                                                                                                                                                    | Days 2–3 ("later")                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hunger    | My bowl is looking very empty. Just saying. · Cat: I've been staring at my bowl. It hasn't filled itself. / Dog: I've checked my bowl four times. Still empty. · {you}, is it snack o'clock? Asking for me.        | Saved you a seat at dinner. Mostly for me. · Still dreaming about snacks. And you. Mostly you. · {you}, my tummy says hi. So do I.                              |
| Happiness | It's a bit quiet here. Want to play? · Cat: I found a very good string. It needs two. / Dog: I found the best stick. It needs two. · {you}, I've got a game idea. Come see?                                        | I'm saving my best game for when you're back. · Still here, still hoping for a game. · {you}, I practised a new trick for you.                                  |
| Energy    | Feeling a little sleepy. Come tuck me in? · Cat: Found a sunny spot for a nap. There's room for you. / Dog: My bed is all fluffed up. Come see me before my nap? · {you}, I could use a cozy nap. Keep me company? | Had a long nap. I dreamt about you. · Cat: Curled up and thinking of you. / Dog: Curled up by the door, thinking of you. · {you}, I saved you half the blanket. |
| Affection | I saved you the warm spot. · I keep thinking about you. Come say hi? · {you}! I missed you. That's all.                                                                                                            | Still keeping your spot warm. · No rush. I'll be right here when you're back. · Thinking of you, {you}.                                                         |

## Events

Register all of these with the template's `events` skill first; reuse the template's own sign-in, paywall and purchase events where they exist and add the properties below. Names are `object_action` in snake case. **No property ever carries what was said, the pet's reply or the pet's name.** The talk events below replace the Talk tab's (changed 2026-10-01); M6's `events` skill run finalises them.

| Event                       | Screen                  | Fires when                           | Properties                                                                 |
| --------------------------- | ----------------------- | ------------------------------------ | -------------------------------------------------------------------------- |
| `onboarding_step_viewed`    | Look, Name, Personality | Step appears                         | `step`: look, name, personality                                            |
| `pet_species_selected`      | Look                    | Cat/Dog changes                      | `species`                                                                  |
| `pet_look_selected`         | Look                    | A free look is picked                | `species`, `look_id`                                                       |
| `pet_look_locked_tapped`    | Look                    | A premium look is tapped             | `species`, `look_id`, `during_onboarding`                                  |
| `pet_name_submitted`        | Name                    | Continue with a valid name           | `name_length`                                                              |
| `pet_preset_selected`       | Personality             | A preset row is picked               | `preset`                                                                   |
| `pet_finetune_opened`       | Personality             | Fine-tune sheet opens                | `preset`                                                                   |
| `pet_trait_changed`         | Fine-tune               | A trait dot is picked                | `trait`, `level` (1–10)                                                    |
| `pet_finetune_closed`       | Fine-tune               | Done or dismiss                      | `changed_count`                                                            |
| `pet_meet_viewed`           | Meet                    | Screen appears                       | `species`, `look_id`, `preset`, `custom_traits`                            |
| `pet_meet_continued`        | Meet                    | "Take {name} home"                   | none                                                                       |
| `pet_save_viewed`           | Save sign-in            | Screen appears                       | none                                                                       |
| `pet_created`               | Save sign-in            | Pet saved to the API                 | `species`, `look_id`, `preset`, `custom_traits`                            |
| `pet_save_failed`           | Save sign-in            | Saving the draft fails               | `error_kind`                                                               |
| `home_viewed`               | Home                    | Tab focused with data                | `mood`, `lowest_need`, `low_count`                                         |
| `home_load_failed`          | Home                    | Needs fail to load                   | `error_kind`                                                               |
| `home_retry_tapped`         | Home                    | Try again                            | none                                                                       |
| `pet_action_taken`          | Home                    | Feed, Play or Pet                    | `action`, `need_changed`, `mood_before`, `mood_after`                      |
| `pet_action_failed`         | Home                    | An action's save fails               | `action`, `error_kind`                                                     |
| `pet_tapped`                | Home                    | Pet image tapped                     | `mood`                                                                     |
| `need_info_opened`          | Home                    | A need pill tapped (its sheet opens) | `need`, `low`                                                              |
| `talk_started`              | Home                    | Listening starts or field opens      | `input`: voice, typed                                                      |
| `talk_cancelled`            | Home                    | Slid away, nothing heard, closed     | `reason`: slid\_away, nothing\_heard, speech\_failed, closed               |
| `talk_message_sent`         | Home                    | Words sent                           | `input`, `length_bucket`: short, medium, long                              |
| `talk_reply_received`       | Home                    | Reply arrives                        | `input`, `intent` (`upset` sent as `other`), `latency_ms`, `messages_left` |
| `talk_reply_failed`         | Home                    | Reply fails or times out             | `error_kind`: timeout, not\_connected, invalid\_reply, network             |
| `talk_retry_tapped`         | Home                    | Try again on a failed reply          | none                                                                       |
| `talk_limit_reached`        | Home                    | Free count hits 0                    | none                                                                       |
| `mic_permission_answered`   | Home                    | The permission prompts answered      | `granted`                                                                  |
| `upgrade_tapped`            | Home, Look, Profile     | The locked mic, a lock, "See plans"  | `source`: talk\_limit, locked\_look, profile\_panel                        |
| `paywall_viewed`            | Paywall                 | Paywall appears                      | `trigger` (same values as `source`)                                        |
| `settings_scheme_changed`   | You                     | Appearance changes                   | `scheme`: auto, light, dark                                                |
| `tab_selected`              | Tab bar                 | Tab changes                          | `tab`: pet, friends, profile, settings                                     |
| home\_sky\_tapped           | Home                    | Sun or moon tapped                   | time\_of\_day                                                              |
| welcome\_viewed             | Welcome                 | Screen appears                       | time\_of\_day                                                              |
| welcome\_start\_tapped      | Welcome                 | "Meet your pet"                      | none                                                                       |
| welcome\_signin\_tapped     | Welcome                 | "I already have an account"          | none                                                                       |
| pet\_create\_path\_selected | Start                   | A start card is tapped               | path: choose, build; species                                               |
| pet\_customize\_tapped      | Choose a friend         | Customize                            | preset\_id                                                                 |
| pet\_builder\_viewed        | Make your own           | Builder appears                      | from: start, customize; species                                            |
| pet\_attribute\_changed     | Make your own           | A free option is picked              | attribute, option                                                          |
| pet\_option\_locked\_tapped | Make your own           | A Plus option is tapped              | attribute, option, during\_onboarding                                      |
| pet\_surprise\_tapped       | Make your own           | Surprise me                          | species                                                                    |
| pet\_name\_idea\_tapped     | Name                    | A name idea chip is tapped           | fur (no name text)                                                         |

Wherever a property above says `look_id`, send `preset_id` (or `custom`) plus `appearance_key` from `appearanceKey()`, so built pets are tracked too.

## App icon and logo mark

The icon is a round amber moon with cat ears and sleepy closed eyes on a midnight sky. No text, so it survives the final name.

- **Default**: 1024 × 1024 PNG, square, no transparency, no rounded corners (iOS masks them). Ground: a vertical gradient #1b2748 → #090f1e with three tiny stars and a soft amber glow behind the moon. Moon and ears: #f2b66b with three faint crater dots in #e8a24f at 60%. Eyes: two closed arcs in #131b2e. 🎨 REPLACE with final art.
- **Dark variant** (iOS 18+): the same moon on pure black, the glow at about half strength, eyes in black.
- **Tinted variant** (iOS 18+): greyscale on black; moon and ears #e6e6e6, stars at 50%. iOS applies the user's tint.
- **Small sizes**: at 60pt and below, drop the crater dots and thicken the eye strokes by about 10% so the face still reads.
- **Logo mark**: the template's `LogoMark` (rounded square with the app's initial) is replaced by a small version of the icon: the moon face on its midnight tile, corner radius about 28% of its size. It is a logo, so the tile stays midnight in both schemes. Used on Welcome, Save Mochi and the Paywall header, and as the marketing site's favicon.
- Put the icon artwork in `apps/mobile/assets/icon/` and point `app.json` `ios.icon` at the three variants.

**Launch scene** (added 2026-10-01): the native splash stays a still image (the sleeping moon face, 200pt, on #090f1e). When the app is ready, `components/LaunchScene.tsx` draws an exact copy over it and hides the native splash, so the hand-over can't be seen, then wakes it: stars fade in and twinkle, a warm glow rises behind the face, the eyes open, it blinks and bounces, "Kinpaw" (the app name, 46pt `display`, "Kin" in `art.star` white and "paw" in the face's gold) rises in letter by letter 22pt below the face (which never moves from where the native splash drew it), and the scene swells and fades into the app (about 2.1s). Colours are `art.mark`. Reduced motion: the eyes open at once and it fades quickly. JS only, so it ships over the air.

## Welcome

The first screen on first launch: the Home sky at the real time of day, three pets waiting together, one promise and one way forward. It is the template's `app/index.tsx`, refilled.

**Layout** (24pt gutter)

1. Ground and sky: the same `SkyBand` as Home at the current phase, 480pt tall, fading into `bg`. With Appearance on Auto, morning and afternoon use `dawn`, evening and night `dusk`.
2. Top left: `LogoMark` (32pt) + "Kinpaw" in `h3`.
3. Three pets on one contact shadow: Tuxedo (left, 130pt), Ginger (centre, 184pt, `happy`), Biscuit (right, 130pt), all from `PetArt`. The group is one image to VoiceOver: "Three pets waiting together: a tuxedo cat, a ginger cat and a golden dog".
4. `Text variant="display"`: "A little friend who's always glad you're here."
5. `lead` in `textSecondary`: "Feed them, play, talk a little. They'll be right here when you come back."
6. Large primary with arrow disc: "Meet your pet" → Create · Start.
7. Ghost button: "I already have an account" → the template's sign-in, then Home.
8. `caption` in `textTertiary`: "By continuing you agree to the Terms and Privacy Policy.", both links in `textSecondary`, underlined.

**Motion**: the centre pet rises into place first, then the two sides, 90ms apart, each dissolving up 16pt from a 6pt blur on `gentle`. After landing, each pet breathes: a 4pt float on a 4.4s in-out loop, offset so they never move together. **Changed 2026-10-09 (v3 pet looks, A4c):** after landing each is the living pet, as on Home (`PetStage`): it breathes at its mood's pace (the side pets a third of a breath apart), blinks, moves its tail and ears, does its idle moves, and answers a tap, a stroke and a hug with its body. The cat's mouth moves as each of its lines appears and the two beside it look at it; no sound. A touch reaches the pet drawn under the finger, though the cat's square lies over its neighbours'. All of it stops while Create is over Welcome. Stars, moon, sun and clouds animate as on Home. Reduced motion: everything appears at once and holds still.

**Routing**: **Changed 2026-10-01 (product.md):** the first screen on every launch for anyone without a saved pet, signed out or signed in before saving one; a pet in progress keeps its choices and "Meet your pet" continues it from Start. Signed in, "I already have an account" is hidden. Someone with a pet never sees it.

**Events**: `welcome_viewed`, `welcome_start_tapped`, `welcome_signin_tapped`, `welcome_pet_touched` (`{ pet, kind, zone }`).

## Create · Start

Step 1 of 3 opens on a choice: your real pet from a photo, or one you make yourself. Route in `app/(create)`, in the onboarding shell (Back, three dots, no Skip). **Changed 2026-10-04** ([v2 pet from a photo](../features/v2-pet-from-photo-requirements.md)): Choose a friend was removed and From a photo came first.

1. `Eyebrow` "Step 1 of 3"; `Text variant="question"` "Who's coming home with you?"
2. `SegmentedControl` Cat / Dog. It swaps the art on both cards and carries into Make your own; a photo decides its own species.
3. Two large pressable `Card`s, each a 150pt stage on top and a text row below (`h3` title, `caption` line, 40pt arrow disc), both with the featured 1.5pt brand-gradient edge and a badge:
   - **From a photo** (first), badge "Your real pet", "Show us your pet. We'll draw it." Stage (changed 2026-10-06, Mert: the photo path should be the more eye-catching card): a photo becoming a pet, every 3.6 s through three free looks of the species (ginger, tuxedo, smoke cats; Biscuit, Pepper, Snow dogs). The polaroid holds the pet on an afternoon sky with the reading light sweeping down it; four sparkles arc across to the right, where the same pet draws itself bottom up (happy) and three glints pop round it, on a warm glow. A light runs round the card's gradient edge (one lap per 3.6 s), and it has the sheen and breathing arrow too; Make your own's sheen waits half a pass so the two never cross together. Reduced motion: the polaroid, an arrow and the pet, still; no orbiting light. With no tries left on the phone the line reads "No photo tries left on this phone." → the photo sheet (below), or the out-of-tries screen.
   - **Make your own**, unchanged: badge "One of a kind", "Pick the fur, eyes, ears and tail.", the cycling built pet with swatches, chips, spotlight, sparkles, puff, sheen and breathing arrow. Reduced motion: no sweep, puff or pulse, and the sparkles hold still. → Make your own.
4. **The photo sheet** (`PhotoSheet`, B1): title "Show me your pet", "One cat or dog, face to the camera, in good light.", the tries as two dots ("2 tries", "1 try left"), rows **Take a photo** and **Choose from library** (56pt), and the note "Your photo goes to Google's Gemini, through fal.ai, our AI service, so it can see your pet's colours. Kinpaw never saves it, and it's only used to draw your pet." The first photo on a phone asks first, in the sheet: "Send your photo to the AI?" with **Not now** and **Allow** (Apple 5.1.2(i)). Camera refused: "Camera access is off. Choose from your library, or turn it on in Settings." A photo the phone can't open: "I couldn't open that photo. Try another one." Over the limit (rare: every photo is shrunk first): "That photo is too large. Try another one."

**Events**: `onboarding_step_viewed` (`step: start`), `pet_species_selected`, `pet_create_path_selected` (`path: photo | build`), `pet_photo_sheet_opened`, `pet_photo_source_selected`, `pet_photo_permission_denied`.

## Create · From a photo

`app/(create)/photo.tsx`, in the onboarding shell. One screen, several states (v2-pet-from-photo-requirements.md, R13–R18):

- **Reading** (C2): "Drawing your pet…"; the photo in a tilted polaroid (art.cloud frame) with a band of `brandInk` light sweeping down it; under it the sky stage of the hour holding a portal where the pet will be (changed 2026-10-06, Mert; was a breathing outline): two dashed `brandInk` rings turning opposite ways, three sparkles orbiting, a paw breathing in a warm disc at its heart, specks of light rising into it. No pet shape: the photo decides the species. Under the stage, a `surface2` card of four steps, ticked off every 1.5 s with a brand-gradient check: "Looking at the fur…", "Finding the markings…", "Matching the eyes…", "Shaping the ears and tail…"; the last spins until the answer, which ticks them all as the pet draws itself. Paced, not measured; VoiceOver reads each step as it starts. Reduced motion: the portal still, the steps still tick. The phone waits up to 25 s.
- **The reveal** (D1): the pet draws itself from the bottom up over 900 ms (happy), the polaroid goes and the stage slides up into place; then "Is this your pet?", with (changed 2026-10-06, Mert) faint `brandInk` rays turning slowly behind the pet (one turn per 40 s), a burst of ten sparkles out of it as it lands, and the pet bobbing gently after; the photo as a 76pt polaroid tilted top left of the stage, popping in; under the stage a `surface2` card "WHAT WE SAW" with a trait pill for each thing seen (fur, pattern, white markings, eyes, ears), popping in one after another, the colours with their own swatch (fur, white, eyes; odd eyes split blue and amber) and pattern and ears with an icon. Reduced motion: no burst, still rays, no bob. When Plus options were swapped for free ones, a `well` note: "Your pet has Tortie, a Plus pattern. We used Tabby for now; you can switch with Kinpaw Plus later in Change look." CTA **That's them!** → Name; secondary **Adjust** → Make your own on that pet, the photo bottom left of its stage and "Made from your photo. Change anything that's off." above Continue.
- **No single pet** (E2): the pet's bubble ("Hmm, I can't spot a cat or dog in that one. A clearer photo of their face?", "I see more than one friend there! A photo of just one?", "That one's a bit blurry. Another try?"), a sad pet on the stage, the tries left; **New photo** (the sheet again) and **Make your own**.
- **Out of tries**: "That was our last photo together. Let's make your pet by hand, I'll help!", a sleepy pet, "No tries left", **Make your own**.
- **Resting** (the network's or the app's day is full) and **our failure** ("I couldn't look at that just now. Try again?", no try used): the bubble and the pet, **Make your own** (and **Try again** for a failure).

Reduced motion: no sweep and no breathing; the pet appears at once. VoiceOver: "Reading your photo"; the pet reads its description; the chips are one group; the photo is "Your photo".

**Events**: `pet_photo_read` (`context`, `result`, `ms`, `species`, `swapped_count`), `onboarding_step_viewed` (`step: photo`), `pet_photo_confirmed` (`choice`), `pet_photo_kept` (`changed_count`).

## Create · Make your own

A one-screen builder: the pet large on a stage, attribute tabs, one row of choices. Opened blank (a random free combination from `randomAppearance()`) from Start, or on the pet read from a photo (Adjust, with the photo bottom left of the stage). Customize (from Choose a friend) went with it on 2026-10-04.

**Layout**

1. Shell top bar. Title: `question` "Make your own". **Changed 2026-10-01:** no Cat / Dog control here; the species is picked on Start (or Choose a friend) and Back changes it.
2. Stage (280pt, 28pt radius): `PetArt` 250pt with its contact shadow under a sky. **Changed 2026-10-01:** the sky is Home's (`SkyScene`: gradient, sun or moon on the right below Surprise me, clouds, stars, sky life) at the current time of day. Top-left inside the stage: a glass time-of-day picker (four 30pt buttons: sunrise, sun, sunset, moon; the chosen one in `brandDim` and `brandInk`) that previews the pet under each sky. Nothing is saved (`pet_builder_sky_changed`, `time_of_day`). Top-right: a compact glass "Surprise me" pill (36pt, dice icon, `caption`).
3. Tabs: a `SegmentedControl`-style track with six tabs: Fur, Pattern, Eyes, Ears, Body, Tail. **Changed 2026-10-01:** each tab is an 18pt icon above a 12pt label (palette, shapes, eye, ear, paw print, spline), in a 56pt track, so "Pattern" no longer truncates; the chosen tab's icon is `brandInk`.
4. Options card (`surface`, 10pt padding). **Changed 2026-10-03** ([v2-pet-looks](../features/v2-pet-looks-requirements.md), R15): Fur holds the colours and Pattern the shapes, picked by a small switch at the top of the card (Fur: Main | Pattern | Paws & chest; Pattern: Pattern | Paws & chest); Matching is a split swatch (the coat and its markings' colour); on a Solid coat the Pattern colour row says "Solid has no markings. Pick a pattern to see this colour.", and with no paws & chest markings their colour row says "No paws & chest markings. Pick some under Pattern." During onboarding the status line ("Tortie is a Plus option…") sits above Continue, always in view **Changed 2026-10-01:** no title or current-choice line (the tab names the attribute, the check marks the choice), so the screen fits without scrolling. One row of choices:
   - Fur and Eyes: 44pt colour swatches, glossy (a soft highlight upper left), each with its name below in `caption`; selected gets a 2pt `brandInk` ring with a ground-coloured gap and a small check; Odd-eyed is a split blue/amber dot.
   - Pattern, Ears, Body, Tail (**changed 2026-10-01**, were word chips): live preview tiles (84pt wide), each showing the person's own pet wearing that option in a `well` window, framed on what it changes (the head, large, for Ears; the whole pet for Pattern, Body and Tail), with the name below. Selected = `brandDim` ground, `brandInk` edge, a soft `brandInk` glow and a check badge.
   - Picking an option pops it (a quick swell and settle).
   - Plus options carry a small lock badge, a dimmed preview and quieter labels.
5. Status line, then the floating primary "Continue" → Name.

**Interactions**

- Every change updates the pet at once and flashes the `happy` mood for 700ms (`select` haptic). Reduced motion keeps the instant swap, no other motion.
- Surprise me: `randomAppearance(species)` (free options only), with the same happy flash.
- A Plus option during onboarding: not selected; status line "Odd-eyed is a Plus option. It comes with Kinpaw Plus." (`warning` haptic). After onboarding it opens the paywall (`trigger: locked_option`).
- Back returns to Start; the draft appearance is kept.

**Accessibility**: tabs are a tablist; each option row is a radio group; swatches read their colour name and ", Plus option" when locked; the pet image announces its description.

**Events**: `onboarding_step_viewed` (`step: build`), `pet_builder_viewed` (`from: start | customize`), `pet_attribute_changed` (`attribute`, `option`), `pet_option_locked_tapped` (`attribute`, `option`), `pet_surprise_tapped`.

## Create · Name

Step 2 of 3: the pet you just chose, a name field and three name ideas.

- Shell: Back, dots (second active), `Eyebrow` "Step 2 of 3", `Text variant="question"` "What's their name?"
- `PetArt` 200pt (the draft appearance) on a soft `Glow`.
- Template `Input`: label "Name", placeholder "Mochi", auto-capitalise words, return key "Next", a `caption` counter ("6/20") inside the field. Autofocus on appear.
- **Name ideas**: `caption` "Ideas for a {fur} {species}", then three chips from `nameIdeas(appearance, 3)` and a 44pt dice button for three more. Tapping a chip fills the field, marks the chip selected and flashes the pet `happy` (it likes its name).
- Valid: 1–20 characters after trimming. Continue stays tappable; with an empty field it refuses with the 6pt shake, `warning` haptic and "Give them a name first."
- The name replaces `{name}` everywhere after this step.

**Events**: `onboarding_step_viewed`, `pet_name_idea_tapped`, `pet_name_submitted` (`name_length`, `from_idea`).

## Create · Personality and Fine-tune sheet

> **v2 voice (added 2026-10-06,** [v2-voice-requirements.md](../features/v2-voice-requirements.md) **R14):** under the subtitle, `bodySm` tertiary "It shapes {name}'s voice too. Tap one to hear it." Tapping a personality, even the chosen one, plays its recorded line in the pet's voice, even with the silent switch on (asked for); while it plays, that row's trailing shows the speaking bars (three bouncing `brandInk` bars; a still speaker with Reduce Motion), announced "{name} is speaking" (`voice_sample_played`).

Step 3 of 3: one tap on a preset is enough; the six traits are optional and live in a sheet.

**Personality screen**

1. Shell: Back, dots (third active), `Eyebrow` "Step 3 of 3", `Text variant="question"` "What's {name} like?", lead "Pick a starting point. You can fine-tune it." (`body`, `textSecondary`).
2. Four `SelectionRow`s (72pt, 10pt gap): title in `label`, description in `caption`, 24pt ring on the right. Cuddly homebody is preselected.
3. A pressable standard `Card` row (56pt): sliders icon, "Fine-tune traits" in `brandInk`, "Optional" in `caption` tertiary, chevron. Opens the sheet. **Changed 2026-10-01:** once the traits differ from the preset, the fine-tuned mix is its own choice: this row becomes a selected `SelectionRow` "Your own mix" (sliders icon, "Fine-tuned from {preset}. Tap to adjust.") that reopens the sheet, every preset row goes unselected, and the preset it started from shows "Your base" in `caption` tertiary. Tapping any preset resets the traits to it, as before.
4. Floating large primary "Meet {name}" with arrow disc.

**Presets** (shown as 1–5 dots, stored as 1–10 by doubling)

| Preset id | Title                | Description                               | Affection | Playfulness | Energy | Curiosity | Loyalty | Independence |
| --------- | -------------------- | ----------------------------------------- | --------- | ----------- | ------ | --------- | ------- | ------------ |
| `cuddly`  | Cuddly homebody      | Loves laps, naps and you.                 | 5         | 2           | 2      | 3         | 4       | 2            |
| `curious` | Curious rascal       | Into everything. Asks a lot of questions. | 3         | 4           | 4      | 5         | 3       | 3            |
| `cool`    | Cool and independent | Loves you, on its own terms.              | 3         | 2           | 3      | 3         | 2       | 5            |
| `loyal`   | Loyal shadow         | Follows you from room to room.            | 4         | 3           | 3      | 2         | 5       | 1            |

**Fine-tune sheet** (template `Sheet`)

- Handle, `h3` "Fine-tune {name}", `caption` "Starting from Cuddly homebody"; after any change it reads "Custom, from Cuddly homebody".
- A Less … More legend (`caption`, tertiary) over the dots column.
- Six `TraitDotRow`s (new), 52pt each with a hairline between: trait name in `label` (124pt column), then five 44pt tap targets, each a 14pt dot. Dots up to the level fill with `brandInk`; the rest are 1.5pt rings in `tintTrack`. Tap sets the level, `select` haptic. **Changed 2026-10-01:** the rows are `TraitBar`s, the same as on Pet details: a 28pt disc tinted in the trait's colour with its icon, the name (96pt), and five 8pt segments across the rest of the row in the trait's own colour (`art.traits`); each segment is a full-height (48pt) tap target that sets the level. The Less / More legend lines up with the bars.
- Footnote (`caption`, tertiary): "These shape how {name} talks and reacts. Any mix is fine." Every combination is allowed, including contradictory ones.
- Primary "Done" closes the sheet; drag-down or backdrop tap also closes and keeps the changes.
- Picking a different preset afterwards resets all six traits to that preset.

**Accessibility**: each trait row is a radio group whose dots read "Affection, level 3 of 5"; it also supports increment and decrement actions.

**Events**: `onboarding_step_viewed`, `pet_preset_selected`, `pet_finetune_opened`, `pet_trait_changed`, `pet_finetune_closed`.

## Meet Mochi

> **v2 voice (added 2026-10-06, R15):** as the pet lands, it says its bubble's line out loud in its voice, from a recorded clip (follows the silent switch; `voice_sample_played`). The bubble gains a row: the speaking bars and "{name} is speaking" while it plays, then "Hear it again" with a speaker, which plays it once more. No row with the voice off or VoiceOver on.

> **v3 pet looks (added 2026-10-09, A4b):** the pet is the living one, as on Home (`PetStage`, 300pt, happy): it breathes, blinks, moves its tail and ears, its mouth moves while it says its first line, and it answers a tap, a stroke and a hug with its body. The bubble keeps the first line: no touch lines, nothing floats up. It stops while sign-in is over Meet. Event: `pet_meet_touched` (`{ kind, zone }`). VoiceOver: the label "{name}, happy", the hint "Answers your touch", Home's actions.

The activation and demo moment: the pet appears, says its first line, and the only way forward is taking it home. It is the Home stage with no panel and no tab bar.

- **Ground**: `bg` with grain; a larger `Glow` (`brandGlow`) placed off-centre behind the pet.
- **Top**: `Eyebrow` with the preset title ("Cuddly homebody"; "Custom" if fine-tuned); `Text variant="display"` "{name} is home".
- **Bubble**: `PetBubble` (new, shared with Home) without the Reply row, upper right, pointing down-left to the pet.
- **Pet**: `PetArt` in the `happy` mood, 300pt, with contact shadow.
- **Bottom**: `caption` "Next, save {name} with your email.", then the floating large primary "Take {name} home" with arrow disc → Save sign-in.

**First line by preset**

| Preset               | Line                                  |
| -------------------- | ------------------------------------- |
| Cuddly homebody      | Oh! Hi. I think I like you already.   |
| Curious rascal       | Ooh. What's that? And that? Hi!       |
| Cool and independent | Nice place. I'll allow it.            |
| Loyal shadow         | You're here. Good. I'm staying close. |
| Custom               | Oh! Hi. I think I like you already.   |

**Motion**: the pet dissolves in from an 8pt blur and rises 16pt on `gentle`; the bubble follows one stagger step later; one `success` haptic when the pet lands. Reduced motion: everything appears at once.

**Back** returns to Personality with the draft intact.

**Events**: `pet_meet_viewed`, `pet_meet_continued`, `pet_meet_touched`.

## Save Mochi and sign in

One screen family for saving a new pet and for signing back in: the Home sky at the top, the pet sitting on the top edge of a sheet, and the template's sign-in form inside the sheet. Flow and validation stay the template's; layout, copy and the pet are new.

**Layout** (both steps)

1. Sky: `SkyBand` at the current phase, 380pt, ending in the sheet's colour.
2. Top bar at the safe area: glass Back `IconButton` (44pt) on the left; the full logo lockup centred (`LogoMark` 32pt + "Kinpaw" in the display face, 22pt), in `textPrimary` of the current scheme.
3. The pet: `PetArt` 160pt, its feet on the sheet's top edge, breathing on the Welcome float. A `PetBubble` to its right carries Mochi's line.
4. Sheet from 332pt to the bottom: `surface`, `sheet` radius on the top corners, glass top edge, 24pt padding. It is part of the screen, not a draggable `Sheet`.
5. Footer inside the sheet, 42pt above the bottom: "Privacy Policy" and "Terms of Service", `caption` in `textTertiary`.

**Email step**

- `h1` "Save {name}" and `body` "Sign in so {name} is here every time you open the app."
- Eyebrow label "Email", then the template `Input` (52pt, `well`, mail icon, placeholder "you@example.com"); focus draws the 1.5pt `brandInk` border.
- Large primary "Email me a code".
- "or" divider, then "Continue with Apple" (white on dusk, black on dawn, per Apple's guidelines) and an outline "Continue with Google" (50pt each). All three ways end in the same save step.
- Mochi: `happy`, "Don't lose me! Save me here."

**Code step**

- `h1` "Check your inbox"; `body` "Enter the code we sent to {email}. It can take a minute; check spam too.", the address in `textPrimary`.
- Six 60pt boxes (the template's one-time code) with tabular digits; the next empty box has the `brandInk` border. One hidden field underneath with `textContentType="oneTimeCode"` so iOS offers the code from Mail.
- **Auto-verify** on the sixth digit; the Verify primary stays as a fallback and looks disabled (`well`) until six digits are in.
- "Resend in 43s" as a `well` pill counting down in tabular figures, then "Resend code" in `brandInk`; "Change email" beside it returns to the email step with the address kept.
- Mochi: `content`, "I'll wait by the door."

**States**

| State      | Boxes                                                 | Message under the boxes                                                        | Mochi                             |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------- |
| Typing     | Next box in `brandInk`                                | none                                                                           | content, "I'll wait by the door." |
| Verifying  | unchanged                                             | spinner in the Verify button                                                   | unchanged                         |
| Wrong code | All six in `errorText`, 360ms shake, `warning` haptic | "That code didn't match. Try again or send a new one." in `errorText`          | sad, "Hmm, that's not the one."   |
| Right code | All six in `successText`, `success` haptic            | "Signed in. Saving {name}…" in `successText`                                   | happy, "Yay! Let's go home."      |
| Save fails | unchanged                                             | "Couldn't save {name} yet. Check your connection and try again." + "Try again" | sad                               |

After the pet is saved, replace the stack with Home so Back cannot return to onboarding.

**Returning user** ("I already have an account" on Welcome): the same screens with `h1` "Welcome back" and `body` "Sign in to see your pet. They've been waiting." Instead of one pet, the Welcome trio (Tuxedo, Ginger, Biscuit) sits on the sheet edge, with no bubble, because their own pet is not known until sign-in. After sign-in go straight to Home.

**Keyboard**: when the email field or code boxes take focus, the sky collapses to the top bar and the pet shrinks to 96pt on the sheet edge, all on the `smooth` spring, so the field, the primary and the "or" row stay visible above the keyboard. Reduced motion: the layout jumps without animating.

**Keep out of production**: the template's development-build "Skip to the app" / "Skip to onboarding" buttons and the settings gear on this screen.

**Events**: `pet_save_viewed`, the template's sign-in events (email submitted, code requested, code resent, code failed, signed in, with the method: email, apple, google), `pet_created`, `pet_save_failed`.

## Home

The first tab, `app/(tabs)/index.tsx`: the pet stands in the room's light, its four needs in small pills at its sides, the mic under it, and a row of three care tiles above the tab bar. Cat and dog use the same layout; only the art and a few lines differ.

> **Changed 2026-10-02 (Mert): Home fits one screen, without scrolling, on every iPhone from the
> SE up.** The 2 × 2 needs panel in its card becomes four need pills beside the pet, and the
> 84pt care tiles become a slim row of 56pt tiles with no card. Talking keeps its own row under
> the pet, apart from care: round amber controls are for talking, coloured tiles for care
> (Mert: they are different things). Items 4–8 below, "NeedPill", "Care tiles" and "Fitting
> the screen" are the new design; where an older line in this section says otherwise, this
> note wins. Why, and what was tried first: [ideas.md](../ideas.md#home-fits-one-screen-need-pills-and-slim-care-tiles).

**Layout** (tab `Screen`, 20pt gutter, floating tab bar clearance)

1. `Eyebrow`: weekday and part of day ("Wednesday night").
2. Header, `Text variant="title"`: the narrator line from Shared logic.
3. Stage: the sky band (below) fills the top of the screen behind the eyebrow, header and bubble. No `Glow` behind the pet on Home, so nothing competes with the sky; the pet stands on grain with only its contact shadow, and no box around it.
4. `PetBubble` (new), upper right, its lower-left corner by the pet's head and growing upward, never down onto the right-hand pills (**changed 2026-10-02**: no fixed three-line space above the pet any more; three lines fit between the header and the pills): `surface2`, hairline, `card` radius with the lower-left corner at 6pt pointing at the pet, card shadow. Mochi's line in `body`. (Changed 2026-10-01: there is no Talk tab; the bubble is where the pet answers when you talk, and its "Try again" row appears only after a failed reply. See "Talking (on Home)".)
5. `PetStage` (new): a `PetArt` of 260pt at most (smaller on small phones, see "Fitting the screen") and its contact shadow, alive (**changed 2026-10-01**). It breathes at its mood's pace (happy quick and bouncy, sad and sleepy slow and slumped), blinks every 2.4–6s (some doubles), glances around (a happy pet keeps its eyes open with its smile; its eyes squeeze into smiling arcs only for a happy moment, after care, a stroke or a kind reply: changed 2026-10-06, Mert, so a well-cared-for pet still looks at you; sleepy stays closed), and glances up at the bubble when the line changes. Every 11–22s it does something by itself, by mood: hops or sways when happy, stretches or looks around when content, sighs when sad, yawns (with z's) when sleepy, or looks at the button it wants. A tap squishes it (`select` haptic, a blink, a tap line, `pet_tapped`). A finger dragged across it is a stroke: its eyes follow the finger and it leans in; after 140pt it purrs (a shiver and a run of ticks), hearts float up, it shows its happy face and says a stroke line (`pet_stroked`, no stat change). VoiceOver offers "Stroke" as an action. Left alone for a minute, it looks up, hops and says an idle line, once until the next touch. Reduced motion: it stands still; taps and strokes still answer in the bubble.
6. **Need pills** (**changed 2026-10-02**, were a 2 × 2 grid of meters in a card): four `NeedPill`s beside the pet, two to a side, against the content's edges: hunger over energy on the left (the body), happiness over affection on the right (the heart). The two pairs sit level with the pet's lower half, their bottom about 16pt above its feet, 10pt between the two pills of a pair. They may touch the drawing's outline; they never cover its face. A tap on a pill opens its "Need sheet" (below); touches between and around the pills still reach the pet, but a stroke that starts on a pill is a tap on it.
7. **Talk row**: the mic in the middle and the keyboard button beside it, right under the pet (see "Talking (on Home)").
8. **Care tiles** (**changed 2026-10-02**, were 84pt tiles in the needs panel's card): Feed, Play and Pet in one row above the tab bar, no card behind them. See "Care tiles" below.
9. `TabBar`: My pet · Friends · Profile · Settings, My pet active (Friends since v2, 2026-10-06).

**NeedPill** (new 2026-10-02, replaces `NeedMeter`): a 32pt-tall full-radius pill, `surface2` with a hairline `borderSoft` edge and the card shadow, so it reads on any sky and on the room; 10pt padding; a 16pt icon (bowl, smile, bolt, heart) in `textSecondary`, then a 40 × 5pt bar in `brandInk` on `tintTrack`. No name and no number on screen. **Low** (< 30): the edge becomes 1.5pt `errorText`, the icon and bar turn `errorText`, and a `caption` "low" in `errorText` follows the bar (the pill grows toward the pet), so low never rides on colour alone. VoiceOver: one button per pill, "Hunger, 58 percent, low", hint "Shows how hunger works". Its touch area is 44pt tall (6pt beyond the pill above and below); a tap plays `select`, pops the icon (1.3×, back on `settle`) and flashes the pill's edge in its colour (`brandInk`, `errorText` when low) with a soft glow and a 14% tint, fading over 650ms. Reduced motion: only the haptic. **A change** of 3 or more plays the effect the meters had (the minute-by-minute decay just moves the bar). Up: the gained part glows and a sheen runs along the fill, the icon bounces with a little wiggle, a `brandInk` "+20" floats up from the bar's end and fades, and reaching 100 pops three sparkles there. Down: the lost part lingers as a faded `errorText` ghost for 450ms, then drains, the icon droops, and an `errorText` "−5" floats up. Reduced motion: the bar simply moves.

**Need sheet** (new 2026-10-02, Mert): tapping a pill opens a `Sheet` that explains that need, so people learn how the game works. Explain only: no action button, the care tiles stay the one place to act. One need per sheet.

- **Head**: the need's icon and name (`h3`), its level as a percent on the right ("58%", or "12% · low" in `errorText`), and an 8pt bar under them in `brandInk` (`errorText` when low). It stays live while open. VoiceOver reads the head as one header: "Hunger, 58 percent, low".
- **About**, `body` `textSecondary`: "How full {name}'s tummy is." · "How cheerful {name} feels." · "How rested {name} is." · "How close {name} feels to you."
- **Lines**, `bodySm`, each with a 16pt icon: ↓ in `errorText` for what lowers it, ↑ in `brandInk` for what raises it, ⓘ in `textTertiary` for a note. Plain words with the numbers that help plan, every number read from the rules in `@app/contract` (`apps/mobile/lib/needInfo.ts`), never typed into the copy:
  - Hunger: drops about 12 every hour, 3 while asleep · Feed: up to +40, less the fuller it is; nothing at 90 or more · talking doesn't change it.
  - Happiness: drops about 9 every hour, 2 while asleep · harsh words −6, but words never take it below 30 · Play: up to +35, less the fuller it is · Feed and Pet: up to +3 each; kind, playful and loving words: up to +25 a day.
  - Energy: drops about 5 every hour in the day, Play −10 · sleeps from 11pm to 7am, your time, and gets back about 12 every hour · below 15 too sleepy to play; talking doesn't change it.
  - Affection: drops about 7 every hour, 2 while asleep · Pet: up to +30, less the fuller it is · kind and loving words, and saying sorry: up to +30 a day.
  - (Changed 2026-10-02 with the daily rhythm; the copy is built from the rules, so these lines follow them.)
  - Every need ends with: "Below 30 it's low, and {name} will let you know."
- **Got it**: a full-width primary button that closes the sheet; the sheet also closes by dragging down or tapping outside.
- **Event**: `need_info_opened` { `need`, `low` } on every open.

**Care tiles** (new 2026-10-02): three equal tiles, 12pt apart, 56pt tall (18pt radius), the icon (17pt) on a 32pt disc beside the label (`label`), each in its own colour matching the need it fills (`art.care`: Feed warm orange, Play teal, Pet pink). The three looks are the ones the 84pt tiles had. _Normal_: `surface2`, the disc tinted 18% in the colour, the edge at 28%. _Wanted_ (the lowest need is low and this action helps it, or, from M6 Phase 4, the pet's reply suggested it and it can help): a soft top-down gradient of the colour, a 1.5pt edge in it, a glow breathing around the tile, the disc solid, and a badge on the top edge ("Hungry", "Bored", "Missed you"). _Can't help_ (Feed at hunger ≥ 90, Play at energy < 15): faded to 60% with a muted badge ("Full", "Sleepy"), still tappable. A badge never wraps. Reduced motion: the glow holds still.

**Fitting the screen** (new 2026-10-02): Home never scrolls at the default text size on any iPhone from the SE (667pt) up. From the top: safe area, eyebrow, header (one or two lines), the stage, the talk row (86pt, kept by the typing field too), the care tiles, the tab bar's clearance. The stage takes what is left, and the pet is that height less room for the bubble above its head, never more than 260pt and never less than 180pt; the pills don't scale. When the biggest pet leaves room over, it is shared above and below the pet and its bubble's room, not all piled above. On an iPhone 17 Pro the pet is 260pt; on an SE it is smaller. Width: the pills take about 76pt a side, and the drawing's own margins let them meet its outline. The page may scroll only while the keyboard is up and at the largest accessibility text sizes; it never scrolls during a stroke.

**SkyBand** (new): the top 470pt of Home is the sky outside at the current time of day, one soft gradient from the status bar down that ends exactly on the screen's `bg`, so the pet stands in the room below. Built with `expo-linear-gradient` (the sky) and `react-native-svg` (sun, moon, stars, clouds) with Reanimated for motion: no images, no Lottie, so it ships over the air.

**The app follows the sky.** With Appearance on Auto (the default), morning and afternoon use the preset's light scheme (`dawn`) and evening and night use `dusk`, for the whole app, not only Home. The sky then always fades into a ground of its own brightness: a day sky into pale paper, a night sky into midnight. Every colour below the sky still comes from roles, so switching schemes is the template's own mechanism.

| Phase     | Hours | Scheme on Auto | Gradient stops (0, 28%, 50%, 74%, then `bg` at 100%) | Sun or moon                                  | Extras                                | Mochi's line on tap                                     |
| --------- | ----- | -------------- | ---------------------------------------------------- | -------------------------------------------- | ------------------------------------- | ------------------------------------------------------- |
| Morning   | 05–12 | dawn           | #bcd3e8, #f1d9bd, #f6c9a0, #f3e7dc                   | Low sun #f7b267, lower left                  | Two drifting clouds                   | The sun's up. That means breakfast, right?              |
| Afternoon | 12–17 | dawn           | #7fb0dc, #9cc4e6, #c4dcef, #dfe9f4                   | High sun #f8d27a, upper right                | Two drifting clouds                   | Perfect nap weather. Just saying.                       |
| Evening   | 17–21 | dusk           | #3d3a6b, #8a5a86, #e59a6b, #6a4a6e                   | Setting sun #f6a25e, low left, below a cloud | Faint stars, thin clouds              | The sky's going orange. My favourite colour. Obviously. |
| Night     | 21–05 | dusk           | #141d38, #1b2748, #24325a, #1b2748                   | Moon #f1e9d2 in tonight's real phase, left   | Twinkling stars, a rare shooting star | Don't tell anyone, but I talk to the moon.              |

If Appearance is locked to the other scheme (a day sky in Dark, a night sky in Light), the 74% stop becomes a bridge tone into that ground: #5d7fa6 for day skies over `dusk`, #dfe9f4 for night skies over `dawn`.

- **Colours**: sky, sun and moon colours are illustration colours, not UI roles: put them in `packages/brand` as an `art.sky` export (like the pet art) so the no-hex test still passes.
- **Text over the sky**: the header uses `textPrimary` of the current scheme. The eyebrow uses `brandInk` on dusk and `textPrimary` on dawn, because dawn's darker amber falls below 4.5:1 on the morning and afternoon skies. The status bar content follows the scheme. The bubble keeps its own `surface2` card, so it reads on any sky.
- **Timing**: fixed clock hours, the same ones as the eyebrow. Check on focus and once a minute. A phase change crossfades the sky over the preset's `slow` duration; a scheme change at 05:00 or 17:00 happens on the next focus, never under the user's thumb mid-action.
- **Ambient motion**, all in-out easing: stars twinkle (opacity 25–100%, 3.2s, staggered), the moon bobs 2pt over 6s, sun rays breathe (opacity 50–100%, 4s), clouds drift ±6pt over 18s. Reduced motion: everything holds still.
- **Rare delight**: at night, a shooting star crosses the upper sky every 20–60s, at random. **Changed 2026-10-01:** once per visit was too rare to ever be seen. Never under reduced motion.
- **Sky life** (added 2026-10-01): light motes rise slowly around the morning sun; a flock of two or three birds crosses the afternoon sky every 8–18s; fireflies wander and glow low in the band at dusk (six in the evening, three at night). The moon is drawn in tonight's real phase, its unlit part faint (earthshine), never thinner than a crescent. Colours are `art.life` and `art.lamp`. None of it under reduced motion.
- **Room glow** (added 2026-10-01): in the evening and at night a warm lamp glow (`art.lamp`, radial, 420pt) sits behind the pet and flickers very slightly.
- **Tap**: a 72pt round button over the sun or moon (label "Moon, night sky"). Mochi says that phase's line in the bubble and looks up at it; the sun bounces and flares, the moon wobbles. `select` haptic, no stat change.
- **States**: shown in ready, loading and error alike, because the time is local.

**States**

| State         | When                           | What shows                                                                                                                                                                                                                                                                       |
| ------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ready         | Needs loaded                   | As above; mood image, header and bubble from the rules                                                                                                                                                                                                                           |
| Loading       | First load, nothing cached     | Eyebrow; `Skeleton` bar in place of the header; pet in `content` at 70% opacity (art is local); no bubble; four `Skeleton` pills in the pills' places; the talk row's space kept; Feed/Play/Pet as quiet `well` tiles with tertiary labels                                       |
| Refreshing    | Cached needs exist             | Cached values stay on screen and update quietly; no skeleton                                                                                                                                                                                                                     |
| Error         | Load fails with nothing cached | Header "Hmm, {name}'s hiding"; pet `sleepy`; no bubble; no pills; the talk row and the care tiles replaced by a card: `h3` "Couldn't reach {name}", `bodySm` "{name}'s fine, just out of sight. Check your connection and try again.", secondary "Try again" with a refresh icon |
| Action failed | Saving an action fails         | Roll the needs back; bubble says "Oops, I dropped it. Try again?"; `warning` haptic                                                                                                                                                                                              |

A failed load is never shown as empty or zeroed needs.

**Interactions**

- Feed / Play / Pet update needs optimistically, animate bars on `smooth`, swap the bubble to the reaction line, recompute header and mood (image crossfades), then save. Haptic per Shared logic. No cooldowns.
- Tap the pet: random local line, press to 0.98, `select` haptic, no stat change.
- Talk: hold or tap the mic, or type instead; see "Talking (on Home)".
- Refetch needs when the app returns to the foreground.

**Dog variant**: Biscuit art (floppy ears), and the dog lines from Shared logic.

**Changed 2026-10-01 (as built, M5 Decision 6):**

- The bubble has a fixed three-line space above the pet and grows upward, so the pet and the needs panel never move. (Changed 2026-10-02: no fixed space; the bubble sits beside the head and grows upward, clear of the pills. The pet, the pills and the controls still never move when the line changes.)
- **Care buttons have three looks.** (Changed 2026-10-02: the looks are on the slim tiles, in each button's own colour; see "Care tiles".) _Wanted_: the lowest need is low and this action helps it (`brandDim` + 1.5pt `brandInk` border, the icon badge filled `brandInk`). _Normal_: `surface2`, `borderSoft`, amber icon and label. _Can't help_ (Feed at hunger ≥ 90, Play at energy < 15): `well`, tertiary icon, still tappable. Amber means "wanted" only. Energy has no button.
- **After an action**, something floats up from the pet and fades: hearts (Pet), fish for a cat or bones for a dog (Feed), stars bursting sideways (Play), a sleepy "z z z" (Play when too sleepy). An action that helped shows the `happy` face for 900ms. Under Reduce Motion nothing travels. Colours: `art.pet.fx`.

**The notes ask (v2, added 2026-10-04,** [v2-notifications-requirements.md](../features/v2-notifications-requirements.md) **R13–R14).** After the server confirms a Feed, Play or Pet, and only while iOS has never been asked, the bubble keeps the reaction line and adds `label` in `brandInk` "Tell me when {name} misses you?" with two `sm` buttons: primary **Yes** and ghost **Not now** (each 44pt with its hit slop; the bubble itself is no longer one button). VoiceOver announces the question. Yes opens the iOS prompt; the pet then says "Yay! I'll send you a note when I miss you." (allowed, `success` haptic) or "That's okay. I'll keep your spot warm here." (refused). Not now: "Okay! Maybe another time." It asks at most twice, the second time only after a care at least 3 days later, and never at launch or before the first care. Any new line in the bubble drops the ask. "Try again" and the memory row only follow talking, so they never share the row with it.

**Events**: `home_viewed`, `home_load_failed`, `home_retry_tapped`, `pet_action_taken`, `pet_action_failed`, `pet_tapped`, `need_info_opened`, `tab_selected`, and the talk events in "Talking (on Home)". The notes ask adds `notification_prompt_shown`, `notification_prompt_answered`, `notification_permission_result`, and `notification_tapped` when a note opens the app (which lands on Home).

## Talking (on Home)

> **Changed 2026-10-01 (product.md, "Talking"; roadmap M6):** talking is by voice on Home, with
> the reply in the pet's bubble. This replaces the Talk tab, its chat screen and its history.
> Sizes, the mic's exact place and the listening pose are settled in
> `features/m6-talk-requirements.md`; copy marked _draft_ is for Mert to adjust.

It should feel like talking to {name} in the room, not to a chatbot: the pet stays in view,
listens while you speak, and answers in its bubble. There is no conversation on screen, only
the last thing each of you said.

**Layout** (additions to Home; the pet, the pills and the care tiles never move)

1. **Mic button** (new `TalkButton`), under the pet, above the care tiles: round,
   `brandGradient`, `onBrand` mic icon, label "Talk to {name}", hint "Hold to talk, or tap to
   start and stop".
2. **Type instead**: a small ghost `IconButton` with a keyboard icon beside the mic, label "Type
   instead". It opens a one-line `TextInputField` in place of the mic row (placeholder "Say
   something to {name}", return sends, 280 characters and **20 words** at most), which rides the keyboard. (**Changed 2026-10-02**, Mert: 20 words a message, spoken or typed. The field takes no 21st word and a paste is cut to its first 20; from 15 words a `caption` under it counts "17 of 20 words", in `brandInk` at 20. The server refuses more than 20 too.)
3. **Your words**: while listening, and until the reply lands, what you said shows in a chip
   just above the mic (`surface2` with `brandBorder` and the card shadow, so it reads over the
   pet; `caption`, centred, two lines at most, the start cut off with an ellipsis as it grows;
   **changed 2026-10-02**: smaller, 12pt by 6pt padding and at most 78% wide, was `bodySm`).
4. **Count** (free users with 3 or fewer left only): a 22pt badge on the mic's shoulder,
   `surface2` with `brandBorder`, the number in `brandInk`; at 0 the same badge holds a lock. No text about the limit on Home
   (Mert, 2026-10-02).

**Interactions**

- **Hold** the mic: `press` haptic, listening starts, the pet takes its listening pose, your
  words appear live. **Release** sends. **Slide away** from the mic before releasing cancels
  (the chip reads "Cancelled" and fades). Listening stops by itself at 15 seconds or at the
  20th word, whichever comes first, and sends (the first 20 words).
- **Tap** the mic (a quick press): listening starts and stays on; tap again to send. Same
  15-second cap. This is also the VoiceOver path.
- **First press ever**: the system asks for the microphone, then speech recognition, never at
  launch. Refused, or recognition unavailable: the mic row becomes the type-instead field, with
  `caption` "The microphone is off for Kinpaw. You can type, or turn it on in Settings." (draft).
- **Sending** (spoken or typed): the bubble shows `TypingPaws`; the mic and the field refuse
  until the reply lands. The app sends a message id it generated, so a retry never counts twice.
- **The reply**: the bubble shows it; needs, header and mood update from the server's answer;
  the pet makes a short sound for its mood (`expo-audio`, respects the silent switch); `success`
  haptic and hearts when a need rose, `press` otherwise. After `harsh`, the `sad` face for a
  moment and no burst.
- **Its voice (v2, added 2026-10-06,** [v2-voice-requirements.md](../features/v2-voice-requirements.md)**):**
  the reply is read aloud in {name}'s voice, picked by species and personality and played 1.15×
  faster without pitch correction, so it sounds small. **Text and voice arrive together**
  (changed 2026-10-06, Mert; was text first, voice 2–3 s later): the paws stay in the bubble
  until the voice is ready, at most 3 s, after which the text shows and a slow voice follows.
  While a slow voice is still on its way after the text, a light runs around the bubble's edge
  (one lap per 1.4 s; a still, dim edge with Reduce Motion). While it speaks (changed 2026-10-06,
  Mert; was the bars under the line), the edge turns the brand gradient with a soft glow
  breathing around it, and a brand-gradient badge with the speaking bars in `onBrand` sits on the
  bubble's top edge; the line stays just words. The pet's eyes
  move (quick looks at you and up at its words, every 0.6 s; still with Reduce Motion). Through
  the speaker, never the earpiece; a spoken message is answered aloud even with the silent switch
  on, a typed one follows the switch. Nothing shows if it fails or a daily limit is reached: the
  text stands. Holding the mic, a new reply, leaving Home
  or the app going to the background stops it. Not played with VoiceOver on (VoiceOver reads the
  reply). Off in Settings ("{name}'s voice"): nothing is asked for. After 5 voiced replies in a
  day (20 with Plus), replies come as text, and the first time that day an `info` toast
  says "I'm out of voice for today. I'll keep writing!" Events: `voice_played`,
  `voice_stopped`, `voice_failed`, `voice_limit_reached`; `talk_reply_voiced` first-party.
- **A suggested action** (from the reply) gives that care button the _wanted_ look until it is
  used or the next message, when it can help.
- **Short memory**: the app keeps the last three exchanges in memory and sends them with each
  message; nothing is kept when the app closes.

**TalkButton states**: idle (gradient), listening (gentle pulse; still under reduced motion,
with "Listening" announced), sending (disabled, `well`), limit reached (`well`, tertiary icon,
still tappable: it repeats the all-talked-out line).

**TypingPaws** (new): three 14pt paw prints in `brandInk` inside the bubble. Each fades 30% →
100% and lifts 2pt on a 1.2s in-out loop, 0.2s apart. Reduced motion: still, at 70%. Announces
"{name} is thinking".

**States**

| State         | When                                          | What shows                                                                                                                                                                               |
| ------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listening     | Mic held or tapped on                         | Listening pose; your words live in the chip; the mic pulses                                                                                                                              |
| Nothing heard | Released with no words                        | Bubble: "Hm? Say that again?" (draft). Not counted                                                                                                                                       |
| Thinking      | Waiting for the reply                         | `TypingPaws` in the bubble; your words stay in the chip                                                                                                                                  |
| Replied       | Reply arrives                                 | The reply in the bubble; needs, face, sound, haptic; the chip fades                                                                                                                      |
| Reply failed  | Error, or no reply in 20s                     | Bubble: "{name} dozed off mid-thought… try again?" with a "Try again" row (the bubble's `onReply` row), which resends the same words. Not counted                                        |
| Not connected | The model can't be reached                    | Bubble: "I'm a bit sleepy… try again in a moment?" (draft), with "Try again". Not counted                                                                                                |
| Limit reached | Free count hits 0                             | Bubble: "I'm all talked out for today. Let's talk more tomorrow?" (draft); the mic keeps its look with a small lock badge on its shoulder, and pressing it opens the paywall. Care works |
| Mic off       | Permission refused or recognition unavailable | The type-instead field, with the caption above                                                                                                                                           |

Premium users never see the counter or the limit.

**AI brief** (for the server prompt): speak as {name}, a {species}; personality = the preset
and the six traits (1–10); knows its current needs and mood and mentions them naturally (hungry
→ asks about dinner); **one or two short sentences**; warm baseline, sassy allowed, never mean;
hurt but forgiving after harsh words; comforting, never hurt, when the person sounds upset;
never breaks character to talk about being an AI unless asked directly. The answer is
structured: `reply`, `intent` (see Shared logic, "What you say"), and an optional
`suggested_action` (feed, play or pet). The server checks it and caps its length; the model
never sets a need.

**Events**: `talk_started`, `talk_cancelled`, `talk_message_sent`, `talk_reply_received`,
`talk_reply_failed`, `talk_retry_tapped`, `talk_limit_reached`, `mic_permission_answered`,
`upgrade_tapped`.

**Remembered (v2, 2026-10-03,
[v2-memory-requirements.md](../features/v2-memory-requirements.md) R15).** When a reply kept a
fact, the bubble's action row under the reply reads "✦ {name} will remember that" (Sparkles
icon, brand ink, the same row "Try again" uses), and the whole bubble opens the pet's details,
where "{name} remembers…" lists it. It stays while that reply is the bubble's line; the next
line, a failure or a new message replaces it. VoiceOver hears the reply, then "{name} will
remember that". Event: `memory_chip_tapped { kind }`.

When a reply brings a remembered fact up (R15b), the same row reads "{name}'s memory" with a
BookHeart icon ("From {name}'s memory"), and opens the list on that fact. A reply that both
keeps and brings up a fact shows "will remember that".

## Paywall (template restyle)

The template's `app/upgrade.tsx`, re-filled (built in M7). Store-review rules stay intact: price, period, trial terms, Restore, Terms of Use and Privacy links, the auto-renew text.

- **Opens from** (`lib/openPaywall.ts`, `trigger` param): the locked mic (`talk_limit`), a Plus option in Change look (`locked_look`), Profile's "See plans" (`profile_panel`), Change look's Redo from a photo on a free account (`photo_redo`). Never before the first conversation, never on launch. Onboarding's Plus options only explain.
- **Top**: close button; `PetArt` (happy, 120pt) on the `Glow` (a sparkle chip if there is no pet); `Text variant="display"` "More time with {name}", "Kinpaw Plus" under it.
- **Features** (`components/plus/plusFeatures.ts`, shared with Profile): "Talk with {name} as much as you like"; "Plus looks and rare builder options" (Calico, Blue merle, odd eyes, spots and more). "Room for more pets" stays off until more pets exist (product.md).
- **Plans**: the template's plan cards; in a development build without store products, preview plans marked "Preview prices — development build only".
- **Plus** (`usePlus`: the server's plan or the store's): "Kinpaw Plus · Thank you for looking after {name}" and a card "You have Kinpaw Plus"; "Manage in App Store" only for a store subscription, never a grant.
- **After purchase or a grant**: closing the paywall re-reads the plan; the count, the lock and the locked options disappear everywhere at once.
- **Events**: `upgrade_page_viewed` with `trigger` (the spec's `paywall_viewed`), plus the template's plan, purchase and restore events.

## You (template restyle)

> **Changed 2026-10-01 (product.md, "Structure and scope"):** the tabs are My pet · Profile ·
> Settings; there is no Talk tab (talking is on Home), and no appearance choice (the app follows
> the sky). Built in M7 as below.

**Profile**: `Text variant="title"` "Profile"; you, in a raised card that opens Edit profile (avatar with your photo or initials and an amber pencil badge, name, email, and an "Edit" pill; added 2026-10-02, [profile-edit](../features/profile-edit-requirements.md)); the **Kinpaw Plus panel** (`components/plus/PlusPanel.tsx`): free, a hero card with `h3` "Kinpaw Plus", the paywall's features and a secondary "See plans" (→ paywall, `source: profile_panel`); Plus, a selected card with a "Plus member" pill and no button; then **Your pet**: the 40pt portrait, "{name}" and the preset title, with a chevron to its details page.

**Settings**: Feel (Haptics `Toggle`; **"{name}'s voice"** `Toggle` with a speaker icon, added 2026-10-06 for v2's voice: subtitle "{name} says its replies out loud", on by default, a preference on this phone, `voice_changed`; **"Notes from {name}"** `Toggle` with a bell, added 2026-10-04 for v2's notes: subtitle "A note when {name} misses you, one a day at most"; with iOS permission refused it reads "Off in iOS Settings. Tap to open them" and opens the app's iOS settings page; turning it on before iOS was asked shows the iOS prompt; `notifications_changed`); Account ("Manage subscription" → the store's subscriptions page, only for a store subscription; Sign out); Help (Help & support, Terms of Use, Privacy Policy); Delete account, as store review requires; the app version in `caption`.

**Edit profile** (`app/profile-edit.tsx`, pushed from Profile; added 2026-10-02): a sky hero with your avatar (camera badge; tap to change the photo) and your pet beside it, "You & {pet} · N days"; Add or Change photo and Remove photo (the system photo library, no crop: the photo fills the circle from its centre; a spinner while it opens); the Name field (1–80, not empty); the pet greeting you by the name as you type; Save. The full contract: [profile-edit-requirements.md](../features/profile-edit-requirements.md).

**Events**: `upgrade_tapped` (`profile_panel`), `manage_subscription_tapped`, `profile_viewed`, `profile_edit_opened`, `profile_photo_picked`, `profile_updated` (the measure), `profile_update_failed`, `haptics_changed`, the template's account events.

## Pet details

**{name} remembers… (v2, 2026-10-03,
[v2-memory-requirements.md](../features/v2-memory-requirements.md) R16–R17).** A card after the
three "together" tiles:

- **Header:** "{name} remembers…" with "{count} of {cap}" on the right.
- **At most the 5 newest, read-only** (no ✕ here: facts are forgotten only on the full page,
  Mert 2026-10-03). Under them, a full-width secondary button with a BookHeart icon, "See all
  {n} and manage" (or "Manage what they remember" at 5 or fewer), which opens **{name}
  remembers** (`app/memories.tsx`, R16b):
  - a search field ("Search what they remember", at most 60 characters)
  - "{n} of {cap} kept", or "{m} found · {n} of {cap} kept" while searching
  - the rows, 20 a page, loading more as you scroll, with pull to refresh
  - empty: "Nothing yet…", or "Nothing {name} remembers matches "{search}"."
- **Rows, newest first:** a category icon (study, work, family, pets, hobbies, place, likes,
  goals, other), the fact, and for an event when it is ("Today", "Tomorrow", "Wednesday", "In
  12 days", "Was Friday").
- **Forget:** an ✕ on each row (VoiceOver: "Forget: {fact}") asks first: "Forget this?" /
  "'{fact}'. {name} won't bring it up again." / Forget (destructive) · Keep. Once confirmed,
  it leaves every list at once and comes back with a message if the server refuses.
- **From Home:** opened from Home's memory row, the fact it was about is highlighted.
- **Empty:** "Nothing yet. Tell {name} about your day: what {name} keeps shows up here, and you
  can make {name} forget anything."
- **Error:** a line and "Try again".
- **Full, free account:** "{name}'s memory is full: a new fact makes room by forgetting the
  least important." with "Plus remembers up to 100" (paywall, `memory_full`).
- **Events:** `memory_list_viewed { surface: card | page, count_bucket, full }`,
  `memory_searched { found }` (once a visit); `memory_deleted { from: 'list' }`,
  recorded by the server.

**Added 2026-10-01.** One pet's page, read-only, at `app/pet/[id].tsx` (one route per pet, so a second pet later gets its own). Opened by tapping the pet on Profile (the row gains a chevron). Pushed, with the standard `PageHeader` (back, the pet's name as the compact title).

1. Hero (290pt, `card` radius + 6, glass edge): the sky outside right now (`SkyScene` with its gradient, the sun or moon upper right), the lamp glow in the evening and at night, and `PetArt` 220pt in its current mood, rising in and breathing (`RiseAndBreathe`). Top left: a glass pill with a `brandInk` dot and the mood ("Feeling happy", "Feeling content", "Feeling a bit low", "Feeling sleepy"). No needs on this page.
2. The name in `display`, then its look in `body` `textSecondary` (`describeAppearance`: "A grey striped cat with amber eyes.").
3. Three equal tiles, content centred (icon disc, value, caption): **Home since** (the save date, "3 Oct 2026"), **Days together** (the first day is day 1, turning over at local midnight), and the **milestone** reached (First day, One week, One month, 100 days, One year) with the next one ("One month in 23d"); the milestone tile is in `brandDim` with a `brandBorder` edge.
4. Personality card: `Eyebrow` "Personality", the preset's title and description, or "Their own mix" / "Fine-tuned from {preset}." when the traits were tuned; then the six traits as read-only rows: a 28pt tinted disc with the trait's icon (heart, volleyball, bolt, compass, handshake, feather), the name, and a bar of five 8pt segments across the rest of the row, filled to the level in the trait's own colour (`art.traits`) over the same colour at 14%.
5. Looks card: `Eyebrow` "Looks", tags for the species and each attribute ("Grey fur", "Stripes pattern"); a Plus option's tag is `brandDim` with a sparkle. Under the tags, a small secondary "Change look" (M7) → **Change look**: at the top, **Redo from a photo** (v2, F1: Plus "1 left today" / "Used today. Another tomorrow."; free, a Plus pill that opens the paywall with `trigger: photo_redo`; the read shows inline as "Drawing {name}…" and lands in the editor unsaved with the photo on the stage; a photo of the other species asks "This looks like a cat": **Turn {name} into a cat** or **Keep {name} a dog**, the colours only); then the builder (the same stage, tabs, options and Surprise me as Make your own) on the pet's own appearance, the species fixed except by a Plus photo, "Save {name}'s look" and "Undo changes" under it. A free account's Plus option opens the paywall (`trigger: locked_look`); a Plus member's Plus options are unlocked. Saved: a toast "{name} has a new look" and back to the details.
6. Pinned below: large primary "Go to {name}'s room" with the arrow disc → Home.

States: loading (skeletons), error (`QueryErrorState`, retry), and a pet this account doesn't have ("This pet isn't here", Back). VoiceOver: the hero reads the name and the look in its mood; each tile reads "Home since: 3 Oct 2026"; each trait "Affection, 4 of 5".

Events: `pet_details_viewed` (`from: profile`), `pet_details_room_tapped`; Change look: `pet_look_change_opened`, `pet_look_changed`, `pet_option_locked_tapped` (`during_onboarding: false`), `upgrade_tapped` (`locked_look`, `photo_redo`), `pet_photo_redo_tapped`, `pet_photo_species_choice`, `pet_photo_read` and `pet_photo_kept` (`context: redo`).

## Tell me about you (v2)

> **v2 voice (added 2026-10-06, R17):** on the result, the pet's answer is spoken a beat after it shows, like a talk reply; Go home stops it.

> **Decided with Mert, 2026-10-04** ([v2-memory-requirements.md](../features/v2-memory-requirements.md)
> R18–R25, decisions 6–13). The visual reference is
> [`mockups/tell-me-about-you.html`](mockups/tell-me-about-you.html), direction **A · Stage**;
> where they disagree, this section wins. Copy marked _draft_ is Mert's to change.

> **Changed 2026-10-04, after Mert's first try on the iPhone.** These override the layout,
> Check and States below where they disagree:
>
> - **One page to tell the pet**, not Ask then Check: the pet (176pt, breathing) with its bubble
>   over its shoulder, the hints, then an always-editable card with the words (tap it to type;
>   "Hold the mic and talk, or tap here to type."; "8 / 60" under it), then the row ⌨ · mic ring
>   · ↺ (clear), a status line ("Hold or tap to talk", "Tap or let go to stop", "Talk again to
>   add more"), and **Send to {name}** with the consent line. While typing, the pet steps aside
>   for the keyboard.
> - **Recording again adds to the end** (up to 60 words in all); ↺ clears to start over.
> - **After a pause the words stay**: iOS 18 starts a new transcript after each pause, and the
>   app keeps the earlier pieces (`lib/transcript.ts`).
> - **Thinking, nothing caught and not connected stay on the same page**: the bubble shows the
>   paws, then "Tell me more about you sometime!…" (the words kept, Send again for the second
>   try), or "I'm a bit sleepy… try again in a moment, or let's do it later?" with a ghost "Ask
>   me later" under Send. After a recording the bubble says "Ooh, tell me more! Or send it when
>   you are ready."
> - **The result** (second pass, same day): Home's live sky behind it (its gradient, sun or moon
>   and life, and the lamp glow behind the pet in the evening and at night); the eyebrow and the
>   pet's line at the top; the pet big in the middle (212pt, 168 on short phones), breathing and
>   bouncing as each fact lands. The facts alternate above and below it in rows of at most two,
>   evenly spaced and leaning left and right, so they never touch; each pops out of the pet in
>   turn and bobs gently (caption, a 24pt icon disc, `surface2` with `brandBorder`). **Read-only:
>   no ✕** (Mert: no requests while the moment plays); under Go home, "Something not right? See
>   or forget any of these on {name}'s page, anytime."
> - **After sign-up, the intro comes straight after the email code, before Home**: the app shows
>   it as a full-screen layer over everything as soon as the pet is saved, and opens Home (puts
>   the pet in the cache) only when it ends: sent, skipped or "Ask me later". Not a navigation
>   (one was lost during the switch to Home) and not a Modal (closing it crashed). The offer and
>   the button show only on a fresh `intro_due`, never on the stale one while it is asked again (a navigation while the app switched from sign-in to Home
>   was lost on a second account), and **Home's one-time offer is remembered per pet**, so
>   another account's pet on the same phone is offered it too.
> - The hint "Your name" also lights on "My name is…" with a capital.

The moment the pet starts knowing its person. Right after the pet is saved, before Home, the pet
asks to know them; they talk (or type) up to 60 words, check the words, send, and watch the
facts it will remember pop in. It should feel like a moment with {name}, never like a form: the
pet is the biggest thing on screen and asks in its own voice. Skip is always there, and quiet.

**Entry points** (`app/intro.tsx`, in the with-pet stack, presented over the tabs, no Back):

- **After saving the pet** (the save step on sign-in): when `GET /pet` says `intro_due`, replace
  the stack with the intro instead of Home. `intro_viewed { entry: 'after_signup' }`.
- **A pet from before** the intro (`intro_due` and no record on the phone of the offer): once,
  Home's first bubble line is "I don't know much about you yet. Will you tell me?" (_draft_)
  with the action row "✦ Tell {name} about you", which opens the intro. The phone remembers
  the offer (AsyncStorage `kinpaw:introOffered:v1`), so it shows once per install.
  `intro_viewed { entry: 'existing_pet' }`.
- **Pet details**, while `intro_due`: a row above "{name} remembers…", "Tell {name} about you"
  (secondary, Sparkles icon). `intro_viewed { entry: 'pet_details' }`.

**Layout** (Ask; the other states change only what the table says)

1. Ground: `bg` with grain; `RoomGlow` (`brandGlow`) behind the pet, larger than Home's.
2. Top bar at the safe area: **Skip** on the right, `label` in `textSecondary`, 44pt target,
   no button chrome.
3. `Eyebrow` "One last thing", then `title` in the display face "Tell {name} about you" (two
   lines at most).
4. Stage: `PetArt` 200pt, `happy`, breathing (`RiseAndBreathe`); `PetBubble` upper right,
   pointing down-left, with "I want to know you! Tell me a little about yourself."
5. **Hint chips**, centred, wrapping to two or three rows: Your name · Study or work · Pets ·
   Hobbies · Coming up, each with its icon (User, GraduationCap, PawPrint, Puzzle, Calendar).
   `caption`, `textSecondary`, `borderSoft` edge on `surface` at 60%. They are ideas, not
   buttons: not tappable, read by VoiceOver once as "Ideas: your name, study or work, pets,
   hobbies, something coming up".
6. **Mic row** at the bottom: the `MicButton` (64pt, `brandGradient`) inside an 88pt
   **progress ring** (3pt, `tintTrack` under `brandInk`), "Type instead" (keyboard
   `IconButton`, 46pt, `surface`) to its left. Under the mic, `label` "Hold to talk", and a
   `caption` in `textTertiary` "Up to 60 words · about 20 seconds".

**While listening**

- The ring fills toward 60 words; a 22pt badge on the mic's shoulder reads "37 / 60" in tabular
  figures (`surface2`, `brandBorder`, `brandInk`). At 60 listening stops by itself and goes to
  Check.
- **Hints light up** as each is said: a simple word match on the phone (below) turns a chip to
  `brandDim` with a `brandBorder` edge, `brandInk` text, and a Check icon in place of its own,
  on `smooth`, with a `select` haptic. Nothing depends on it: a missed topic just stays unlit.
- The title gives way to the eyebrow "Listening…" so the words fit; the bubble shows
  `TypingPaws`; the pet takes its listening pose.
- **Your words** in the `WordsChip` (Home's) between the hints and the mic, the start cut off
  as it grows.
- Hold to talk (release ends), or tap to start and tap again to end, as on Home. Slide away
  cancels and returns to Ask.

**Hint matching** (`lib/introHints.ts`, whole words, any case, on the live words):

| Hint          | Lit by (examples, plural and -ing forms too)                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Your name     | "my name is", "I'm called", "call me", or "I'm / I am" followed by a capitalised word                                                               |
| Study or work | study, student, school, university, college, class, exam, work, job, office, engineer, developer, designer, teacher, doctor, nurse, manager, intern |
| Pets          | dog, cat, puppy, kitten, pet, bird, fish, rabbit, hamster, horse, parrot, turtle                                                                    |
| Hobbies       | hobby, play, love, like, enjoy, music, guitar, piano, sing, paint, draw, read, books, game, gaming, sport, football, run, gym, climb, cook, dance   |
| Coming up     | tomorrow, tonight, next week, this weekend, soon, a weekday name, exam, interview, trip, birthday, wedding, holiday, concert                        |

**Check** (after listening, or after typing)

- `Eyebrow` "Check your words", `h3`-sized display "Is this right?".
- The words in a `well` card, `body` `textPrimary`, with "{n} of 60 words" under them in
  `caption`. **Edit** makes the card a multi-line field (the keyboard's return ends editing;
  60 words at most, a paste cut to its first 60, the counter in `brandInk` at 60).
- Two secondary buttons side by side: **Record again** (RotateCcw) and **Edit** (Pencil). Neither
  makes a request.
- The pet, small (96pt), with the bubble "Ooh, tell me!" (_draft_).
- Pinned at the bottom: large primary **Send to {name}** with the arrow disc, and under it in
  `caption` `textTertiary`: "Your words go to our AI to find what to remember. Audio stays on
  your phone." (R20: the consent before personal data leaves the phone.)

**Type instead**: opens Check directly with an empty field focused (placeholder "I'm… I study…
I have a dog called…", _draft_); the hints stay visible above it and light up as they type.

**States**

| State                      | When                                      | What shows                                                                                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ask                        | Opened                                    | As the layout                                                                                                                                                                                                                                                            |
| Listening                  | Mic held or tapped on                     | As above                                                                                                                                                                                                                                                                 |
| Nothing heard              | Released with no words                    | Back to Ask; the bubble: "Hm? I didn't catch that. Try again?" (_draft_)                                                                                                                                                                                                 |
| Check                      | Words ready, or typing                    | As above                                                                                                                                                                                                                                                                 |
| Thinking                   | Send pressed, until the answer (≤ 20s)    | Eyebrow "Getting to know you", the stage's glow breathes, `TypingPaws` in the bubble, four chip-shaped shimmers where the facts will land, `caption` "{name} is thinking about everything you said…". No Skip                                                            |
| Result                     | The server kept at least one fact         | Eyebrow "{name} will remember"; the pet (112pt, `happy`) beside its bubble with the server's `line`; the facts pop in as chips one by one (below); primary **Go home**; `caption` "See or forget these anytime on {name}'s page."                                        |
| Nothing caught             | Kept nothing, an attempt left             | Eyebrow "Hmm", display "{name} didn't catch much"; the bubble "Tell me more about you sometime! Your name, what you do, who you love?" (_draft_); primary **Try once more** (back to Ask, the words cleared); text button **Maybe later** (Skip, `step: 'empty_result'`) |
| Kept nothing, last attempt | Kept nothing, no attempt left             | The server's line in the bubble; primary **Go home**                                                                                                                                                                                                                     |
| Not connected              | 503, a timeout, or no network             | Eyebrow "Not now", display "{name} will ask you later"; `sleepy` pet, bubble "I'm a bit sleepy… let's do this later, okay?" (_draft_); primary **Go home**; `caption` "Nothing was used up. {name} asks again from their page." The step stays open                      |
| Went wrong                 | 500 (the model answered unusably)         | As Not connected; also nothing used                                                                                                                                                                                                                                      |
| Closed                     | 409 `intro_closed` (another phone did it) | Straight to Home, no message                                                                                                                                                                                                                                             |

**Fact chips** (Result): pill, `surface` with a `brandBorder` edge, the category icon (the
memory list's: study GraduationCap, work Briefcase, family Users, pets PawPrint, hobbies Puzzle,
place MapPin, likes Heart, goals Target, other Lightbulb) in `brandInk`, the fact in `label`
`textPrimary`, and an ✕ disc (VoiceOver "Forget: {fact}") that deletes it at once through
`DELETE /pet/memories/{id}?from=intro`, with no confirmation (it was just said; the chip
leaves on `smooth`). An event shows its day after a middle dot ("Anatomy exam · Friday").
Wrapping, left-aligned, never more than 8.

**Motion**

- Ask: the pet rises in from an 8pt blur on `gentle`, the bubble one stagger step later, the
  hints fade up together, the mic last. Reduced motion: all at once.
- Hints light on `smooth`. The ring advances on `smooth` per word.
- Result: each chip rises 10pt and scales from 0.9 on `gentle`, 140 ms apart; one `success`
  haptic as the first lands. Reduced motion: all chips at once, still one haptic.
- Haptics: hold the mic → `press`; a hint lights → `select`; Send → `press`; Result →
  `success`; Not connected or Went wrong → `warning`.

**Accessibility**: 44pt targets; Dynamic Type capped by role; the title and the bubble are read
in order ("Tell {name} about you. {name} says: I want to know you…"); the mic's label is
"Talk to {name}", hint "Hold to talk, or tap to start and stop", value "37 of 60 words" while
listening; a lit hint announces nothing (no chatter while they speak); the Result announces
"{name} will remember {n} things", then each chip as it lands is focusable in order. Mic
permission is asked on the first press, as on Home; refused, Type instead opens with the same
caption as Home's.

**Events**: `intro_viewed { entry }`, `intro_recorded { input, length_bucket }`, `intro_sent
{ input, attempt }`, `intro_failed { error_kind }` (app); `intro_completed`, `intro_skipped
{ step }`, `memory_saved { source: 'intro' }`, `memory_deleted { from: 'intro' }` (server).

## Friends (v2)

> **Added 2026-10-06** ([v2-friends-requirements.md](../features/v2-friends-requirements.md), the
> full contract). The second tab, `app/(tabs)/friends.tsx`.

**Friends tab**: `Text variant="title"` "Friends". Empty: your pet, happy, "See your friends'
pets", "Show them your code, or scan theirs with your iPhone's Camera.", then **Show my code**
(primary) and **Add a friend** (secondary), full width. With friends: the two as small buttons, then
one raised card per friend, newest first (`components/friends/FriendRow.tsx`): the pet's portrait
in its mood, its name, "{name}'s cat" and the mood line, a chevron. Pull to refresh; loading
skeletons; a failed load is the error state with Try again. At 50 friends, Add a friend is
disabled with a line saying so.

**My code** (`components/friends/MyCodeSheet.tsx`, a sheet): "A friend scans this with their
iPhone's Camera, or types the code in Kinpaw.", the QR of `cozypet://friends/add?code=…` dark on a
light card (`art.qr`) with your pet at its corner, the code as `KP7X-M3QD`, **Share my code** (the
system share sheet: the code first, then the link) and **New code** (ghost), which asks first:
"Make a new code? Your old code will stop working. Friends you already have stay."

**Add a friend** (`app/friends/add.tsx`, pushed; also where a scanned or shared link lands): a
Friend code field ("KP7X-M3QD", capitals, 8 characters and the dash) and **Find friend**. With a
code, "Finding your friend…", then the preview: their pet in its mood, "Add {name} and {pet}?",
"{name}'s cat. {line}", "You'll see each other's pets. Nothing else is shared.", **Add friend**
and **Not now**. Refusals in the coral line: "That's your own code. Ask your friend for theirs.",
"That code didn't work. Ask your friend to show it again.", "You can have up to 50 friends.",
"They can't add more friends right now.", "Couldn't reach Kinpaw just now. Try again." A link
that arrives before there is a pet opens this screen once Home has shown.

**A friend's pet** (`app/friends/[id].tsx`, pushed): `PetHero` (shared with Pet details) under
your sky, the pet's name as `display`, "{name}'s cat. {look}.", the line ("Luna's a bit hungry."),
the four needs as words in a 2 × 2 grid (Low in coral, Okay, Good), "Friends with {name} since
{date}.", and **Remove friend** (ghost), which asks first: "Remove {name}? You'll stop seeing each
other's pets. To be friends again, one of you scans the other's code." A friendship that ended
while open says "You're not friends any more".

**Events**: `tab_selected { tab: 'friends' }`, `friend_code_shown { source }`,
`friend_code_shared`, `friend_code_reset`, `friend_add_opened { source }`, `friend_add_failed
{ reason }`, `friend_pet_viewed { mood }` (app); `friend_added { source, side, friend_count }`,
`friend_removed { friend_count }`, `friends_viewed { friend_count }` (server).

## Out of scope and open questions

**Not in v1** (leave room, build nothing): animated or 3D pet, photo album, long-term memory, a visible conversation history, the pet speaking aloud, other languages, streaks and notifications (v2 adds daily notes in the pet's voice: "Notes from Mochi" in Shared logic), accessories, multi-pet switcher, room backdrops (a v2 premium candidate).

**Open questions**

- [x] How many free messages per day, and when does the count reset? 10, at local midnight (product.md).
- [x] How fast does each need decay while away, and how does energy recover? Settled in M5 (product.md).
- [x] If someone signs in with a draft pet and the account already has a pet, which one wins? The existing pet (product.md).
- [ ] Final app name to replace Kinpaw.
