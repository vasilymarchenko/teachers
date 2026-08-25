# CLAUDE.md — `docs/backlog/`

Backlog conventions. These rules apply to every file in this directory.

## What this directory is

A flat, file-per-item backlog kept in git. There is no external tracker; this
directory **is** the tracker. Two levels only: `README.md` (index) and one file
per item.

## Language

English, always — backlog items are developer-only artefacts, the same bucket as
ADRs and implementation plans (see root `CLAUDE.md`). This holds even though the
documents they reference (`docs/specs/**`, `docs/architecture/**`) are Ukrainian.

Domain entities keep their English identifiers from
`docs/architecture/glossary.md` verbatim — `ScheduleTemplate`, `DayOverride`,
`expand()`. A term that is not in the glossary does not exist yet: add it there
first.

## File naming

- Tickets: `T-NNN-short-kebab-title.md`
- Open questions: `Q-NNN-short-kebab-title.md`

IDs are assigned once and never reused, even after an item is deleted. The number
carries no priority meaning — order lives in `README.md`.

## Required frontmatter

```yaml
---
id: T-001
type: ticket          # ticket | question
title: Short imperative title
status: todo          # tickets:   todo | in-progress | blocked | done
                      # questions: open | answered
depends_on: []        # list of ids, e.g. [T-002, Q-002]
refs: []              # paths into docs/, with a section anchor where useful
---
```

`status` lives **only** in the frontmatter — that is the authoritative value.
`README.md` is derived data: it mirrors `id`, `title`, `status` and `depends_on`
for reading convenience, and holds no field that is not derived from the
frontmatter. (The questions table's *Blocks* column is the inverse of the other
items' `depends_on`, so it too changes when a `depends_on` changes.)

**Any edit to an item's `id`, `title`, `status` or `depends_on` obliges you to
update `README.md` in the same commit.** The same goes for adding, deleting or
renaming an item file. A README row that disagrees with the frontmatter it
mirrors is a bug, not a stale detail — fix it when you see it. Never edit a
value in `README.md` without changing the item file it came from.

The index is maintained by hand until a regeneration script exists. To see the
authoritative state and compare it against the table:

```sh
grep -H -E '^(id|title|status|depends_on):' docs/backlog/[TQ]-*.md
```

## Body structure

Tickets: `## Goal` (one paragraph), `## Acceptance criteria` (checkbox list),
`## Notes` (decisions taken while doing the work, links to commits).

Questions: `## Question`, `## Current default` (what the code does until it is
answered), `## Cost of changing later`, `## Needed from`.

## The rule that matters most

**A backlog item states what to do and when it is done — never why.**

The reasoning lives in `docs/architecture/architect-overview.md` and
`docs/specs/specification.md`; a ticket points at the relevant section through
`refs:` instead of restating it. Every fact in exactly one place. A ticket that
re-explains the architecture goes stale within a week and then silently
contradicts the document it copied.

## Keeping it honest

- Update `status` in the same commit as the work it describes — in the item
  file and in `README.md` together.
- When work reveals a decision that changes the design, update
  `architect-overview.md` and reference it — do not bury the decision in
  `## Notes`.
- Close a question by setting `status: answered`, recording the answer in the
  architecture document, and leaving the file as the record of what was decided.
