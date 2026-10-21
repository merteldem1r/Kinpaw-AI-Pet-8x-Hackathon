# Your pet from a photo — requirements

Agreed with Mert on 2026-10-04. The UI was chosen from mockups (picks A1, B1, C2, D1, E2, F1,
G1; the mockup page is in the session scratchpad, not the repo). Plan:
[`v2-pet-from-photo-plan.md`](v2-pet-from-photo-plan.md). The brainstorm is in
[`../ideas.md`](../ideas.md) ("Your real pet from a photo").

> **Temporary dev aid (2026-10-06):** a "Dev: reset photo tries" link under Make your own on
> Start, development builds only, gives a test phone its 2 tries back (a new install id). To be
> deleted: [`docs/memory/dev-reset-photo-tries.md`](../../memory/dev-reset-photo-tries.md).

## What is there today

- **Start** (`app/(create)/start.tsx`) offers two cards: **Make your own** (the featured card,
  with its cycling built pets) and **Choose a friend**, which opens `look.tsx` (the 8 ready-made
  looks, 4 per species). A Cat / Dog control sits above both.
- **The catalog** (`packages/contract/src/v1/appearance.ts`) is closed lists of ids: species and
  nine attributes (fur 9, pattern 9, accent, white 5, trim 9, eyes 8, ears 5 per species, body 5,
  tail 5), with Plus flags, `appearanceSchema`, `usesPremium`, `withSpecies`. Any valid
  appearance is drawable by `PetArt` (app) and `PetSvg` (site) through `petDrawing`.
- **The builder** (`PetBuilder`) opens on any appearance: Make your own during Create, Change
  look (`app/change-look.tsx`) after sign-in. During Create a Plus option only explains; in
  Change look it opens the paywall.
- **The pet draft** (`lib/petDraft.ts`) is kept on the phone. `path` is `'choose' | 'build'`
  and defaults to `'choose'`; `step` includes `'look'`.
- **AI on the server** follows one pattern (`server/talk/`): a provider interface, a real
  provider called with `fetch`, a stub for tests and keyless development, a Zod check on the
  answer, one retry when the answer's shape is refused, and a row in `ai_usage`.
- **Routes** are built from `@app/contract` endpoints by `createAppRoute`, with `auth: 'user'`
  (bearer token) or `'public'`. `recordUserEvent` accepts a null user id.
- **Native modules already in the app:** `expo-image-picker` (photo library and camera, with
  purpose strings), `expo-secure-store` (the Keychain). **No native rebuild is needed.**
- `FAL_KEY` is in `apps/web/.env.example` (empty) and Mert's `.env.local`, but not yet declared
  in `apps/web/src/lib/env.ts`, so `check:env` fails until it is.

**Two premises corrected while researching:**

1. `PATCH /api/app/v1/pet` refuses a species change ("A pet keeps its species"), and Change
   look keeps the species. Turning a Plus member's cat into a dog from a photo (agreed) needs
   that rule changed on the server (R27).
2. The memory spec decided "the model is only ever called for a signed-in person". This
   feature is a deliberate exception: Create runs signed out, so the creation read is a public
   route, protected by the limits in R19–R25 instead of a sign-in.

## Problem

Most people who would enjoy Kinpaw have, or had, a real cat or dog, and the builder can't make
that pet quickly: nine attributes and many options stand between them and "that's my pet". The
ready-made friends are generic. Making the pet from one photo turns the first minute into a
"wow" and makes the pet theirs from the start.

## Success criteria

- **People choose it:** the share of `pet_create_path_selected` with `path: photo`.
- **It works:** `pet_photo_read` with `result: ok` over all reads (target: 80%+ of reads with
  a pet in them).
- **It's accurate:** `pet_photo_confirmed` with `choice: keep` (straight to Name) over all
  reveals, and the median `changed_count` on `pet_photo_kept` (target: 2 or fewer attributes
  changed by the person).
- **It costs what we expect:** `ai_usage` rows with `provider: fal`; reads per day stay under
  the app-wide cap.

