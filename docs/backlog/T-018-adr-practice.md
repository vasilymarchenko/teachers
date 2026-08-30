---
id: T-018
type: ticket
title: ADR practice — record significant decisions where they can be found
status: done
depends_on: []
refs:
  - CLAUDE.md
  - docs/architecture/decisions/README.md
---

## Goal

Add architectural decision records to this repository's documentation set, and
make `/ticket` write one when a decision earns it and `/review` check that it
exists.

## Acceptance criteria

- [x] `docs/architecture/decisions/` holds one file per decision,
      `ADR-NNN-short-kebab-title.md`, English, with frontmatter carrying `id`,
      `title`, `status`, `date` and the `ticket` it came from.
- [x] `docs/architecture/decisions/README.md` states the conventions: what an
      ADR answers, why it is never rewritten, the template, and how supersession
      works.
- [x] The boundary against the existing documents is explicit and admits no
      overlap: `architect-overview.md` states what is true now and links to the
      ADR, `design/` states mechanics, the ADR holds the options and their
      costs. A decision taken before this practice existed is not back-filled
      unless it is reopened.
- [x] A trigger list says when to write one — a change to the data model or to a
      contract other tickets are written against, a choice between real
      alternatives whose cost outlives the ticket, something that would
      otherwise be reverse-engineered from the code, or a reversal — and says
      plainly that most tickets produce none.
- [x] The root `CLAUDE.md` documentation map lists the directory, and the
      language rules cover it: English, like `design/`, because the audience is
      a developer — even though an ADR carries reasoning and the Ukrainian
      overview carries reasoning too.
- [x] `/ticket` phase 5 writes an ADR when the trigger fires, commits it with
      the work, and names it in the ticket's `## Notes`; phase 4's documentation
      impact asks whether one is earned.
- [x] `ADR-001` exists and records a real decision, not a placeholder.

## Notes

`ADR-001` records the decision that the review tooling reads the project's
documents rather than carrying a copy of them — taken during T-017, after the
copy failed twice in a day. It was the first decision to hand and it exercises
the template honestly: two real rejected options, and a revisit condition.

Worked in the same branch as T-017 at the user's request, rather than on its own.

The practice deliberately does not back-fill. `architect-overview.md` §9 already
records the accepted compromises with their review triggers, and §10 the open
questions with their current defaults; turning those into ADRs would move facts
that are already in exactly one place, which is the rule this repository is
built on. They become ADRs only if reopened.
