---
name: monetization-v1
description: What is free and what is Kinpaw Plus in v1, the talk limit, and how premium is decided and demoed without RevenueCat
metadata:
  type: project
---

Decided 2026-09-30 (spec) and 2026-10-01:

- **Free:** everything, plus **10 messages a day to the pet** (spoken or typed; talking is by
  voice on Home since 2026-10-01), resetting at the user's **local midnight**. A message counts
  when its reply arrives; a failed reply, nothing heard, or the model not reachable doesn't
  count. Groq's free tier costs nothing; the limit stays because it is how Plus is shown.
- **Kinpaw Plus** (placeholder name): unlimited talking, and the premium looks (Calico,
  Blue merle). "Room for more pets" is an open question, because multi-pet is out of v1.
- **The paywall** opens only from a limit (the locked mic when the pet is all talked out, a
  locked look after onboarding) or from the Profile tab, never before the first conversation. Prices stay marked
  placeholders (`apps/web/src/lib/pricing.ts`).
- **The server decides entitlement:** `profiles.plan_type`, written only by server code
  (AGENTS.md, non-negotiable 3). The server enforces the talk limit. The app reads the plan from
  the server's profile, not only from RevenueCat.
- **RevenueCat is unconfigured**, so premium is demonstrated with an **admin grant**: `/admin/users`
  → "Grant Plus" (built 2026-10-02, M7 Phase 1). It writes `plan_type = premium`,
  `premium_source = grant` (the dashboard's `granted` bucket, never revenue) and a
  `premium_grants` audit row (`action` grant or revoke). Revoke undoes only a grant, never a
  store subscription.

- **The app** decides Plus in one place, `usePlus` (the server's plan, or RevenueCat's
  entitlement), and re-reads the plan on return to the app, on Home and when the paywall closes.
  Plus looks are used through **Change look** on pet details (M7), the only way an existing pet
  can take one; a pet keeps a Plus look if Plus ends.

**Why:** hackathon demo without a store; the money rules still apply.

**How to apply:** review any diff touching `plan_type`, `premium_*` or grants twice. See
[[hackathon-localhost-only]].
