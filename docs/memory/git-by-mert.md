---
name: git-by-mert
description: Mert runs every git command; agents never branch, commit, push or open PRs, and only suggest the commit message
metadata:
  type: feedback
---

**Mert does all git.** An agent never creates or switches branches, stages, commits, pushes,
opens or merges a pull request, or runs any other git command that changes state. Read-only
commands (`git status`, `git diff`, `git log`) are fine.

At the end of a piece of work, the agent reports what changed and **suggests** a Conventional
Commit message (and the `.claude-logs/` staging reminder). Mert reviews, commits and pushes.
Work always happens on a branch, never `main`, and Mert makes the branch.

This overrides the parts of the `ship` skill and CLAUDE.md that commit, push, open a PR or
stage logs: run the gates (`local-review`), then stop and suggest.

**Why:** Mert said so explicitly (2026-10-01): "the git is completely on me".

**How to apply:** every session, every skill. If a skill's step is a git write, skip it and
say what to run instead. See [[mert]].
