---
name: updates-log-per-version
description: Before a session ends, log new features, updates and important UI changes, with dates, in docs/application/updates/v<N>.md
metadata:
  type: feedback
---

At the end of any session that added a feature, an update, an important UI change or anything
tied to a version (v1, v2, …), add it, with the date, to that version's file in
`docs/application/updates/` (`v1.md`, `v2.md`, …). Keep each entry short:

- what the feature is,
- how it works, in a sentence or two a person can follow,
- a couple of technical points if there are any (a table, a route, a model).

Also add the day to the file's "Day by day" table. Don't over-explain: the depth belongs in
`docs/application/features/`.

**Why:** Mert reports to the hackathon organizers from these files: what has been completed
and what was added.

**How to apply:** do it before the session ends, without being asked. Update an existing entry
rather than adding a duplicate, and use absolute dates. See [[working-with-mert]].
