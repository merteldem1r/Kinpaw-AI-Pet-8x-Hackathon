# Claude build logs

In a play, this folder fills itself. At the **end of every Claude Code session**, the
`SessionEnd` hook in [`.claude/settings.json`](../.claude/settings.json) runs
[`.claude/log-session.py`](../.claude/log-session.py), which reads the session
transcript and drops a timestamped markdown log here, named for when the session
ended and the first 8 characters of its id, e.g. `2026-06-22_15-32-29_a87c3e1f.md`.
The log is every prompt and every text reply, verbatim, under a frontmatter of
session stats; tool calls and their output are left out.

## The template itself keeps no logs

This repository is the template every play is cloned from, so it holds only this
README. While the root `package.json` is named `app-template`, `log-session.py`
writes nothing (at the end of a session or with `--backfill`) and says so, and
CI's `npm run check:template` fails if a log is committed here anyway.

**Renaming the root package, which every play does when it is cloned, switches
logging on.** Nothing else to set up.

## In a play

You do two things:

1. **Approve the hook once.** The first time you open Claude Code in this repo it
   asks you to trust the project hook. Approve it, and from then on it writes a
   log silently at the end of every session.
2. **Keep this folder committed and push it.** The logs land on GitHub next to
   the changes they describe, so any teammate can trace how the build was made
   and pick it up cold.

Transcripts are committed verbatim, so the pre-commit hook scans them for secrets
like any other file. If a real value scrolled past in a session, redact it in the
log before committing ([`docs/rules/secrets.md`](../docs/rules/secrets.md)).

## Author attribution

Each log is stamped with an author, resolved in this order:

1. the `CLAUDE_LOG_AUTHOR` environment variable, if set;
2. your repo's `git config user.name`;
3. `unknown`.

Set your git `user.name` (which you should anyway) and your logs are attributed
automatically — nothing to edit.

## Backfilling

To generate logs for past sessions that don't have one yet:

```bash
python3 .claude/log-session.py --backfill          # skips sessions already logged
python3 .claude/log-session.py --backfill --force  # regenerates all
```
