---
id: T-066
type: ticket
title: Root instructions live in AGENTS.md, and CLAUDE.md imports them
status: todo
depends_on: []
refs:
  - docs/architecture/decisions/ADR-031-codex-reads-the-harness-through-thin-adapters.md
  - CLAUDE.md
  - scripts/gate/hygiene.ts
  - docs/architecture/harness.md
---

## Goal

Make the root instructions readable by both Claude Code and Codex from one file,
as `ADR-031` decision 1 states: the content of the root `CLAUDE.md` moves into
a new root `AGENTS.md`, and `CLAUDE.md` keeps only `@AGENTS.md` and whatever
Claude Code alone needs. Nothing a Claude Code session reads changes. A Codex
session reads the same text.

## Acceptance criteria

- [ ] The root `AGENTS.md` holds what the root `CLAUDE.md` holds today, and its
      prose names "the agent" wherever it does not mean Claude Code
      specifically. A statement true of one agent only says which.
- [ ] The root `CLAUDE.md` holds `@AGENTS.md` and nothing else, or
      `@AGENTS.md` followed by a section headed as Claude Code only.
- [ ] The block `next dev` manages lives in `AGENTS.md`, and a `next dev` run
      against the tree leaves both files unchanged.
- [ ] `scripts/gate/hygiene.ts` checks that block in `AGENTS.md`, and its tests
      cover a block moved back into `CLAUDE.md` as a failure.
- [ ] `AGENTS.md` states that a directory's `CLAUDE.md` is read before writing
      into that directory, for an agent that does not load it on its own. The
      subtree files (`docs/backlog/`, `docs/features/`, `docs/scenarios/`)
      keep their names.
- [ ] Every reference to the root instructions in a living document — the
      skills, the agents, the subtree `CLAUDE.md` files, `harness.md`,
      `README.md`, the `docs/architecture/decisions/README.md` — names
      `AGENTS.md`. ADRs and `done` tickets are not edited.
- [ ] `docs/architecture/harness.md` §1 lists `AGENTS.md` as the root
      instructions and `CLAUDE.md` as Claude Code's import of them.
- [ ] `npm run gate` passes.

## Notes
