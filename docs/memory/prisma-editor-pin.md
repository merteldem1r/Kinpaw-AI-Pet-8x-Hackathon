---
name: prisma-editor-pin
description: Trap - the Prisma VS Code extension (v7) flags `url`/`directUrl` in base.prisma; the repo is on Prisma 6, where they are valid
metadata:
  type: project
---

The repo runs **Prisma 6.19.3**, where `url` and `directUrl` in the `datasource` block of
`apps/web/prisma/schema/base.prisma` are correct. The Prisma VS Code extension's newer releases
check against Prisma 7, which moved them to `prisma.config.ts`, and show two red errors on
that file. The CLI (`prisma validate`, `generate`, `migrate`) is fine.

**Fix:** `"prisma.pinToPrisma6": true` in the editor settings (`.vscode/settings.json`, which
is gitignored, so each person sets it; added on Mert's machine 2026-10-01).

**Why:** upgrading to Prisma 7 is a template-wide change (client construction, config file,
CI), not something to do to silence an editor.

**How to apply:** don't "fix" the schema for these diagnostics. If the errors come back, check
the setting. A real Prisma 7 upgrade is its own PR.
