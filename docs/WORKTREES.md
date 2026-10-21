# Working in worktrees

How to start, switch and finish work when Kinpaw is open in more than one place: the **main
checkout** (`~/Developer/t1-merteldem1r`) and **worktrees** that Superset makes for each session
(`~/.superset/worktrees/t1-merteldem1r/<name>`). [LOCAL_DEV.md](LOCAL_DEV.md) is how to run the
app at all; this page is what changes when there are several copies of the repo.

## What is shared and what each worktree has

| Thing                                           | Shared by all, or per worktree    | So…                                                               |
| ----------------------------------------------- | --------------------------------- | ----------------------------------------------------------------- |
| Supabase (database, sign-in, codes)             | **Shared**: one stack, in Docker  | Start it once, from the main checkout. Never stop it per worktree |
| The Kinpaw app on the Simulator or iPhone       | **Shared**: one installed build   | No new build per worktree. Metro sends the code to it             |
| Ports 3000 (website) and 8081 (Metro)           | **Shared**: only one can use each | Run the servers of **one** worktree at a time                     |
| The code, `node_modules`, `.next`               | Per worktree                      | `npm install` once in a new worktree                              |
| `apps/web/.env.local`, `apps/mobile/.env.local` | Per worktree                      | Each worktree needs its own copy                                  |
| `apps/mobile/ios/` (the native project)         | Only in the main checkout         | Native builds happen there (see "When you need a new build")      |

## Starting work in a new worktree

**1. Make sure Supabase is running** (from the main checkout, any terminal):

```bash
cd ~/Developer/t1-merteldem1r
supabase status
```

It should say `local development setup is running`. If not: open Docker Desktop, then
`supabase start`.

**2. Stop the servers of the worktree you used before.** In its terminals press `Ctrl+C`, or
free the ports from anywhere:

```bash
lsof -ti:3000 | xargs kill
lsof -ti:8081 | xargs kill
```

**3. In the new worktree, pick the right Node and install** (only the first time, or when
`package-lock.json` changed):

```bash
cd ~/.superset/worktrees/t1-merteldem1r/<name>
nvm use
npm install
```

**4. Give it the env files**, if it doesn't have them yet. This copies them from the main
checkout without printing anything, and never overwrites a file that is already there:

```bash
cp -n ~/Developer/t1-merteldem1r/apps/web/.env.local apps/web/.env.local
cp -n ~/Developer/t1-merteldem1r/apps/mobile/.env.local apps/mobile/.env.local
```

**5. Bring the database up to this branch** (safe any time; it only adds what's missing):

```bash
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres
export DIRECT_URL=$DATABASE_URL
npm run db:migrate
```

**6. Start the website and API** (terminal 2):

```bash
nvm use
npm run web:dev
```

**7. Start Metro** (terminal 3). **This is all the app needs: no build.**

```bash
cd apps/mobile
nvm use
npx expo start
```

- **Simulator:** press `i`.
- **iPhone:** scan the QR code with the Camera app (same Wi-Fi as the Mac).

The app on the device is the build you already installed; Metro sends it this worktree's code.

## Switching to another worktree

1. `Ctrl+C` in the current worktree's terminals 2 and 3.
2. In the other worktree, steps 5–7 above (step 3 and 4 too if it's new).
3. On the app: press `r` in Metro's terminal, or scan the new QR code on the iPhone.

## When you need a new build of the app

Only when **native** code changes. Metro can't send these:

- a package with native code added, removed or upgraded (an `expo-…` module, for example)
- `app.json`: plugins, permissions, purpose strings, icons, splash, bundle ID or scheme
- an Expo SDK or React Native upgrade

Everything else (screens, logic, copy, the server, the database) needs **no** build.

When a build is needed, do it in the checkout that has the native change, from `apps/mobile`:

```bash
cd apps/mobile
npx expo run:ios                  # the Simulator
cd .. && npm run mobile:ios:device  # your iPhone (from the repo root)
```

For the iPhone, redo the Xcode signing fix afterwards if `ios/` was regenerated
([memory note](memory/xcode-free-account-signing.md)). After one build, every worktree's
Metro works with it again.

## Finishing with a worktree

When its branch is merged (or you're done with it):

**1. Stop its servers**: `Ctrl+C` in its terminals, or the two `lsof … | xargs kill` lines above.

**2. Check nothing is left uncommitted:**

```bash
cd ~/.superset/worktrees/t1-merteldem1r/<name>
git status
```

**3. Free its space** (all of this is rebuilt on demand, safe to delete):

```bash
rm -rf node_modules apps/web/.next apps/mobile/ios/build
```

**4. Remove the worktree**: from Superset (preferred), or from the main checkout:

```bash
cd ~/Developer/t1-merteldem1r
git worktree remove ~/.superset/worktrees/t1-merteldem1r/<name>
```

**Don't**, when closing a worktree:

- `supabase stop` or `npm run db:reset`: the database is shared, and a reset **wipes** everyone's
  accounts, pets and memories.
- delete the main checkout's `.env.local` files or its `apps/mobile/ios/` folder (the signing
  fix lives there).

## Freeing space on the Mac (now and then)

Quit Xcode and the Simulator first.

**Safe** (rebuilt when needed):

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/*          # next native build is a full one
rm -rf ~/Library/Caches/com.apple.dt.Xcode/*
rm -rf ~/Library/Developer/CoreSimulator/Caches/*       # the next few app launches are slow
xcrun simctl delete unavailable
rm -rf ~/Library/Developer/Xcode/iOS\ DeviceSupport/*   # re-copied next time the iPhone connects
docker system prune                                     # not the database
```

**Never delete:**

| What                                               | Why                                                          |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `~/Library/Developer/CoreSimulator/Devices`        | The simulators, with the installed Kinpaw build and its data |
| Docker volumes, `docker system prune -a --volumes` | The local database                                           |
| Any `.env.local`                                   | The keys; they're not in git                                 |
| The main checkout's `apps/mobile/ios/`             | The Xcode signing fix for the iPhone                         |

## Quick fixes

**Pressing `i` gives "Operation timed out":** the app took longer than 10 seconds to start
(usually right after clearing the simulator caches, or with two simulators booted). Tap the
Kinpaw icon on the Simulator yourself, then press `r`. Keep one simulator booted:

```bash
xcrun simctl list devices booted     # see which are on
xcrun simctl shutdown <device id>    # turn the extra one off
```

**"Port already in use":** another worktree's server is still running:
`lsof -ti:3000 | xargs kill` (website) or `lsof -ti:8081 | xargs kill` (Metro).

**The app shows old code:** press `r` in Metro's terminal. Still old: `Ctrl+C`, then
`npx expo start -c` (clears Metro's cache).

**iPhone: "Failed to connect to http://<old address>:8081":** scan the current QR code again.

**`supabase status` in a worktree says it isn't running:** pull the latest `main` (it pins the
stack's name in `supabase/config.toml`), or run Supabase commands from the main checkout.
