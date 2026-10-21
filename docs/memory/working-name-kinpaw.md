---
name: working-name-kinpaw
description: Kinpaw is a placeholder name; keep it findable for the rename
metadata:
  type: project
---

**Kinpaw** is the working name (2026-10-01), not final. "Kinpaw Plus" is the placeholder name
for premium. The pet's name in copy is always the user's (`{name}`; "Mochi" in the spec is only
the example).

**Why:** the final name isn't chosen; the app icon has no text so it survives the rename.

**How to apply:** set the name in one place per surface (`packages/brand/brand.config.ts`
`appName`/`siteName`, `apps/mobile/app.json` `name`), and mark every other place with
`🎨 REPLACE` so a search finds it. Don't write "Kinpaw" into identifiers that would be hard to
rename.

The native identifiers are deliberately name-neutral (decided 2026-10-01, M2): bundle ID and
Android package `com.merteldem1r.cozypet`, scheme and slug `cozypet` (`APP_SCHEME` in
`apps/mobile/lib/constants.ts` matches). A rename changes the display name only, never these.
