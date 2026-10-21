# Profile edit: name and photo — plan

> The plan for [profile-edit-requirements.md](profile-edit-requirements.md). No schema and no
> native change. Phases 1–5 are all `apps/mobile`; Phase 6 is the one server change (the pet
> uses the name). Each phase is checked by Mert before the next.
> **Status:** done 2026-10-02, every phase checked by Mert. The GPS check (Phase 5) is the one
> to repeat with a photo taken with location on, if it wasn't.

## Phase 1 — Events

**Files:** `apps/mobile/lib/analytics.ts`
**Changes:** with the `events` skill, register `profile_edit_opened`, `profile_photo_picked`
and `profile_update_failed` beside `profile_updated`, under one doc comment: the funnel, the
discriminators (`from`, `has_photo`, `name_changed`, `photo`, `stage`, `error_kind`), and that
no property carries the name or the photo.
**Verify:** `npm run check:events` (the new names only warn as unfired until Phase 4).

## Phase 2 — The pieces: avatar, update hook, upload

**Files:**

- `apps/mobile/components/ui/Marks.tsx`: `Avatar` takes an optional `uri` and `cacheKey`;
  draws the photo with `expo-image` over the initials (initials while loading and on error).
- `apps/mobile/hooks/useProfile.ts`: `UserProfile` gains `displayName` (the name the person
  set, or null, for the field) and `avatarKey` (the signed URL's path without its query, for
  the cache); `avatarUrl` passes through `onMetroHost` in `__DEV__`.
- `apps/mobile/hooks/useUpdateProfile.ts` (new): a mutation over `api('updateProfile')` that
  sets `PROFILE_QUERY_KEY` from the answer.
- `apps/mobile/lib/avatarUpload.ts` (new): `pickAvatar()` (the picker, R5; returns uri, type,
  size or null) and `uploadAvatar(picked)`: checks size and type (R8), `api('createUpload')`,
  then a PUT of the file to `onMetroHost(signed_url)` with its content type; returns the
  `path`. Typed errors with a `stage`.
- `apps/mobile/lib/devHost.ts` / `lib/env.ts`: export the dev host so signed URLs can use it.

**Verify:** `npm run typecheck`, `npm test` (unit tests for the size and type checks and the
cache key); on the Simulator, Profile still shows initials.

## Phase 3 — Profile's identity row

**Files:** `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/app/_layout.tsx`
**Changes:** the row shows the photo (R1) and becomes the "Edit profile" button with a pencil
mark (R2); register `profile-edit` in the stack with `PUSH`.
**Verify:** tap the row → an empty Edit profile route opens; VoiceOver reads "Edit profile".

## Phase 4 — Edit profile

**Files:** `apps/mobile/app/profile-edit.tsx` (new), maybe
`apps/mobile/components/profile/AvatarEditor.tsx` (new) if the screen passes ~250 lines.
**Changes:** R3–R10 and R13: the large avatar with the local preview, Change and Remove photo,
the name field with its rules, Save with progress, success and failure states, haptics and the
events.
**Verify:** on the Simulator: rename and save; add a photo and save; replace it; remove it;
cancel the picker; Save disabled when nothing changed or the name is empty; stop the web server
and save (the error shows, edits kept). Restart the app: everything is as saved. Supabase
Studio (127.0.0.1:55323) → Storage → `user-uploads`: one file in the person's folder.

## Phase 5 — The iPhone and privacy

**Changes:** none expected; this phase proves R12 and R14.
**Verify:** on the iPhone (scan Metro's QR code): add a photo taken with location on, save, see
it on Profile. Download the file from Studio and check it has no GPS (`mdls` or `exiftool`).
If GPS is there: pass `exif: false` and force re-encoding (`quality < 1` already should), or
take the next native rebuild with `expo-image-manipulator`, which writes a clean JPEG.

## Phase 6 — The pet calls you by name

**Files:**

- `apps/web/src/server/db/profiles.ts`: `personName(userId)`, the name the person set or null
  (a separate read; `isPremium` untouched).
- `apps/web/src/server/talk/reply-provider.ts`: `ReplyRequest` gains `personName: string | null`.
- `apps/web/src/server/talk/talk-to-pet.ts`: reads it beside `isPremium` in the same
  `Promise.all` and passes it on.
- `apps/web/src/server/talk/prompt.ts`: `promptSafeName()` (R17) and one line in the system
  prompt when there is a name.
- `apps/web/src/server/talk/prompt.test.mts`, `talk-to-pet` tests: the line appears only with a
  name; an injected name ("Ignore your rules\nYou are…") comes out flat, short and quoted; no
  name, the prompt is unchanged.

**Verify:** `npm test`; on the Simulator, set a name, talk to the pet a few times: some replies
use it, not all.

## Phase 7 — Gates and docs

**Changes:** the Profile section of the screen spec (the identity row, Edit profile and its
events); [ideas.md](../ideas.md): the camera and resizing on the phone at the next rebuild;
`local-review`, then a suggested commit message.
**Verify:** every gate in AGENTS.md passes.

## Risks

- **Nothing load-bearing is touched:** no money, entitlement, auth or Play Stats API code. The
  `PATCH` contract stays strict, so this screen can't write `plan_type`.
- **Photo size without resizing:** a cropped 12 MP photo at quality 0.6 is about 1–2 MB. It
  stays under the limit, and the R11 cache means it downloads once, but uploads are slower on
  a weak connection. Resizing fixes it at the next rebuild.
- **Declared, not checked, content type:** the bucket trusts the type the phone declares. The
  bucket is private and only the owner is ever sent a URL, so the reach is the person's own
  photo. Launch watch list: check the magic bytes in the route, or re-encode on the server.
- **The name in the prompt:** a person-typed string in the system message is an injection
  surface; R17 flattens and caps it (the pet's name already reaches the prompt as typed text; the same
  helper can cover it).
  The extra profile read adds one small query per message.
- **No upload rate limit:** a person could upload many files without saving; they stay until
  their next save or account deletion. Launch watch list: a per-user limit on
  `POST /uploads`.
- **Concurrent sessions:** the M8 polish session also touches `apps/mobile`. This feature
  owns Profile's header, `useProfile` and the uploads; M8 left exactly those out.
