---
id: T-036
type: ticket
title: A session starts from a current main — fetched by a hook, not by remembering
status: todo
depends_on: []
refs:
  - CLAUDE.md
  - .claude/skills/teachers-ticket/SKILL.md
  - .claude/skills/teachers-review/SKILL.md
  - docs/architecture/decisions/ADR-001-review-reads-the-documents.md
---

## Goal

Nothing in a session may read the repository or compute a diff against a stale
`origin/main`. Two things are stale in different ways and need different
answers: the ref every diff is taken against, and the file contents on disk that
phase 1 reads before any branch is cut.

## Acceptance criteria

- [ ] A `SessionStart` hook in `.claude/settings.json` runs `git fetch origin`
      at the start of every session. It is the harness that runs it, not the
      agent: a freshness rule stated only in a prompt is the kind that was
      forgotten.
- [ ] The hook fast-forwards the working tree too, but only where that is safe
      and unambiguous: `HEAD` is `main`, the tree is clean, and `main` is
      strictly behind `origin/main`. It uses `--ff-only` and never creates a
      merge commit. In every other case it leaves the tree alone and says how
      far behind it is.
- [ ] The hook never runs `git pull`: on a feature branch it does nothing
      useful for `main`, and on a dirty tree it either fails or merges without
      being asked.
- [ ] Root `CLAUDE.md` states the rule once — what the hook guarantees, and the
      reading discipline below — and no skill restates it (`ADR-001`).
- [ ] **The reading discipline.** Content whose current value decides something,
      read before a branch is cut from `origin/main`, is read from `origin/main`
      and not from disk — `git show origin/main:<path>`. This is what a fetch
      alone does not fix, and it holds whatever branch the session is sitting
      on and whether or not the tree is clean.
- [ ] Ticket selection names that discipline explicitly: the frontmatter sweep
      that decides which ticket is next reads the `origin/main` copies. The
      ticket file a run is already editing is read from the branch, where its
      own status change lives — the discipline is about selection, not about
      the work in progress.
- [ ] A session whose hook could not run — no network, no remote — is told so
      and works from what it has, with the report saying the repository state
      was not verified. It is never reported as current.
- [ ] `npm run gate` and `/teachers-review` resolve their diff base against the
      fetched ref, and neither carries a fetch of its own.

## Notes

`git fetch` updates `origin/main` and nothing else: the working tree keeps the
files it had. That is enough for everything keyed on the ref — cutting a branch
from `origin/main`, the gate's `origin/main...HEAD`, the review's
`origin/main...<branch>` — and not enough for the backlog read in phase 1,
which is a file on disk. Hence the two halves above.

`/teachers-ticket` phase 5 already fetches before cutting its branch; that line
is what the hook generalises, and it can reference the rule instead of repeating
the command once the hook holds it.
