---
name: local-checks-and-traps
description: How to replay migrations, generate one, and look at the Simulator locally, and the traps each has (Postgres 15, one-line exports, next build vs next dev, env files)
metadata:
  type: reference
---

Learned on 2026-10-01, building M4b and M5.

- **Replay migrations in a throwaway database on the Homebrew Postgres** (`localhost:5432`,
  `postgresql://$USER@localhost:5432/<db>`), never in the Supabase stack's Postgres: the CI shim
  (`apps/web/prisma/ci/supabase-shim.sql`) creates roles Supabase reserves and fails there.
  `createdb kinpaw_replay`, the shim, `prisma migrate deploy`, then drop it.
- **The Homebrew Postgres is 15.** The runtime-role database suite uses `GRANT … WITH INHERIT`
  (16+), so it can't run there; it runs in CI, or against the Supabase stack (17) once Mert has
  applied the migrations. The other database suites (`pets.test.mts`) run on 15.
- **Generate a migration with the repo's generator**, not by hand:
  `node scripts/generate-migration.mjs --name <name> --db-url <replay url>` after a replay
  (`--check` for a dry run). It applies what it wrote with `prisma migrate deploy`, which reads
  `DATABASE_URL`, so export that first.
- **Export `DATABASE_URL` and `DIRECT_URL` on separate lines.** On one line `DIRECT_URL` ends up
  empty and Prisma stops with `P1012` (the README says so; it still happens).
- **`npm run web:build` shares `.next` with a running `npm run web:dev`**; building while Mert's
  dev server runs can fail the build or disturb the server. Skip the build, or say so.
- **Never read or write a real env file**, not even with `grep` to check a host: the deny rule
  blocks it, and `sed` instructions for Mert to run with `!` keep values out of the conversation.
  A network error after a Wi-Fi change is the old LAN address in `apps/mobile/.env.local`; the
  Simulator should use `127.0.0.1` ([[local-device-networking]]).
- **Looking at the app without a tap tool** (no idb or Maestro installed): screenshots with
  `xcrun simctl io booted screenshot`, screens by deep link (`cozypet:///look`), and a state the
  screen needs (a dog draft) by editing only the `kinpaw:petDraft:v1` entry in the app's
  AsyncStorage `manifest.json` (it also holds the session; print nothing else, restore it after).
  When Mert's Metro is running, take screenshots only and don't relaunch his app.
- **Pressing buttons without a tap tool** (2026-10-03): Metro's inspector speaks the Chrome
  DevTools Protocol (`curl localhost:8081/json/list`, the "Bridgeless" target). `Runtime.evaluate`
  runs code in the dev app: walk `__REACT_DEVTOOLS_GLOBAL_HOOK__.getFiberRoots()` to find a
  pressable by `accessibilityLabel` and call its `onPress` (a SegmentedControl takes `onChange`).
  Read state from fiber props; time renders from `root.current.actualDuration` in
  `onCommitFiberRoot`, and what rendered from each fiber's `actualStartTime`. Hermes promises are
  not awaited over the protocol: stash results in a global and read them in a second call. Record
  with `xcrun simctl io booted recordVideo`, then tile frames with `ffmpeg` (`fps=30,crop,tile`)
  to see a glitch frame by frame. Don't click the Simulator with AppleScript: its window may sit
  on another display, and the click lands in whatever is under that point. `brew install
idb-companion` refuses the untrusted `facebook/fb` tap; trusting it is Mert's decision.

