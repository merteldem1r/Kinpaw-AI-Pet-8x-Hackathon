# Kinpaw: website, admin and API

The Next.js 15 app (`@app/web`, App Router). Three things in one deployment:

- **The API the iOS app reads**, `/api/app/v1`: the pet, care, talking, memory, the photo
  reader, the voice, friends, the profile.
- **The website**: "Seven days with Mochi", a landing page that is a week with a pet, and
  `/whats-new`, the page for reviewers on what v2 built and how it was measured.
- **The admin panel**: users (with the Kinpaw Plus grant and revoke), analytics, the funnel.

What Kinpaw is: the [root README](../../README.md).

## Run it

Set up the local stack first ([root README, "Run it locally"](../../README.md#run-it-locally)),
then:

```bash
npm run web:dev      # from the repo root: http://localhost:3000
```

Without `GROQ_API_KEY` talking answers `not_configured`; without `FAL_KEY` the photo reader and
the voice do. Everything else works on the local stack alone.

## How the API is built

```
src/app/api/app/v1/<route>/route.ts   the route: a few lines that call createAppRoute
src/server/api/app-route.ts           createAppRoute: auth → parse input → handler → check output
src/server/api/*-wire.ts              a row as the app may see it (a friend's pet shows less)
src/server/auth/require-user.ts       the bearer token, verified by Supabase Auth
src/server/db/                        the stores: every query, through one Prisma client
src/server/talk/                      talking and the intro: prompt, Groq, reply schema, stub
src/server/photo/                     a photo → a pet: fal, the catalog prompt, limits, stub
src/server/voice/                     the reply's voice: fal, the voices, once per message
prisma/schema/                        the schema, one file per domain, and its migrations
```

- **A route is a contract.** Each one is built from its `@app/contract` endpoint, so its body,
  query and response are Zod schemas shared with the app. A response that doesn't match is a
  logged 500, never a malformed 200.
- **Errors are written for the person.** Expected failures are `ApiError`s with a code and a
  plain message (`src/server/api/app-errors.ts`); anything unexpected is logged through the
  structured logger and answered with a generic 500.
- **Stores own the queries.** `petStore`, `memoryStore`, `friendStore` and the rest are made by
  a factory over the Prisma client, so tests pass their own. Writes that must not race (care,
  talking, adding a friend) run in a transaction that locks the row first.
- **AI calls sit behind interfaces** (`provider.ts` in each folder) with a stub, so tests and CI
  never call a model. Every model answer is parsed with Zod and capped, and has a written
  fallback. Usage is counted in `ai_usage` and limited per day.
- **The server decides money and access.** `plan_type` and the `premium_*` columns are written
  only by server code (`src/server/db/profiles.ts`); the app reads them.

The rules behind these: [database](../../docs/rules/database.md),
[authorization](../../docs/rules/authorization.md),
[mobile data](../../docs/rules/mobile-data.md),
[error handling](../../docs/rules/error-handling.md).

## The rest of `src/`

```
src/app/                  the site's pages, admin/ (guarded by profiles.is_admin), api/
src/components/landing/   the week: DayOne … DaySeven, the pet builder, the talk replay
src/components/device/    the phone frame and the app screens drawn in it
src/lib/analytics/        the web's event registry (events.ts) and its sinks
src/lib/env.ts            the env schema, checked at boot
src/lib/dashboard-stats.ts the counts the admin panel and the Play Stats API share
```

## Tests

```bash
npm run web:test     # the unit and route suites (node:test)
npm run test:db      # the database suites, against a migrated database, as a non-superuser
```

Route tests run each route through `createAppRoute` with a stubbed user and stores
(`src/server/api/app-test-kit.mts`). `scripts/talk-check.mts`, `photo-check.mts` and
`voice-check.mts` run real prompts against the real models and score them; they are run by hand,
not in CI.

## Later, at launch

This build runs on localhost. Vercel, the hosted database, RevenueCat's webhook and the Play
Stats API are wired but not configured: [docs/LAUNCH_TODO.md](../../docs/LAUNCH_TODO.md) and
[docs/rules/deployment.md](../../docs/rules/deployment.md).
