---
id: T-020
type: ticket
title: Prefix project-specific skills and agents with teachers-
status: done
depends_on: []
refs:
  - docs/architecture/decisions/ADR-002-skill-project-prefix.md
---

## Goal

Rename the `review` and `ticket` skills and the `review-contract` agent to
`teachers-review`, `teachers-ticket` and `teachers-review-contract`, so a
project-specific tool cannot collide with a generically named skill from
another plugin or repository — `ADR-002`.

## Acceptance criteria

- [x] `.claude/skills/review/` is renamed to `.claude/skills/teachers-review/`,
      and its frontmatter `name:` matches.
- [x] `.claude/skills/ticket/` is renamed to `.claude/skills/teachers-ticket/`,
      and its frontmatter `name:` matches.
- [x] `.claude/agents/review-contract.md` is renamed to
      `.claude/agents/teachers-review-contract.md`, and its frontmatter `name:`
      matches.
- [x] Every `/review` and `/ticket` invocation, and every `review-contract`
      reference, inside the two renamed `SKILL.md` files and the renamed agent
      file, uses the new names. Git-branch-naming examples
      (`claude/ticket-t-NNN-*`) are a separate convention and are untouched.
- [x] `ADR-002` records the rule and its rationale for every future skill or
      agent added to this repository.
- [x] Completed tickets and ADRs that mention the old names
      (`T-017`, `T-018`, `ADR-001`) are left as-is — they are the immutable
      record of what was true when they were written, per the ADR practice in
      `docs/architecture/decisions/README.md`.

## Notes

No other file in the repository invoked these skills or the agent by name —
root `CLAUDE.md`, `docs/backlog/CLAUDE.md` and the `vam-handoff` skill only
reference the backlog and ADR conventions generically, not by skill name.