- **Speech recognition on the Simulator** (M6, 2026-10-01): `supportsOnDeviceRecognition()`
  says yes, but the Simulator has no English on-device model, so a session that requires it
  fails at once (the Simulator's log: `localspeechrecognition … Failed to create recognizer …
mini.json: cannot open file`; read it with `xcrun simctl spawn booted log show --last 20m
--predicate 'process == "localspeechrecognition"'`). `lib/speech.ts` falls back to Apple's
  server recognition after the first such failure. The `AudioToolbox … Abandoning I/O cycle`
  lines in Metro's output are the Simulator's audio device, not the app.
  **On the iOS 26.5 Simulator (checked 2026-10-06) the fallback fails too:** every attempt,
  on-device or not, goes through `localspeechrecognition`, which can't load its model
  (`_EARSpeechRecognizer is nil Failed to create recognizer`, Apple's error 300 in
  `kLSRErrorDomain`). expo-speech-recognition reports that as `audio-capture` "Failed to
  initialize recognizer", which looks like a microphone fault but isn't: pinning the input to
  the Mac's microphone and restarting the Simulator changes nothing. Voice input is tested on
  the iPhone; on the Simulator, type. An older runtime (iOS 18) may still reach Apple's servers;
  untried.

- **A column type change is hand-written** (2026-10-02, the fractional needs): the generator
  refuses `SET DATA TYPE` as destructive, and `prisma migrate dev --create-only` fails because
  its shadow database replays the baseline without the Supabase shim (`schema "auth" does not
exist`). Run the generator's `--check` on a replay to get Prisma's SQL, write it into a new
  `migrations/<timestamp>_<name>/migration.sql` with a header saying why, apply it to the
  replay, and the `--check` must then say "No schema drift detected".
- **The database suites skip without `TEST_DATABASE_URL`** (they print 0 tests, not a
  failure). Point it at the replay database to run `pets.test.mts` and `talk.test.mts`; run web
  tests with `--conditions=react-server`, as its `test` script does.
- **Restart `npm run web:dev` after `prisma:generate`.** The running server keeps the old Prisma
  client in memory; after the needs became `Float`, it would have rejected fractions as not
  `Int`.

- **A CLI's JSON cut at 8 KB on macOS means `process.exit` after a pipe write** (fixed
  2026-10-04): `check-standards.mjs`'s ~10.8 KB `--json` report was cut at 8 KB ("Unterminated
  string in JSON at position 8190"), failing 2 tests in `check-standards.test.mjs` on the Mac
  only (CI's Linux pipes are synchronous). It now sets `process.exitCode`; all of `npm test`
  passes (seen 2026-10-05). Do the same in any script that prints a large report.

- **Run the runtime-role suite on Postgres 17 in Docker** (2026-10-02): the Homebrew 15 can't
  (`WITH INHERIT`), and skipping it let a stale assertion reach CI (`adminRows` gained fields in
  M7 Phase 1; only the runtime-role suite checks its shape). CI's `migrations` job, exactly, on
  a throwaway container that never touches the Supabase stack:
  `docker run -d --name kinpaw-ci-pg -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:17`,
  then with `DATABASE_URL` and `DIRECT_URL` (separate lines) at
  `postgresql://postgres:postgres@localhost:55432/postgres`: the shim, `prisma migrate deploy`,
  `node scripts/run-once-sql.mjs --db-url "$DATABASE_URL"`, the drift check, `check:rls`, and
  `TEST_DATABASE_URL="$DATABASE_URL" npm run test:db --workspace=@app/web`; then
  `docker rm -f kinpaw-ci-pg`. Prefer it over the Homebrew replay for `local-review`.

See [[git-by-mert]] (no index-changing git commands, `git reset` included).

- **The Supabase CLI in a worktree** (2026-10-05): it names the local stack after
  `project_id` in `supabase/config.toml`, else after the folder, so a Superset worktree
  (`caterwauling-layer-cb40faf8`) looked for containers that didn't exist and said "not running"
  while the stack started from the main checkout was up. `project_id = "t1-merteldem1r"` now
  pins it: every checkout finds the one stack. Never `supabase start` in a second checkout (the
  ports clash), and `npm run db:reset` wipes the local database; `npm run db:migrate` is enough
  for new migrations.

- **Capturing the app for the site** (2026-10-06): boot the Simulator that has the app
  (`xcrun simctl boot`, iPhone 17 Pro), launch it, and point the dev client at Metro with
  `xcrun simctl openurl booted "cozypet://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"`.
  (Since 2026-10-12 the app is on the iPhone 17 Simulator, and the link that works is
  `exp+cozypet://expo-development-client/?url=…`. `expo run:ios` opens the app at the Mac's LAN
  address, which the Simulator fails to load: terminate it, launch it, then send the 127.0.0.1
  link.)
  Press buttons and fill fields through Metro's inspector as above (`onPress`, `onChangeText`).
  For clean frames: `xcrun simctl status_bar booted override --time "9:41" …` (and `clear` after),
  and hide the dev client's floating Tools button by setting `EXDevMenuShowFloatingActionButton`
  to false in the app's own plist (`simctl get_app_container booted <bundle> data`, then
  `Library/Preferences/<bundle>.plist`, with the app closed; `defaults write` through `simctl
spawn` goes to the wrong place). Put it back afterwards. A sign-in code for a test account is in
  the local mail catcher (`http://127.0.0.1:55324/api/v1/messages`). `recordVideo` has no sound:
  make a spoken reply again from its text with the voice provider and lay it in where the sound
  bars move. The test account `mochi.demo@kinpaw.test` (pet Mochi) was made for this.

**Testing hooks in the mobile Jest suite (2026-10-08, the code-quality work):**

- `renderHook` from `@testing-library/react-native`; wrap TanStack Query hooks in a
  `QueryClientProvider` whose client sets `gcTime: Infinity` (queries and mutations), or its
  5-minute garbage-collection timer keeps Jest running after the tests ("Jest did not exit").
- A mutation's `mutationFn` runs a tick after `mutate()`: `await act(async () => {})` before
  checking that the request went out.
- A hook that imports a constant from a component file pulls in Reanimated and AsyncStorage:
  mock `react-native-worklets` (`/src/mock`), `react-native-reanimated` (`/mock`) and
  `@react-native-async-storage/async-storage` (`/jest/async-storage-mock`) as `petBubble.test.tsx`
  does. Moving such constants to `lib/` is in the code-quality plan, Phase 4.
- Only `lib/supabase.ts` may import `@supabase/supabase-js` (lint), tests included: build
  Supabase's errors as plain objects with its `name`, `code` and `status`.
- Settle async state inside `act` (`await act(async () => {})`), not with `waitFor`, or React
  warns about updates outside `act`.
- Jest prints in colour, so `grep "Tests:"` finds nothing: run it with `--colors=false`.
- Prove a guarding test can fail: remove the guard, run it, put the guard back
  (`git diff` empty).