## Requirements

### Start and the photo sheet (Create)

R1. Start shows two cards. **From a photo** first, as the featured card: its stage shows a
photo turning into a drawn pet (a polaroid, an arrow, the pet), a "Your real pet" badge, the
title "From a photo" and the line "Show us your pet. We'll draw it." **Make your own** second,
exactly as it is today (same stage, pets, motion and copy). Choose a friend is removed.

R2. The Cat / Dog control stays on Start and applies to Make your own only; From a photo takes
the species from the photo.

R3. Tapping From a photo opens a sheet over Start (B1): the title "Show me your pet", the line
"One cat or dog, face to the camera, in good light.", **Take a photo** and **Choose from
library** rows, the tries left as two dots ("2 tries", "1 try left"), and the AI note naming the
service: "Your photo goes to Google's Gemini, through fal.ai, our AI service, so it can see your
pet's colours. Kinpaw never saves it, and it's only used to draw your pet." **Changed
2026-10-05** (store review, Apple 5.1.2(i): name the third-party AI and get explicit permission
first): the first photo on a phone asks in the sheet, "Send your photo to the AI?", with **Not
now** and **Allow**; the yes is kept on the phone.

R4. The library opens the system photo picker (no permission prompt on iOS 14+). The camera
asks for camera permission on first use; refused, the sheet says so and keeps the library row.

R5. The photo is sent as a JPEG (HEIC converted on the phone), shrunk on the phone to 1536 px on
its long side (`expo-image-manipulator`), a few hundred KB, at most 3 MB. A photo the phone can't
open says "I couldn't open that photo. Try another one."

### The read (server)

R6. One model call per read: **Gemini 2.5 Flash through fal.ai** (`FAL_KEY`), behind a
`PhotoReader` interface with a stub for tests, CI and development without a key. In production
without a key the route answers `not_configured`. The model id is configurable.

R7. Before the call, the server decodes the image, rejects anything that isn't an image,
shrinks it to 1024 px on the long side and re-encodes it, which drops all metadata (GPS
included). The photo is never written to disk, the database, storage or the log.

R8. The prompt gives the model every attribute as a closed list built from the catalog, each
option with a short description of what it looks like, a few real-breed examples (tuxedo,
calico, Siamese, tabby, husky, beagle, Doberman, golden retriever), and asks it to describe what
it sees first, then pick. Adding an option to the catalog without a description fails a test.

R9. The answer is one JSON object: `verdict` (`ok`, `no_pet`, `several`, `unclear`), `seen` (a
short description, used only for checking and never stored), `species`, and per attribute an id
or `unseen`. It is checked with Zod; a refused or unparsable answer is tried once more if time
allows, then fails. (A per-attribute confidence was dropped while building, 2026-10-04: nothing
would have read it.)

R10. `unseen` attributes get the species' sensible default (pointy ears for a cat, floppy for a
dog, long tail, round body, Matching accent, no white markings, white trim). The result must
pass `appearanceSchema`.

R11. **Plus options for anyone not Plus** (everyone during Create) become the nearest free
option, from one table in `@app/contract`:

| Plus option   | Becomes                                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patches       | Solid with Bicolour white markings; on a white coat, the patches' colour becomes the coat (a white-and-ginger calico stays white and ginger; found on a real calico, 2026-10-04) |
| Spots         | Solid                                                                                                                                                                            |
| Tortie        | Tabby with a Ginger marking colour                                                                                                                                               |
| Points        | Solid (the coat colour kept; a Solid coat has no markings, so no free option darkens the face and paws)                                                                          |
| Brindle       | Stripes                                                                                                                                                                          |
| Van           | Bicolour                                                                                                                                                                         |
| Ice, Odd-eyed | Blue                                                                                                                                                                             |
| Tufted, Lynx  | Pointy                                                                                                                                                                           |
| Buff          | Chonky                                                                                                                                                                           |

The answer lists each swap (`{ key, from, to }`) so the app can say so (R14).

