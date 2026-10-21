# M8: Polish — requirements

> Written 2026-10-02 from [roadmap M8](../roadmap.md#m8-polish), the screen spec's "Motion,
> haptics, accessibility" and "App icon and logo mark" sections, and an accessibility audit of
> `apps/mobile` (every screen but the profile header). The last v1 milestone: when it is done,
> v1 is done. The plan: [m8-polish-plan.md](m8-polish-plan.md).
> **Status:** done 2026-10-02 (R1–R8, R11). R9, R10 and R5's device pass moved to v2's first
> tasks (Mert).
>
> **Not touched here:** editing the profile (avatar, display name), which Mert is building in a
> parallel session: `app/(tabs)/profile.tsx`'s header, `hooks/useProfile.ts`,
> `PATCH /api/app/v1/profile` and uploads.

## Problem

v1 works end to end, but three things stand between it and a version that could be shown as
finished:

- **A few accessibility gaps.** Some tap targets are under 44pt, and the paywall's price line is
  cut to one line, so at large text sizes the price disclosure is truncated (Apple 3.1.2 wants
  it readable). A couple of animations don't say how they behave under Reduce Motion.
- **The website describes an app that no longer exists.** Its phone mockups show a Talk tab and
  a chat screen, and its copy sells "ten chats a day" and "unlimited chat". Since M6, talking
  is by voice on Home, and the tabs are My pet · Profile · Settings. A marketing page showing
  screens the app doesn't have is what App Review checks against (2.3.1).
- **Two checks that only Mert can do** have waited since 2026-10-02: a day of play on the
  needs rhythm (are the numbers right?), and Home on the smallest and largest iPhones.

## What is there today (research)

- **Already done, so out of M8:** tapping the sun or moon, and the night's shooting star
  (`components/pet/SkyScene.tsx`, `components/home/SkyTarget.tsx`; still under Reduce Motion);
  the website's name and favicon (title "Kinpaw: a cozy pet that missed you", favicon
  `apps/web/src/app/icon.png`, the cat logo mark); the three app icon variants and the logo mark,
  matching the spec, as placeholder art (`apps/mobile/assets/icon/`, sources in `source/`).
- **Accessibility, sound at the base:** `PressableScale` gives a button role, `IconButton`
  requires a label and pads to 44pt, `Text` caps each role's Dynamic Type, every spring in
  `lib/motion.ts` carries `ReduceMotion.System`, decorative art is hidden from VoiceOver, no
  hardcoded colours. Clean: support, settings, legal pages, the create flow, the tab bar, the
  Home room, sheets and modals.
- **The gaps** (file:line in the plan): the sky picker (about 38pt), Surprise me (36pt), every
  `Button size="sm"` (40pt: the paywall's Restore, Redeem, Terms, Privacy; Change look; error
  retries), the inline Terms and Privacy links on Welcome and sign-in (about 18pt, and read as
  one element with the sentence), a section header action (about 38pt); the paywall price line
  and List rows at `numberOfLines={1}`; `layoutTransition` and one inline `withTiming` without
  an explicit reduce-motion setting.
- **Website:** `components/device/parts.tsx` (the tab bar with Talk), `screens/TalkScreen.tsx`
  (a chat), `screens/HomeScreen.tsx` (the M5 Home, before the need pills), `landing/Story.tsx`,
  `app/pricing/page.tsx` and `lib/pricing.ts` ("chats"), `components/Footer.tsx`
  (`hello@example.com`).

## Success criteria

- VoiceOver can do the whole v1 loop (create, save, care, talk by tap, open Plus) and every
  control it lands on says what it is; every target is at least 44pt; the paywall's price stays
  whole at the largest text size.
- The website shows only screens the app has, in the words the app uses.
- Mert has played a day and either kept or changed the needs numbers, and has seen Home on an
  iPhone SE and a Pro Max.
- **Measured by:** nothing new. Polish changes no funnel step; the existing events (Home, talk,
  paywall, the website's `story_view`) keep measuring the same moments.

## Requirements

### Accessibility (the app)

R1. Every tap target is at least 44 × 44pt, through size or `hitSlop`: the sky picker, Surprise
me, `Button size="sm"` everywhere, the section header action.

R2. The Terms and Privacy links on Welcome and sign-in are separate VoiceOver elements with a
link role, and their touch area is at least 44pt tall.

R3. The paywall's price and trial line wraps instead of being cut, at every text size; so do
the Settings and Profile row titles where a long title would otherwise be cut (List rows).

R4. Every animation states its Reduce Motion behaviour: `layoutTransition` and the attribute
tile's pop get `ReduceMotion.System`.

R5. A last VoiceOver pass on the iPhone over the v1 loop, with whatever it turns up fixed or
written down.

### The website

R6. The device mockups match the app: tabs My pet · Profile · Settings; the Home mockup with the
need pills, the care tiles and the mic; the talking mockup is Home with the pet's reply in its
bubble and your words in the chip (no chat screen); the paywall mockup with "More time with
Mochi" and the two Plus features.

R7. The copy uses the app's words: talking by voice (or typing), "ten messages a day" free,
"unlimited talking" with Plus, the Plus looks and rare builder options; no "Room for more pets".

R8. The footer's placeholder Contact link (`hello@example.com`) goes (open question 3).

### Mert's checks

R9. A day of play on the needs rhythm; any change goes into
`packages/contract/src/v1/needs.ts` with its tests, and into product.md.

R10. Home checked on the iPhone SE (3rd generation, 667pt) and a Pro Max (932pt) Simulator, at
the default and the largest text size; anything broken is fixed.

### Closing v1

R11. The full v1 demo, end to end, on the iPhone (the roadmap's M8 demo); the `local-review`
gates and `store-review`; the roadmap, product doc and spec say v1 is done.

## Events

None new. The `events` skill's questions, answered: no new screen, button or state; the aha,
the drop-off and the money moments are the ones already registered. The website's mockups
change, not its events (`story_view` and the CTAs stay). The VoiceOver links (R2) keep firing
the same legal-link events they fire today.

## v1 / later split (agreed with Mert, 2026-10-02)

| v1 (M8)                                   | Later                                                 |
| ----------------------------------------- | ----------------------------------------------------- |
| R1–R5 accessibility                       | A full WCAG audit with an outside tester              |
| R6–R8 the website matching the app        | Real screenshots or video on the website              |
| R9–R10 Mert's two checks, and their fixes | Tuning from real players' numbers                     |
| R11 the end-to-end demo and the docs      | Final icon art and a final name (open questions 1, 2) |

## Out of scope

Profile editing (the parallel session); new features (v2: notifications, long-term memory, the
pet speaking aloud, more pets); the paid model; anything hosted (v3); Android.

## Open questions

1. **The app icon.** _Answered by Mert, 2026-10-02: keep the placeholder moon cat for v1_ (it
   matches the spec in all three variants); final art comes with the final name.
2. **The pet drawing.** _Answered by Mert, 2026-10-02: no changes._ Tuning `PetArt` leaves M8.
3. **The website's contact.** _Answered by Mert, 2026-10-02: drop the Contact link_ until there
   is a real address; support stays reachable through the support page.
