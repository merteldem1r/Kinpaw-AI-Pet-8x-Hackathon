---
name: user-activated-first-chat-reply
description: The "aha" - user_activated fires on the pet's first reply when you talk to it (voice or typed)
metadata:
  type: project
---

`user_activated` (web registry; also a canonical Play Event) fires **once per user, on the
pet's first reply when you talk to it** (decided 2026-10-01), spoken or typed: talking is by
voice on Home, and there is no chat screen. It is emitted by the server's talk route, not by the
app.

The other key moments are also recorded **first-party** from the server routes, so the admin
panel shows real numbers without PostHog: pet created, pet action taken, talk reply received.

**Why:** talking with the pet is what sets Kinpaw apart from a plain care game; a first reply
means the person reached it.

**How to apply:** register these with the `events` skill before M4 to M6 fire them. Events
never carry what was said, the pet's reply or the pet's name; the intent label is sent,
except `upset`, sent as `other`. See [[hackathon-localhost-only]].
