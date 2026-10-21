---
name: parallel-workspaces
description: How Mert runs several Superset workspaces (git worktrees) at once - servers per lane, one native build, merging, disk space
metadata:
  type: project
---

Since 2026-10-04 Mert works in parallel lanes, one Superset workspace (a git worktree with its
own branch) per feature, each with its own Claude session. Learned setting it up:

- **New workspace:** create it from `main` (Superset names the branch from the first message;
  rename with `git branch -m`). Then `npm install` and copy both `.env.local` files from the main
  folder (`~/Developer/t1-merteldem1r`). Agents never read or copy them.
- **One lane runs the servers at a time** (ports 3000 and 8081): stop them in one lane's terminals
  before starting `npm run web:dev` and `npm run mobile:start` in another. The phone shows the
  lane whose Metro is running; on the iPhone, scan that Metro's QR code.
- **One native build serves every lane.** `npm run ios` (or `--device`) only when native code
  changes: a native library, `app.json` plugins or permissions, an Expo upgrade, or when the
  free-account app expires (about 7 days). Keep installed the build with the most native modules
  (since 2026-10-04 the notifications lane's, with `expo-notifications`). Since 2026-10-12 the
  build with the most is the v3 pet looks lane's (`feat/v3-pet-looks`: Skia and `expo-sensors`
  added): the iPhone 17 Simulator has it, the iPhone doesn't until Mert rebuilds for it. Older
  builds still run this lane's code: without Skia the pet stays SVG ([[skia-checks]]).
- **Disk:** each native build leaves 3–4 GB in `~/Library/Developer/Xcode/DerivedData/Kinpaw-*`,
  one per folder built from, not freed when a workspace is deleted. Delete them once the app is
  installed, never while a build runs. A workspace folder is about 2–2.6 GB.
- **Metro bundles the folder it was started in**, not the one you are working in. "Unable to
  resolve <package>" on the phone (2026-10-08: `react-native-qrcode-svg` on the Friends tab) meant
  Metro was running in the main folder, whose `node_modules` predated a merge. Stop it, start
  `npm run mobile:start` in the lane being tested; run `npm install` in any folder after merging
  work that adds a package. A pure-JS package needs no native rebuild.
- **One local Supabase for every lane** (Docker, container `supabase_db_t1-merteldem1r`, host
  port 55322). `supabase …` commands only from the main folder ([[local-checks-and-traps]]).
- **Merging:** one pull request per lane into `main`, one at a time. After one merges, bring
  `main` into the next lane (`git merge origin/main`), let its Claude session resolve the
  conflicts and run the gates, then Mert commits and pushes ([[git-by-mert]]). No extra workspace
  is needed for merging.

**Why:** the lanes share the database, the ports, the phone and the Groq quota; the code is
the only thing a worktree separates.

**How to apply:** tell a new lane's session which other lanes exist and what it must not touch
(migrations while another lane changes the schema, the shared docs), and test one lane at a time.
