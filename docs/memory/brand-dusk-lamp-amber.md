---
name: brand-dusk-lamp-amber
description: Brand decision - dusk preset with a lamp-amber #f2b66b accent; coral errorText marks low needs, not warningText
metadata:
  type: project
---

Kinpaw uses the template's **`dusk`** preset (its light scheme is `dawn`) with one accent,
**lamp amber `#f2b66b`**, set in `packages/brand/brand.config.ts` (decided 2026-09-30 in the
design sessions; `docs/application/UI/kinpaw-screen-spec-v1.md`).

- Low needs use dusk's **`errorText`** (coral), never `warningText`: dusk's warning yellow is
  too close to the amber accent to read as a change.
- Sky, sun, moon and pet-art colours are illustration colours, not UI roles: they go in
  `packages/brand` as an `art.sky` export so the no-hex test still passes.
- `brandGlow` appears behind the pet only on Meet and the Paywall; on Home the sky is the
  atmosphere.

**Why:** a warm lamp in a midnight room fits "someone missed me".

**How to apply:** colours by role only (the spec's role table). The hex values in the spec are
for checking, never for app code.
