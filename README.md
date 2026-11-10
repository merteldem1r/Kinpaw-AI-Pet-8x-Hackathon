# Kinpaw

**A cozy AI pet that lives on your phone.** It has needs you care for every day, a personality
you design, it talks back in its own voice, and it remembers what you tell it. The feeling it
is built around: _someone missed me_.

Built for the 8x Playmakers hackathon (October 2026) on the 8x mobile monorepo template. iOS,
running on a local stack.

![Kinpaw: welcome, create your pet, talk on Home, tell me about you, what it remembers](docs/assets/readme-screens.webp)

_Welcome · Create your pet · Talk on Home · Tell me about you · What it remembers_

▶ **[Watch the demo](apps/web/public/app/demo.mp4)** (30 s)

## What it does

| Feature              | What you get                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Create your pet**  | Cat or dog, built from six attributes and drawn in code, or **from a photo** of your real pet (a vision model maps it onto the catalog). |
| **Care**             | Hunger, happiness, energy and affection drift down by day and slower at night. Feed, Play and Pet; the pet reacts. It never dies.        |
| **Talk**             | Hold the mic and talk. The pet answers in its personality, aware of how it feels, and **speaks the reply** in a voice that fits it.      |
| **Long-term memory** | It keeps short facts you mention ("exam on Friday") and asks about them later. Sensitive topics are filtered out; you can forget any.    |
| **"I missed you"**   | Come back after a while and its first line says so. A daily **note on the lock screen**, in its voice, when it misses you.               |
| **Friends**          | Add friends by QR code or link and visit their pets, which show only what a friend may see.                                              |
| **Kinpaw Plus**      | Unlimited talking, more voice, Plus looks and a photo redo. Decided on the server only; grantable from the admin panel for demos.        |

What's built, milestone by milestone: [roadmap](docs/application/roadmap.md) ·
[v1 log](docs/application/updates/v1.md) · [v2 log](docs/application/updates/v2.md).

## How it's built

```mermaid
flowchart LR
  app["iOS app<br/>Expo · React Native<br/>apps/mobile"]
  auth["Supabase Auth<br/>email code"]
  api["Next.js API<br/>/api/app/v1<br/>apps/web"]
  db[("Postgres<br/>Prisma")]
  groq["Groq<br/>gpt-oss-120b"]
  fal["fal.ai<br/>photo · voice"]
  contract["@app/contract<br/>Zod schemas + needs rules"]
  brand["@app/brand<br/>tokens + pet drawing"]

  app -- "sign-in only" --> auth
  app -- "HTTPS, bearer token" --> api
  api -- "verifies token" --> auth
  api --> db
  api -- "talk, intro, memory" --> groq
  api -- "photo → pet, voice" --> fal
  contract -. shared .- app
  contract -. shared .- api
  brand -. shared .- app
  brand -. shared .- api
```

- **One contract for both sides.** Every endpoint's request and response is a Zod schema in
  [`packages/contract`](packages/contract), and so are the rules both sides run: needs decay,
  care effects, mood. The app parses every response with it and the server validates every
  input and output against it.
- **One way to write a route.** [`createAppRoute`](apps/web/src/server/api/app-route.ts) runs
  auth, input parsing, the handler and response validation in that order. A route can't skip a
  step, and a response with the wrong shape is a logged 500, never a half-right 200.
- **The server owns the truth.** The app never touches a table: Supabase is sign-in only, data
  goes through the API, and stores in [`apps/web/src/server/db`](apps/web/src/server/db) write
  through Prisma in transactions with row locks. RLS is on with nothing granted. Money and
  entitlement (`plan_type`) are written by server code only.
- **AI behind interfaces.** Talking, the intro, the photo reader and the voice each sit behind a
  provider interface with a stub, so tests and CI never call a model. Model output is checked
  with Zod and capped; nothing said to the pet is stored or logged, only the facts it keeps.
- **The pet is drawn in code** from species and six attributes
  ([`packages/brand`](packages/brand/src/petDrawing.ts)): the same drawing on the phone and the
  website, every mood for every look, no image assets.

