---
name: website-seven-days
description: The landing page is a week with a pet (rebuilt 2026-10-06); where its direction, captures and voice clips live and how to remake them
metadata:
  type: project
---

Since 2026-10-06 the landing page is **"Seven days with Mochi"**: five scenes (days 1, 2, 3, 5, 7),
each a full-width sky at its own hour and a thing the visitor can do, then the pet builder, the
real app, plans, questions and a closing night. Mert chose the structure from three that the
impeccable skill dealt; the brand stayed as it is ([[brand-dusk-lamp-amber]]). `/whats-new` is the
page for the hackathon's reviewers.

- **The direction** (what the page promises, and why) is impeccable's surface brief,
  `apps/web/.impeccable/surfaces/`. It is committed; `apps/web/.impeccable/review/` (captures) and
  the root `/.impeccable` working files are ignored. impeccable is a Claude Code plugin
  (`/plugin marketplace add pbakaus/impeccable`, then install it), not a repo skill.
- **The page's number** is `week_day_viewed` with day 7 over `landing_view` (Mert, 2026-10-06).
- **The site's pets use the app's code**: needs from `@app/contract`, drawing from `@app/brand`.
  The pets' lines are copies of the app's (`apps/web/src/lib/pet-lines.ts` names each source); a
  line changed in the app is changed there by hand.
- **Sound**: `apps/web/public/voice/*.m4a` are copies of `apps/mobile/assets/voice` (re-copy after
  `voice:samples`); the replay's two lines come from `npm run voice:site --workspace=@app/web`
  (two paid calls on fal, about $0.002; the provider's timeout is short, so run it again if it
  fails).
- **Screenshots and the recording** are listed in `apps/web/src/lib/captures.ts` and were taken
  from the Simulator ([[local-checks-and-traps]], "Capturing the app for the site"). The paywall
  is left out on purpose: a development build shows preview prices, and the site must not show a
  price ([[monetization-v1]]).

- **The motion** (since 2026-10-08, [website-motion](../application/features/website-motion-requirements.md)):
  day 4 is a scroll-driven time-lapse, midnight to midnight (`landing/TimeLapse.tsx`, on
  `motion`'s `useScroll`; its needs move by the real `decayNeeds`; `DayPass` under Reduce
  Motion); day 6 is the friends scene (`DaySix` + `FriendsRail`, the v2 Friends feature, counted
  as `week_day_viewed` day 6); a light day meets a dark one through a dusk or a dawn (`TURN` in
  `src/lib/sky.ts`); skies carry `art.life` (`SkyLife`), faint stars, a shooting star and depth
  (scroll-driven CSS, `PointerDepth` for the mouse); every pet is a `LivePet` (blink, look, tail,
  hop, mood effects); lead paragraphs are `ScrubText`. Scroll-driven CSS needs the scenes to clip
  (`overflow-clip`), never `overflow-hidden`, which makes a scroll container and blinds `view()`.

**Why:** the first reviewer asked why anyone opens Kinpaw on day 7; a week lets the page show the
pet remembering, which a feature list can only claim.

**How to apply:** a new feature gets a day or a place in a day, not a card in a grid. Keep the
events in step (`WEEK_EVENTS`), and remake the captures when the app's screens change.
