# M8: Polish — plan

> Requirements: [m8-polish-requirements.md](m8-polish-requirements.md). Each phase is shown to
> Mert and confirmed before the next. No migration, no native change: everything ships over the
> air. Profile editing (the parallel session) is not touched.

## Phase 1 — Accessibility fixes (the app) · done 2026-10-02, checked by Mert

> **As built.** `Button` pads any size under 44pt with `hitSlop` (`sm`: 2 above and below)
> unless the caller passes its own. The sky picker's buttons are 40pt with 2 of slop (more
> slop would reach into the next button 2pt away). Surprise me: 4 above and below. The List
> section action: 13. New `components/ui/TextLink.tsx`: a small text link as its own VoiceOver
> element (link role) with a 44pt touch area; Welcome's sentence became a wrapping row of words
> and two links, and sign-in's two links use it. The paywall price line and List row titles
> wrap (2 lines for titles). The attribute tile's pop states `ReduceMotion.System`;
> `layoutTransition` already did (the audit was wrong there).

**Files:**

- `components/ui/Button.tsx:21`: `size="sm"` pads to 44pt with `hitSlop` (used on the paywall's
  Restore, Redeem, Terms and Privacy, Change look, pet details, `QueryError` retries).
- `components/pet/SkyPicker.tsx:41-48, 67`: `hitSlop` from 4 to at least 7.
- `components/pet/PetBuilder.tsx:124, 196-205`: Surprise me gets vertical `hitSlop`.
- `components/ui/List.tsx:64`: the section header action to 44pt; `:165, :177` row title and
  value may wrap (R3).
- `app/index.tsx:153, 163` and `app/(auth)/login.tsx:726, 733`: the Terms and Privacy links
  become their own pressables with `accessibilityRole="link"` and a 44pt touch area (R2).
- `app/upgrade.tsx:420`: the price and trial line wraps (R3).
- `lib/motion.ts:114` (`layoutTransition`) and `components/pet/AttributeOptions.tsx:207`:
  `ReduceMotion.System` (R4).

**Changes:** R1–R4. No new components; each fix is in the shared primitive where one exists.
**Verify:** the Accessibility Inspector on the Simulator over Welcome, sign-in, the paywall,
Change look and Settings; Settings → Accessibility → Larger Text at the largest size, then the
paywall (the price line whole) and Settings. `npm run typecheck`, `lint`, mobile tests.

## Phase 2 — The website matches the app · done 2026-10-02, checked by Mert

> **As built.** `components/device/care.tsx` redrawn as twins of today's app parts: `NeedPill`,
> `CareTile` (the `art.care` colours, the wanted glow and badge), `TalkRow` (the mic and the
> keyboard), `WordsChip`, `PetBubble` (no "Reply" link); the old meters, buttons and `PetHead`
> are gone. New `screens/HomeRoom.tsx` lays out the one-screen Home; `HomeScreen` (Mochi missed
> you, Pet glowing) and new `TalkingScreen` (your words in the chip, Mochi's answer in the
> bubble) both draw it; the chat-style `TalkScreen` is deleted. The tab bar has My pet ·
> Profile · Settings. The paywall mockup uses the app's two features. Copy: Story, the pricing
> page, `lib/pricing.ts` and the FAQ say messages and talking, not chats; the FAQ's delete
> answer says nothing said is stored. The footer's Contact link is gone. Left for launch (v3):
> the `example.com` addresses on the privacy, terms and support pages, and the site URL.

**Files:** `apps/web/src/components/device/parts.tsx` (tabs: My pet · Profile · Settings);
`screens/HomeScreen.tsx` (need pills, care tiles, the mic); `screens/TalkScreen.tsx` becomes the
Home screen talking (the pet's reply in the bubble, your words in the chip; renamed if its name
misleads); `screens/PaywallScreen.tsx` ("More time with Mochi", the two features);
`components/landing/Story.tsx` (titles, bodies and `screenLabel`s); `app/pricing/page.tsx` and
`lib/pricing.ts` (messages, unlimited talking); `components/Footer.tsx` (open question 3).
**Changes:** R6–R8, copy and mockups only; events unchanged.
**Verify:** `npm run web:dev`, the home page and `/pricing` in a browser, at phone and desktop
widths; no "chat", no Talk tab, no "Room for more pets"; `npm run web:build`.

## Phase 3 — Mert's checks, and their fixes · moved to v2 (Mert, 2026-10-02)

> Mert closed v1 without them; they are v2's first small tasks (roadmap).

**Mert:** a day of play on the needs rhythm (R9); Home on the iPhone SE (3rd generation) and an
iPhone 16 Pro Max Simulator at the default and largest text size (R10); a VoiceOver pass over the
v1 loop on the iPhone (R5).
**Agent:** whatever those turn up: a needs constant (`packages/contract/src/v1/needs.ts`, its
tests, product.md), a layout fix in `components/home/layout.ts`, a label.
**Verify:** Mert, on the devices, against what he reported.

## Phase 4 — Close v1 · done 2026-10-02

> The roadmap, the plans and `ideas.md` say v1 is done and where v2 starts.

**Files:** `docs/application/roadmap.md` (v1 done, what v2 starts with),
`docs/application/product.md`, the screen spec where M8 changed something, the memory notes.
**Changes:** R11.
**Verify:** Mert runs the full demo on the iPhone: fresh install → Welcome → create → save →
care → talk (voice and typing) → run out → paywall → grant in the admin → unlimited → Change
look to Calico → Profile and Settings → delete account. The `local-review` gates and
`store-review`.

## Risks

- **`Button size="sm"`'s `hitSlop`** reaches every small button; where two sit side by side
  (the paywall's links) the padding must not overlap the neighbour's. Checked in the Inspector.
- **Wrapping text** can push layouts that assumed one line (the paywall shelf's height is
  measured, so it follows; List rows grow). Checked at the largest text size.
- **The website's build** must stay green; the device mockups are shared components, so one
  change shows in several places.
- **Nothing here touches money, entitlement, auth or the Play Stats API.**
