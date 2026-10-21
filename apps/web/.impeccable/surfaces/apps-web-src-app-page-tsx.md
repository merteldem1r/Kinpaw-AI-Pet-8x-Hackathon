---
version: 1
slug: 'apps-web-src-app-page-tsx'
primary_target: 'apps/web/src/app/page.tsx'
related_targets: []
---

# Landing page (`/`)

**Mode:** Persuade. **Audience:** someone who has never heard of Kinpaw, usually on a phone in the
evening; hackathon reviewers second, served in depth by `/whats-new`.
**Job:** feel "someone would miss me", then join the waitlist.
**Proof on the page:** a pet you can care for, its eight real voices, a replay of it remembering
you, the app's own pet builder, real screenshots and a real recording. Test numbers live on
`/whats-new` only. No invented prices, ratings or users.
**Constraints:** brand pinned (dusk, lamp amber, serif narrator, code-drawn pet); colours from
`packages/brand` only; no new libraries; sound only on a tap; events registered first.
**Open:** a real pet photo for "from a photo" (falls back to screenshots of the flow).

## Direction contract

THESIS: The page is your first week with a pet, told in five scenes (days 1, 2, 3, 5, 7), and day
7 is the day it remembers. It refuses the split hero with a phone beside a headline and the row of
feature cards: features are days, not a grid.

OWN-WORLD: Each day is a full-bleed sky at its own hour, so the page travels light to dark as the
week passes: the visitor's local sky on day 1, morning on 2, night on 3, midday on 5, dusk
on 7, night at the close. One pet stands on a ground line in every scene, drawn in code with its
cream edge. The narrator is Source Serif 4; anything the pet says is Inter in a bubble. Lamp amber
is light and ink, once per scene. A seven-day strip rides the bottom edge as the spine.

STORY: Day 1 you look after it. Day 2 it speaks. Day 3 it keeps something you said. Days 4 and 6
pass in a line each: nothing happens, nobody keeps score. Day 5 a note arrives. Day 7 it asks how
the exam went. Then: make yours, see the real app, join.

FIRST VIEWPORT: The sky at the visitor's hour fills the screen. The headline "Someone missed you
today." runs across the top centre at hero size, one line of promise under it. Mochi stands large
at the centre on the ground line, needs as pills at both sides, the bubble at the upper right,
Feed, Play and Pet under the pet and working. The waitlist field sits bottom left; the week strip
runs along the bottom edge with day 1 lit.

FORM: "Seven days with Mochi", third on the ordered list of seven structures, dealt as the lead;
seed key 58393ccc. Steered by the user: five scenes, the sky moving per day, the builder after day
7 feeding the closing button ("Save <name> a spot"). Code-led: no image generation is available.
Signature interaction: the week strip follows the scroll and jumps on a tap; the pet built in
"make yours" names the last button.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Review 2026-10-06 (disposition fix, applied): day 3 moved from late afternoon to night, so the five scenes are five distinct skies at any visiting hour; pets stand on a ground band; pricing on the page is two short columns (cards on /pricing); the FAQ keeps the pet's questions.
