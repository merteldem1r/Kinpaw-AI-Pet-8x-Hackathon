---
name: ios-only
description: Kinpaw targets iOS only; no Android work, testing or config
metadata:
  type: project
---

Kinpaw v1 is **iOS only** (decided 2026-10-01). No Android testing, no Android-specific UI
work, and no Android store config. Leave the template's Android settings in `app.json` as they
are rather than deleting them.

**Why:** hackathon scope, and Mert tests on the iOS Simulator and an iPhone.

**How to apply:** verify on iOS only; don't spend time on Android edge cases. Android is a v3
candidate in `docs/application/roadmap.md`. See [[hackathon-localhost-only]].
