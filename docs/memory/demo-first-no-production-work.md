---
name: demo-first-no-production-work
description: Until the hackathon demo, work on the code as it runs today; production and scale issues are deferred, not raised
metadata:
  type: feedback
---

Until the hackathon demo, Mert wants sessions spent on real problems in the code as it runs
today (on localhost): readability, structure, tests, bugs. Not on what would go wrong once it
is hosted (serverless instances, shared storage, throttling, abuse).

**Why:** this build is a hackathon demo (2026-10-09, during v2 code quality); launch concerns
cost time now and change nothing in the demo.

**How to apply:** don't propose or build production hardening. When you notice one, add a line
to the "before launch" list of the feature's plan and move on, without discussing it. Dev-only
helpers stay while Mert is testing (see [[dev-reset-photo-tries]]). Related:
[[hackathon-localhost-only]].
