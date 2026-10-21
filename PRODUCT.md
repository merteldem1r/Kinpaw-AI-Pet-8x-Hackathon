# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The marketing site, admin panel and API live in `apps/web`. The product itself is the iOS app in
`apps/mobile`, which has its own record (`apps/mobile/PRODUCT.md`); this file holds the product
truth both share. The full product doc is `docs/application/product.md`, and the screen contract
is `docs/application/UI/kinpaw-screen-spec-v1.md`.

## Users

- **Primary: young adults and adults who want a small daily ritual of comfort.** People who
  like the idea of a pet but can't have one, people who enjoy cozy games, and people who want a
  moment of warmth in a busy day. They open the app for a minute or two, once or a few times a
  day, often in the evening. Not children, and not a hardcore game audience.
- **Secondary: operators.** Whoever runs the play uses the admin panel for users, grants,
  funnel and retention.

## Product Purpose

Kinpaw (working name) is a cozy AI pet that lives on your phone. It has four needs you care for
every day (hunger, happiness, energy, affection), a personality you design, and it talks to you
in that personality, aware of how it feels. The core feeling is **"someone missed me"**. Success
is a person who comes back tomorrow because their pet is there, glad to see them.

## Positioning

A virtual pet without the guilt: it never dies, never leaves and never punishes absence, and it
is the pet that actually talks back. Warmer and calmer than care games built on streaks and
fail states; more of a character than a chatbot.

## Operating Context

- Built for the 8x Playmakers hackathon (October 2026), on localhost only: local Supabase, the
  web app in development, the app on the iOS Simulator and an iPhone. iOS only.
- No hosted deployment, store build or submission in v1. RevenueCat, Sentry and PostHog are
  unconfigured; the store-review rules still shape the UI.
- The marketing site exists from the template and is not a v1 focus.

## Capabilities and Constraints

- **One brand source.** Colours, type, radii, elevation and motion live in `packages/brand`; both
  apps read from it. No hardcoded hex anywhere else. Sky and pet-art colours are illustration
  colours exported from `packages/brand` too.
- **Dusk preset with a lamp-amber accent (`#f2b66b`)**, and dusk's light scheme, `dawn`. The
  app follows the sky: light by day, dark in the evening and at night.
- **Rule-based pet, AI conversation.** Needs, mood and most of what the pet says are local,
  rule-based and instant; only chat calls an AI model, through the server.
- **The server owns the pet and the money.** Needs, the chat limit and entitlement are decided
  by server code; the app never writes them.
- **Every user-visible change registers its events first** (the `events` skill); an unregistered
  event is dropped silently. Events never carry chat text or the pet's name.
- **Store-review rules bind the UI**: the paywall shows price, period, trial terms, Restore,
  Terms of Use and Privacy links; account deletion is reachable in the app.
- **Mobile motion stack is already installed** (Reanimated 4, gesture handler, blur, gradient,
  SVG, haptics, expo-image); the sky is drawn in code, not images or Lottie.
- Demonstration content is synthetic, development-only, and marked as such.

## Brand Commitments

- Warm, soft and a little playful; never childish, never saccharine. The pet can be sassy but is
  never mean.
- **The narrator is serif, the pet is Inter**: headers speak about the pet, the bubble and chat
  are the pet speaking.
- The pet art is soft flat vector with a cream sticker edge and picture-book proportions, never
  anime.
- The name Kinpaw and "Kinpaw Plus" are placeholders, marked `🎨 REPLACE` so the rename is one
  search.

## Evidence on Hand

None yet. Kinpaw has no users, testimonials, prices or metrics, and must not invent any: pricing
and social proof ship as clearly marked placeholders.

## Product Principles

1. **Someone missed you.** Every return should feel like being welcomed home.
2. **No guilt, no loss.** The pet never dies, leaves or scolds. Low needs are an invitation,
   not a failure.
3. **Instant and alive.** Care actions respond immediately, with motion, a haptic and a line
   from the pet.
4. **A character, not a chatbot.** The pet speaks in its personality and knows how it feels;
   it never breaks character unless asked directly.
5. **Honest by default.** Loading, empty and error states are real; a failed load is never
   shown as zeroed needs, and placeholders look like placeholders.

## Accessibility & Inclusion

WCAG 2.2 AA contrast in both schemes, including text over the sky. Reduced motion respected:
nothing travels or scales, and ambient motion holds still. Touch targets at least 44pt. Text
survives iOS Dynamic Type at large sizes. A low need never rides on colour alone (the word
"low" and a VoiceOver label carry it), and the pet image is labelled with its name and mood.
