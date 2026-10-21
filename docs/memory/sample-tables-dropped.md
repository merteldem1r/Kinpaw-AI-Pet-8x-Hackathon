---
name: sample-tables-dropped
description: The template's sample tables (items, tasks, activity_feed, notifications) and their enums are dropped; don't bring them back
metadata:
  type: project
---

The template's sample domain is gone from Kinpaw entirely. M2 removed its code (screens,
hooks, contract endpoints, `v1` routes, stores); on 2026-10-01, after M4, Mert decided to drop
the tables too. The hand-written migration
`apps/web/prisma/schema/migrations/20261001120000_drop_template_sample_tables` drops `items`,
`tasks`, `activity_feed`, `notifications` and the enums `item_status`, `task_state`,
`task_priority`, `activity_kind`, `notification_category`; `app.prisma` and the `Profile`
relations to them are deleted.

**Why:** they held only template sample data and nothing read them. Keeping them was an M2
shortcut (CI's generator refuses `DROP`), not a rule, and they cluttered every schema read.

**How to apply:** don't recreate them. Kinpaw's own tables (`pets`, and the chat tables in M6)
take their place. `scripts/check-rls.test.mjs` still names them in a fixture of the old stage-1
security migration; that fixture doesn't touch a database and stays. A future v2 notification
feature uses local phone notifications, not the dropped `notifications` table.
