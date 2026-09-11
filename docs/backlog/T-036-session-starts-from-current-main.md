---
id: T-036
type: ticket
title: A session starts from a current main — fetched by a hook, not by remembering
status: in-progress
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
- [x] The hook fast-forwards the working tree too, but only where that is safe
      and unambiguous: `HEAD` is `main`, the tree is clean, and `main` is
      strictly behind `origin/main`. It uses `--ff-only` and never creates a
      merge commit. In every other case it leaves the tree alone and says how
      far behind it is.
- [x] The hook never runs `git pull`: on a feature branch it does nothing
      useful for `main`, and on a dirty tree it either fails or merges without
      being asked.
- [x] Root `CLAUDE.md` states the rule once — what the hook guarantees, and the
      reading discipline below — and no skill restates it (`ADR-001`).
- [x] **The reading discipline.** Content whose current value decides something,
      read before a branch is cut from `origin/main`, is read from `origin/main`
      and not from disk — `git show origin/main:<path>`. This is what a fetch
      alone does not fix, and it holds whatever branch the session is sitting
      on and whether or not the tree is clean.
- [x] Ticket selection names that discipline explicitly: the frontmatter sweep
      that decides which ticket is next reads the `origin/main` copies. The
      ticket file a run is already editing is read from the branch, where its
      own status change lives — the discipline is about selection, not about
      the work in progress.
- [x] The branch is cut at the **start of phase 2**, not in phase 5. Everything
      read after ticket selection — the `refs:` sections, the glossary, the code
      the ticket touches, the neighbouring module — then comes from a working
      tree `origin/main` has just populated, and the window in which the tree can
      be stale is exactly one phase: the frontmatter sweep that selects the
      ticket, which the discipline above already covers. A branch cut for a
      ticket the user declines in phase 3 is deleted, which is cheaper than a
      plan built against stale code.
- [x] A session whose hook could not run — no network, no remote — is told so
      and works from what it has, with the report saying the repository state
      was not verified. It is never reported as current.
- [x] `npm run gate` and `/teachers-review` resolve their diff base against the
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

`git checkout -b <branch> origin/main` resolves the **local** ref
`refs/remotes/origin/main`, which is a snapshot taken by the last fetch. Without
one it cuts the branch from whatever was downloaded last and fills the working
tree with those files, and git reports nothing unusual while doing it. The
checkout is what makes the tree current — but only as current as the fetch
before it, which is what the hook guarantees.

`T-034` also moves work between these phases. Neither ticket depends on the
other; whichever lands second reconciles the phase boundaries.

**T-036 implementation.** The hook script is
`.claude/hooks/session-start-fetch.sh`; the rule it guarantees is stated in the
root `CLAUDE.md` under "A session starts from a current main". `npm run gate`
already resolved `origin/main...HEAD` without a fetch of its own — that
criterion needed a comment recording why, not a behaviour change.

**Outstanding: the `SessionStart` registration in `.claude/settings.json`.**
The first criterion's hook entry is written and the script beside it is
complete, but the entry itself is not in the repository: the session that
implemented this ticket could not write a hook registration into its own
settings (the harness refuses a hook install from the agent, which is the same
instinct this ticket is built on). The entry to add, verbatim:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/session-start-fetch.sh\"",
            "timeout": 60,
            "statusMessage": "Fetching origin"
          }
        ]
      }
    ]
  }
}
```

`bash <path>` rather than the bare path, so the hook does not depend on the
script's executable bit surviving a checkout.