R12. The response: `outcome` (`read`, `no_pet`, `several`, `unclear`, `limit_reached`), the
`appearance` (on `read`), the `seen_labels` for the chips (from our labels, never the model's
words), `swapped`, and `tries_left`.

### Reading, reveal and errors (Create)

R13. While reading (C2): the photo as a polaroid with a light sweeping across it, above the
sky stage, and "Drawing your pet…". The stage shows a soft glowing outline while waiting; when
the answer comes back, the drawn pet is revealed from the bottom up (about 900 ms). Reduced
motion: no sweep, and the pet appears at once. VoiceOver: "Reading your photo". The phone waits
up to 25 seconds.

R14. The reveal (D1): "Is this your pet?", the pet on the sky stage (happy) with the photo as
a small thumbnail top-left, chips for what was seen (fur colour, pattern, white markings, eyes,
ears), and the G1 note when something was swapped ("Your pet's coat looks Tortie, a Plus
pattern. We used Tabby for now; you can switch with Kinpaw Plus later in Change look.").
**That's them!** continues to Name; **Adjust the look** opens Make your own on that appearance,
with the thumbnail at the top right of the stage and the note "Made from your photo. Change
anything that's off."

R15. When no pet, several animals or an unclear photo (E2): the pet's bubble says why ("Hmm, I
can't spot a cat or dog in that one. A clearer photo of their face?", "I see more than one
friend there! A photo of just one?", "That one's a bit blurry. Another try?"), a sad pet on
the stage, the tries left, **Try another photo** and **Make your own instead**.

R16. Out of tries: the bubble "That was our last photo together. Let's make your pet by hand,
I'll help!", a sleepy pet, "No tries left on this phone", and **Make your own**. The From a
photo card on Start then shows "Used" and opens this screen.

R17. Our own failures (timeout, no connection, the model unreachable or answering in a shape we
can't use) say "I couldn't look at that just now. Try again?" and **use no try**.

R18. The photo is never kept: not in the draft, not after the pet is saved. The thumbnail is
the picker's temporary file, removed when the reveal or builder is left for Name.

### Limits and abuse

R19. **Signed out, Create: 2 reads per iPhone, ever.** The phone makes a random install id
once and keeps it in the Keychain (survives deleting the app) and sends it with each read.

R20. Only reads the model answered count (`read`, `no_pet`, `several`, `unclear`). A try is
reserved before the call, so two reads at once can't both pass, and released when our side
fails (R17).

R21. **Per network:** at most 6 counted reads per IP address a day, whoever is asking (a
household with several phones still fits).

R22. **App-wide:** at most `PHOTO_DAILY_CAP` reads a day (default 300, about $0.30). Past it the
route answers "Photo reading is resting for today" and the app offers Make your own. The cap
resets at midnight UTC.

R23. Install ids and IPs are stored only as keyed hashes (HMAC with `PHOTO_HASH_SECRET`), never
as they are. Unset in production, the route is closed.

R24. Images over 3 MB are refused before they are read into memory; only JPEG, PNG and WebP are
decoded. The whole body stays under Vercel's 4.5 MB request limit, so the refusal is our JSON
413, not the host's (lowered from 8 MB on 2026-10-05; a contract test holds it).

R25. Logs record the outcome, latency and a failure reason only: never the image, the model's
words or the hashes.

### Redo from a photo (signed in)

R26. Change look (F1) gains a row at the top: "Redo from a photo".

- **Free:** the row shows a Plus pill. Tapping it opens the paywall (`trigger: photo_redo`).
  A free account gets the photo only when creating its pet.
- **Plus:** the row says "1 left today" or "Used today". Tapping it opens the same sheet as
  R3, without the tries dots. Plus reads keep Plus options (no swap).
- Limit: **1 read per local day** (the phone's time zone, as talking), counted as R20.

R27. The result opens in the Change look editor, unsaved, with the thumbnail and "Made from
your photo". Nothing changes until Save. Leaving without saving still uses the day's read.

R28. If the photo's species differs from the pet's, a dialog asks first: "This looks like a
dog. Turn Mochi into a dog? Mochi keeps their name, personality and memories. Only the look
changes, and nothing is saved until you tap Save." **Turn Mochi into a dog** applies the
whole result; **Keep Mochi a cat** applies the colours and markings (fur, pattern, accent,
white, trim, eyes) to the cat and keeps its ears, body and tail. `PATCH /api/app/v1/pet`
allows a species change for a Plus account only.

R29. The redo route checks Plus on the server from the profile (`plan_type`), never from the
app.

### Clean up

R30. `look.tsx` and the Choose a friend card are removed. The 8 looks stay in the catalog
(Welcome and sign-in draw them). A draft resumed on the `look` step opens Make your own; an old
`path: 'choose'` reads as `'build'`; the draft gains `path: 'photo'`.

R31. The privacy page says photos are sent to our AI provider (Google's Gemini through fal.ai)
to read the pet's colours, are not stored, and are not used for anything else.

## Events

Registered with the `events` skill before the screens that fire them.

**App** (`apps/mobile/lib/analytics.ts`, PostHog):

| Event                         | When                                   | Metadata                                                                                                                  |
| ----------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pet_create_path_selected`    | A Start card (existing; gains a value) | `path: 'photo' \| 'build'`, `species`                                                                                     |
| `pet_photo_sheet_opened`      | The photo sheet appears                | `context: 'create' \| 'redo'`, `tries_left`                                                                               |
| `pet_photo_source_selected`   | Camera or library chosen               | `context`, `source: 'camera' \| 'library'`                                                                                |
| `pet_photo_permission_denied` | Camera permission refused              | `context`                                                                                                                 |
| `pet_photo_read`              | A read finished, whatever the result   | `context`, `result` (`read`, `no_pet`, `several`, `unclear`, `limit_reached`, `failed`), `ms`, `species`, `swapped_count` |
| `pet_photo_confirmed`         | A choice on the reveal                 | `choice: 'keep' \| 'adjust'`                                                                                              |
| `pet_photo_kept`              | Name reached / look saved from a photo | `context`, `changed_count` (attributes the person changed afterwards)                                                     |
| `pet_photo_redo_tapped`       | The Change look row tapped             | `plan: 'free' \| 'plus'`, `left: 0 \| 1`                                                                                  |
| `pet_photo_species_choice`    | The species dialog answered            | `choice: 'switch' \| 'keep'`                                                                                              |

`paywall_viewed` gains the trigger `photo_redo`. `onboarding_step_viewed` gains `step: 'photo'`
(the reveal).

**Web first-party** (`apps/web/src/lib/analytics/events.ts`, `analytics_events`):
`pet_photo_read`, recorded by the server for every counted read, with the user id when signed
in and null when not. Metadata: `context`, `result`, `swapped_count`. Never the image, the
`seen` text or a hash.

The aha is the reveal with "That's them!". The drop-off to watch: `pet_photo_sheet_opened`
with no `pet_photo_read`, and `pet_photo_read` (read) with no `pet_photo_kept`.

## Out of scope

- A photo-based pet for free accounts after Create, more than 2 tries signed out, or more than
  1 a day for Plus.
- Keeping the photo, showing it on the pet's page, or sharing it.
- Coat length (fluffy fur), a pet's age or size from the photo, or personality from the photo.
- Several pets from one photo.
- A model check across several models before building (Mert skipped it on 2026-10-04); the
  `PhotoReader` interface leaves room for one later.
- App Attest (proving the request came from our app). It comes at launch (v3); noted in
  `ideas.md`.

## Open questions

1. The limit numbers: 6 a day per network and 300 a day app-wide are proposals. Mert also sets
   a monthly spending cap in the fal.ai dashboard.
2. `PHOTO_HASH_SECRET` is a new secret in `apps/web/.env.local` (any long random string).
3. The swap table (R11) is a first guess; Mert may want different nearest options.
