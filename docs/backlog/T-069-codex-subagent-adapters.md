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
  - .claude/skills/teachers-fix-loop/SKILL.md
  - .claude/skills/teachers-review/SKILL.md
  - .claude/skills/teachers-ticket/SKILL.md
  - scripts/gate/skills.test.ts
  - docs/architecture/harness.md
---

## Goal

Let Codex dispatch the two project subagents with the same context boundary they
have in Claude Code, as `ADR-031` decision 3 states. Each body stays in
`.claude/agents/<name>.md`, and each Codex adapter only points at its body and
sets the model. The caller enforces that a review round edited nothing.

## Acceptance criteria

- [ ] The Codex custom-agent format is checked against Codex's documentation at
      the version recorded in `## Notes`: the file location, the field that
      holds the instructions, the model field, and whether a custom agent can
      narrow the sandbox it inherits from its parent.
- [ ] `.codex/agents/teachers-review-round.toml` and
      `.codex/agents/teachers-review-contract.toml` exist. Each one's
      instructions say only to read and follow `.claude/agents/<name>.md`,
      with the frontmatter ignored. Neither claims a sandbox the recorded
      version does not enforce.
- [ ] `teachers-fix-loop` records `HEAD` and the working tree's status before it
      dispatches a review round. When the round returns, it refuses the round,
      and says so, if either has changed. The same holds in `teachers-review`
      for the contract pass. `harness.md` §8 states this check as what
      enforces "never edits" in Codex.
- [ ] A test in `scripts/gate/` holds `.claude/agents/*.md` and
      `.codex/agents/*.toml` one-to-one by name. It fails when an adapter
      names a body path that does not exist, or carries instructions beyond
      the pointer.
- [ ] `teachers-fix-loop` running in Codex dispatches `teachers-review-round`
      as a subagent and receives only the round's JSON. A run is done by hand
      on a pull request and recorded in `## Notes`.
- [ ] A `/teachers-ticket` run crosses agents in one working tree, checked by
      hand and recorded. Claude Code starts the run and stops it inside phase
      7. Codex resumes it with `--resume`. Claude Code then resumes it again.
      At each handover, the phase, `.gate/findings.json` and the consumed caps
      are what the previous agent left, and no completed phase or round runs
      again. `harness.md` states that `.gate/` does not travel with a push or
      to another clone.
- [ ] `docs/architecture/harness.md` §8 lists each subagent's Codex adapter,
      and the subagent rows of §1 name both agents.
- [ ] `npm run gate` passes.

## Notes
