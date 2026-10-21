# Memory Index

Durable notes for this play (Kinpaw). One line per note. See `AGENTS.md` ("Project memory") for
how to write one. The product itself is in `docs/application/`.

**People and how we work**

- [Mert](mert.md): experienced engineer, new to mobile and this template; explain mobile steps plainly
- [Git is Mert's](git-by-mert.md): agents never branch, commit, push or open PRs; they suggest the commit message
- [Scope check first](scope-check-before-building.md): before building a screen or a table, agree the v1 / later split with Mert (v1 is the MVP; never say MVP)
- [Working with Mert](working-with-mert.md): store every idea in docs/application/ideas.md, advise with edge cases, build step by step, confirm each step
- [Updates log per version](updates-log-per-version.md): before a session ends, log new features and UI changes, dated, in docs/application/updates/v<N>.md
- [Parallel workspaces](parallel-workspaces.md): one Superset worktree per lane; servers in one lane at a time; one native build; Metro bundles the folder it started in; merging one PR at a time
- [The pet's look is plush](pet-look-plush.md): soft and sweet, a plush toy; no grain that runs one way (it reads as wood); he picked Puppet (`lib/petLight.ts`): matte, the parts separate solids that shadow each other; show several versions to pick from
- [Demo first](demo-first-no-production-work.md): until the demo, fix the code as it runs today; production and scale issues go on the plan's before-launch list, not into the session

**Environment and traps**

- [Localhost only](hackathon-localhost-only.md): no hosted services or EAS; RevenueCat, Sentry, PostHog, pulse, 8xsend off
- [iOS only](ios-only.md): no Android work in v1
- [Free-account signing](xcode-free-account-signing.md): Xcode-only fix in `ios/`; a native rebuild can undo it; never edit app.json for it
- [Local device networking](local-device-networking.md): `.env.local` keeps 127.0.0.1 (the app follows Metro's host); the iPhone routine is scan Metro's QR code
- [Sample tables dropped](sample-tables-dropped.md): items, tasks, activity_feed, notifications and their enums dropped by a hand-written migration (2026-10-01)
- [Prisma editor pin](prisma-editor-pin.md): the editor's Prisma 7 errors on base.prisma are false; pin the extension to Prisma 6
- [Local checks and traps](local-checks-and-traps.md): the database suites on Postgres 17 in Docker (as CI), replay on Homebrew 15, the generator, one-line exports, build vs dev, simulator without taps, pressing buttons through Metro's debugger, capturing the app for the site, the Supabase CLI in a Superset workspace, the standards test cut at 8 KB, testing hooks with Jest
- [Pet drawing checks](pet-drawing-checks.md): render PetSvg or posed parts to PNG in Node and compare pixels, to prove a drawing change without a device
- [Skia checks](skia-checks.md): Skia only behind `hasSkia()`; CanvasKit in Jest and off screen in Node; a layer shader can't be drawn there and isn't density aware; dev screens on the Simulator by link
- [Image picker crop is slow](image-picker-crop-is-slow.md): `allowsEditing` means the old iOS picker (2–3 s to open); Edit profile picks without a crop

**Product decisions**

- [Working name Kinpaw](working-name-kinpaw.md): a placeholder; keep the rename findable; IDs are neutral (`cozypet`)
- [Dusk + lamp amber](brand-dusk-lamp-amber.md): `#f2b66b` accent; coral `errorText` for low needs, never `warningText`
- [Monetization v1](monetization-v1.md): 10 free messages to the pet a day, Kinpaw Plus, server-decided entitlement, admin grant and revoke on /admin/users
- [Activation](user-activated-first-chat-reply.md): `user_activated` on the pet's first reply when you talk to it; key moments recorded first-party
- [Pet voice](pet-voice.md): Inworld on fal at 1.15×, 5 a day free / 20 Plus, text and voice together; iOS refuses duckOthers with the silent switch
- [AI provider](ai-provider-deferred.md): Groq free tier (`openai/gpt-oss-120b` since 2026-10-03) behind a reply-provider interface; stub for tests; a paid model later
- [AI usage stand-in](ai-usage-stand-in.md): minimal `ai_usage` table until template-web's rule is available
- [Dev reset of photo tries](dev-reset-photo-tries.md): TEMPORARY dev-only link on Create · Start; delete before any release
- [The website is a week](website-seven-days.md): "Seven days with Mochi" since 2026-10-06; its direction, captures, voice clips and how to remake them
