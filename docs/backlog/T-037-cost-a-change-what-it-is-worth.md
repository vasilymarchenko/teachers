---
id: T-037
type: ticket
title: A change that touches no code costs what it is worth — routed review, routed gate, and when a ticket run is needed at all
status: todo
depends_on: [T-033]
refs:
  - .claude/skills/teachers-review/SKILL.md
  - .claude/skills/teachers-ticket/SKILL.md
  - CLAUDE.md
  - scripts/gate/checks.ts
  - docs/architecture/decisions/ADR-012-one-check-definition.md
  - docs/backlog/T-027-backlog-contract-convention-tests.md
---

## Goal

A diff containing no code pays the same as one that does: `/code-review` reads
prose for correctness defects, and the gate runs `lint`, `typecheck`, `test` and
`build` — `paths: null` in `scripts/gate/checks.ts` — none of which read
`docs/**` or `.claude/**`. Route both by the kind of change, and state when a
change needs a `/teachers-ticket` run at all.

## Acceptance criteria

- [ ] `/teachers-review`'s table gains a second dimension beside `--effort`: the
      kind of change, derived from the paths in the diff. The table states which
      passes run for each kind, and it is the one place that states it.
- [ ] For a diff with no code in it, `/code-review` does not run, and the report
      says which passes ran rather than implying all of them did. The contract
      pass always runs: the ticket-against-documents check is the whole subject
      of a documentation change, not a reduced version of a code review.
- [ ] A mixed diff — code and documents together — is a code change and runs
      everything. The classification is by what the diff contains, never by
      which parts of it the reviewer intends to look at.
- [ ] The gate does not run `build` and `test` for a change that contains no
      code. `hygiene` still runs on every change: its three checks are
      properties of a diff, not of the source tree.
- [ ] `ADR-012`'s guarantee survives. `ci.yml` runs its `checks` job on every
      push, so a path filter added to `scripts/gate/checks.ts` alone makes the
      two definitions disagree, and `scripts/gate/checks.ci.test.ts` is what
      says so. Either both carry the filter or the parity test is scoped to say
      why they differ — what is not acceptable is the gate quietly checking less
      than CI does.
- [ ] Root `CLAUDE.md` states when a `/teachers-ticket` run is needed and when a
      change is made directly. A change confined to `docs/backlog/**` is the
      tracker being updated, and does not get a ticket run of its own; what
      still holds for it is the backlog's own conventions and the checks `T-027`
      turns into tests.
- [ ] The rule names what a direct change still owes: a branch, a commit
      message in the convention, and a pull request. Direct means no ticket run,
      never no review and never a push to `main`.

## Notes

The measured cost of the full loop on a change is
`docs/architecture/design/T-034-context-cost-baseline.md`; this ticket is about
not paying it where it buys nothing.

Reviewing a change that contains no code is not free of findings, which is why
the contract pass stays: the backlog edits in the session that wrote this ticket
carried a `README.md` row that disagreed with its frontmatter, a criterion left
naming `--depth` after the argument was renamed to `--effort`, and a `## Notes`
paragraph calling `T-029` `in-progress` after it had been set `done`. All three
are defects a documentation-only diff can carry and a generic code review cannot
see.

Kept out of `T-033` on purpose: that ticket is being implemented, and editing
the criteria under a live implementation is how a pull request ends up
disagreeing with the ticket it claims to satisfy.
