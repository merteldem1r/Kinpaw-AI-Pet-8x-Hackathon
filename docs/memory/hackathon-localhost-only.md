---
name: hackathon-localhost-only
description: The hackathon runs on localhost only; no hosted services, no EAS, and which template features are therefore unconfigured
metadata:
  type: project
---

Kinpaw is built for the 8x Playmakers hackathon (October 2026) under an organizer rule:
**localhost only**. Local Supabase in Docker, `npm run web:dev`, the app on the iOS Simulator
and Mert's iPhone.

- No Vercel, no hosted Supabase, no EAS: no OTA updates, no store builds, no submission. The
  OTA, release and deployment rules in AGENTS.md describe a later launch, not this build.
- RevenueCat, Sentry and PostHog stay unconfigured. Each reports itself "not configured"
  instead of failing. The app's `track()` events go nowhere, but still must be registered
  (`check:events`).
- The `pulse` and `8xsend` MCP servers are not available (2026-10-01: pulse failed with a
  certificate error, 8xsend has no key). The Play Stats API (`api/dashboard/v1`) and the email
  automation are left untouched for the hackathon.
- The store-review rules still bind the UI (paywall links, account deletion).

**Why:** the organizers' rule for this hackathon.

**How to apply:** never suggest a deploy, `eas` command, or hosted setup; build for the local
stack. See [[ios-only]], [[local-device-networking]].
