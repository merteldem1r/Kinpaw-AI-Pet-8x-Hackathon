---
name: dev-reset-photo-tries
description: TEMPORARY dev-only "Dev: reset photo tries" link on Create · Start, to delete before any release
metadata:
  type: project
---

Added 2026-10-06 at Mert's request, while testing on his iPhone after it had used its 2
signed-out photo tries ([v2-pet-from-photo](../application/features/v2-pet-from-photo-requirements.md),
R16). **Temporary: delete it once photo testing is done, and before any release.**

- **What:** a small "Dev: reset photo tries" link under "Make your own" on Create · Start
  (`apps/mobile/app/(create)/start.tsx`), shown only in development builds (`__DEV__`).
- **How:** `resetPhotoTriesForDev()` in `apps/mobile/lib/installId.ts` gives the phone a new
  install id in the Keychain and clears the tries hint. The server counts tries by a hash of the
  install id, so it treats the phone as new; nothing on the server changes. The per-network daily
  limit (6) and the app's daily cap still apply.
- **To remove:** delete the link (and its `TextLink` import, if nothing else uses it) in
  `start.tsx`, delete `resetPhotoTriesForDev`, then delete this note and its line in `MEMORY.md`.

**Why:** the 2 tries per phone are counted forever, so a test phone runs out of photo creation.

**How to apply:** before an OTA, a store build or the `store-review` skill, check this is gone.