## Quality

Every pull request runs the same gates in CI ([`ci.yml`](.github/workflows/ci.yml)), and
`npm run …` runs each locally:

| Gate              | Checks                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `typecheck`       | Strict TypeScript across web, mobile, contract and brand; no `any`                                |
| `lint`            | ESLint with zero warnings allowed, including the repo's own import rules                          |
| `test`            | Over 1,000 tests: the contract, the web routes and stores, the app's logic, the scripts           |
| `check:events`    | Every analytics event fired is registered in its app's registry                                   |
| `check:env`       | Every env read is declared in the schema and `.env.example`                                       |
| `check:store`     | Store rules a file can decide: purpose strings, privacy manifest, account deletion, paywall links |
| `check:secrets`   | No secret in any tracked file (also a pre-commit hook)                                            |
| `check:standards` | The 8x standards checklist ([`docs/STANDARDS.md`](docs/STANDARDS.md))                             |
| migrations job    | Replays every migration onto empty Postgres, then drift, RLS and the database suites              |

The engineering rules these enforce are in [`docs/rules/`](docs/rules/), indexed in
[`AGENTS.md`](AGENTS.md).

## Run it locally

You need Node 22 (`.nvmrc`), Docker, the
[Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) and Xcode.

```bash
nvm use && npm install

cp apps/web/.env.example    apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local

supabase start                     # prints the local URL and keys
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres
export DIRECT_URL=$DATABASE_URL    # a separate line: on one line DIRECT_URL ends up empty
npm run db:reset                   # resets the local database and applies the migrations
```

Fill in the local values (everything else can stay empty; a feature without its key says it
isn't configured instead of failing):

| File                     | Variable                                                      | Value                                         |
| ------------------------ | ------------------------------------------------------------- | --------------------------------------------- |
| `apps/web/.env.local`    | `NEXT_PUBLIC_SUPABASE_URL`                                    | `http://127.0.0.1:55321`                      |
|                          | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | from `supabase status`                        |
|                          | `DATABASE_URL`, `DIRECT_URL`                                  | the URL above                                 |
|                          | `GROQ_API_KEY`                                                | a free key from Groq, for talking             |
|                          | `FAL_KEY`                                                     | optional: the pet from a photo, and its voice |
| `apps/mobile/.env.local` | `EXPO_PUBLIC_SUPABASE_URL`, `…_PUBLISHABLE_KEY`               | the same URL and publishable key              |
|                          | `EXPO_PUBLIC_SITE_URL`                                        | `http://127.0.0.1:3000`                       |

```bash
npm run web:dev                    # the API and the website, on :3000
cd apps/mobile && npx expo run:ios # builds the app once (again after a native change)
npm run mobile:start               # later runs: the dev server only
```

Sign in with any email: the six-digit code lands in the local mail catcher at
<http://127.0.0.1:55324>. On a real iPhone, scan Metro's QR code
([local device networking](docs/memory/local-device-networking.md)). Every variable is
explained in [`docs/ENV_SETUP.md`](docs/ENV_SETUP.md).

## Repo layout

```
apps/
  mobile/        Expo app: screens in app/, components/, hooks/ (TanStack Query), lib/
  web/           Next.js: the website, the admin panel and the API (src/app/api, src/server)
packages/
  contract/      the /api/app/v1 schemas and the shared pet rules
  brand/         colours, type and the pet drawing, for both apps
supabase/        the local stack's config and seed
docs/
  application/   product, roadmap, screen spec, one spec and plan per feature
  rules/         the engineering rules
  memory/        decisions and environment traps
scripts/         the check:* gates
```

## Read more

- [`docs/application/product.md`](docs/application/product.md): what Kinpaw is, the decisions
  and why.
- [`docs/application/features/`](docs/application/features/): requirements and a phased plan
  for every feature, written before its code.
- [`apps/mobile/README.md`](apps/mobile/README.md) and [`apps/web/README.md`](apps/web/README.md):
  how each app is organised.
- [`AGENTS.md`](AGENTS.md): the rules every contributor and coding agent follows.
