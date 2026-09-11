#!/usr/bin/env bash
# SessionStart: make `origin/main` current, and the working tree too where that
# is unambiguous (T-036).
#
# Why a hook and not a line in a prompt: every diff this repository takes is
# `origin/main...`, and that ref is a snapshot left by the last fetch. A rule
# that says "fetch first" is a rule an agent forgets, or believes it already
# followed. The harness does not forget.
#
# Two things go stale differently. `git fetch` moves the ref, which is all the
# gate, the review and `git checkout -b ... origin/main` need. It does not touch
# the files on disk, which is what anything reading the repository *before* a
# branch is cut is reading — hence the fast-forward below, and the reading
# discipline in the root CLAUDE.md for the case where it cannot happen.
set -uo pipefail

say() { printf '%s\n' "$*"; }

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  say "Not a git repository; the repository state was NOT verified."
  exit 0
fi

if ! fetch_error=$(git fetch origin 2>&1); then
  say "Could not fetch origin — the repository state was NOT verified and may be stale."
  say "Work from what is on disk, and say so in any report: ${fetch_error%%$'\n'*}"
  exit 0
fi

if ! git rev-parse --verify --quiet origin/main >/dev/null; then
  say "Fetched origin, but it has no main branch; the repository state was NOT verified against one."
  exit 0
fi

# Everything below counts commits against HEAD, which a checkout with no commits
# of its own does not have. Without this guard that case reports git's own
# errors and an empty commit count — and a SessionStart hook's output is read by
# the agent, so a confusing line here is worse than a plain one.
if ! git rev-parse --verify --quiet HEAD >/dev/null; then
  say "Fetched origin: origin/main is current. This checkout has no commits yet."
  exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD)
behind=$(git rev-list --count HEAD..origin/main)
ahead=$(git rev-list --count origin/main..HEAD)
dirty=$(git status --porcelain)

# Never `git pull`: on a feature branch it does nothing for `main`, and on a
# dirty tree it either fails or merges without being asked. Fast-forward only,
# and only where there is exactly one possible outcome. "Not ahead" is part of
# that: a local `main` carrying unpushed commits is a state someone chose, and
# moving it unasked is precisely what `git pull` does wrong.
if [ "$branch" = "main" ] && [ -z "$dirty" ] && [ "$behind" -gt 0 ] && [ "$ahead" -eq 0 ]; then
  if git merge --ff-only origin/main >/dev/null 2>&1; then
    say "Fetched origin and fast-forwarded main by $behind commit(s): origin/main and the working tree are both current."
    exit 0
  fi
  say "Fetched origin; the fast-forward of main failed, so the working tree is $behind commit(s) behind origin/main."
  exit 0
fi

say "Fetched origin: origin/main is current."
if [ "$behind" -eq 0 ]; then
  say "The working tree is not behind origin/main."
else
  reason="on branch '$branch'"
  [ "$branch" = "main" ] && reason="on main"
  [ -n "$dirty" ] && reason="$reason with uncommitted changes"
  [ "$ahead" -gt 0 ] && reason="$reason, $ahead commit(s) ahead"
  say "The working tree was left alone ($reason) and is $behind commit(s) behind origin/main."
fi
