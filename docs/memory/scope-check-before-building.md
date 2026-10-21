---
name: scope-check-before-building
description: Before implementing any screen or database table, stop and agree with Mert what is in v1 and what waits for later
metadata:
  type: feedback
---

**Stop before building screens or tables.** Before writing the code for a page (a screen,
route or component a person sees) or a table (Prisma model, migration, store), an agent stops
and discusses with Mert what goes into **v1** (the version being built now) and what waits
for **later**. There is no separate "MVP": v1 is it, so never call a scope "MVP". Specs, assets, events registration and tooling
can go ahead; the build waits for that agreement.

**Why:** Mert asked for it explicitly (2026-10-01), so scope is decided together, milestone by
milestone, rather than built to the full spec by default.

**How to apply:** at the end of each `spec` run, and before the first build phase that adds a
screen or a table, present a v1 / later split (what each includes, what is cut, why) and wait
for Mert's answer. Record the agreed split in the milestone's requirements file. See
[[mert]], [[git-by-mert]].
