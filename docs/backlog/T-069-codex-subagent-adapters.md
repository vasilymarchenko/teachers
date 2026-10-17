---
id: T-069
type: ticket
title: Codex subagent adapters — one .codex/agents TOML per project agent, pointing at its body
status: todo
depends_on: [T-068]
refs:
  - docs/architecture/decisions/ADR-031-codex-reads-the-harness-through-thin-adapters.md
  - docs/architecture/decisions/ADR-017-a-run-keeps-its-state-outside-its-context.md
  - .claude/agents/teachers-review-round.md
  - .claude/agents/teachers-review-contract.md
  - scripts/gate/skills.test.ts
  - docs/architecture/harness.md
---

## Goal

Let Codex dispatch the two project subagents with the same context boundary and
the same limits they have in Claude Code, as `ADR-031` decision 3 states. Each
body stays in `.claude/agents/<name>.md`. Each Codex adapter only points at its
body and sets the model and sandbox.

## Acceptance criteria

- [ ] The Codex custom-agent format is checked against Codex's documentation at
      the version recorded in `## Notes`: file location, the field that holds
      the instructions, and the model and sandbox fields.
- [ ] `.codex/agents/teachers-review-round.toml` and
      `.codex/agents/teachers-review-contract.toml` exist. Each one's
      instructions say only to read and follow `.claude/agents/<name>.md`,
      with the frontmatter ignored. Each sets a read-only sandbox, or the
      narrowest one that still runs the body's read-only `Bash` commands.
- [ ] A test in `scripts/gate/` holds `.claude/agents/*.md` and
      `.codex/agents/*.toml` one-to-one by name. It fails when an adapter
      names a body path that does not exist, or carries instructions beyond
      the pointer.
- [ ] `teachers-fix-loop` running in Codex dispatches `teachers-review-round`
      as a subagent and receives only the round's JSON. A run is done by hand
      on a pull request and recorded in `## Notes`.
- [ ] `docs/architecture/harness.md` §8 lists each subagent's Codex adapter.
- [ ] `npm run gate` passes.

## Notes
