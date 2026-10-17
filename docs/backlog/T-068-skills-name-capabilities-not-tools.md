---
id: T-068
type: ticket
title: Skills and agents name a capability, not a Claude Code tool — one map in AGENTS.md binds each to both agents
status: todo
depends_on: [T-066, T-067]
refs:
  - docs/architecture/decisions/ADR-031-codex-reads-the-harness-through-thin-adapters.md
  - docs/architecture/decisions/ADR-014-review-measures-the-loop-fixes.md
  - .claude/skills/teachers-review/SKILL.md
  - .claude/skills/teachers-ticket/SKILL.md
  - .claude/skills/teachers-idea/SKILL.md
  - .claude/skills/teachers-scenarios/SKILL.md
  - .claude/skills/teachers-fix-loop/SKILL.md
  - .claude/agents/teachers-review-round.md
  - scripts/gate/skills.test.ts
  - docs/architecture/harness.md
---

## Goal

Make every skill and agent body executable in both agents, as `ADR-031`
decision 5 states. The bodies name capabilities. One section of `AGENTS.md`
binds each capability to Claude Code's tool and to Codex's. Where Codex has no
counterpart, the same section says what Codex does instead. A convention test
keeps tool names out of the bodies.

## Acceptance criteria

- [ ] `AGENTS.md` has one section that lists each capability the bodies use,
      with its Claude Code binding and its Codex binding. At least these:
      ask the user structured questions (`AskUserQuestion`); dispatch a named
      project subagent; dispatch a planner (`Plan`); dispatch a read-only
      explorer (`Explore`); dispatch a general subagent (`general-purpose`);
      invoke another skill (`Skill`); run the generic correctness review
      (`/code-review`).
- [ ] For the generic correctness review, the Codex binding states what runs,
      and what each `--effort` level of `teachers-review` buys there. The
      review report names the binding that ran.
- [ ] For asking the user, the Codex binding states how a skill's "stop if
      asking is denied" rules apply when no structured-question tool exists.
- [ ] No skill or agent body names a tool from the map outside a quotation of
      the map's section. A test in `scripts/gate/skills.test.ts` enforces it
      over every `SKILL.md` and every agent definition.
- [ ] `teachers-review` keeps its `--effort` vocabulary. Its phase 1 table
      states the levels as its own, and states their meaning in each binding
      by reference to the map.
- [ ] `docs/architecture/harness.md` §1 and §8 refer to the map instead of
      naming Claude Code's built-in subagents and skills as the only binding.
- [ ] `npm run gate` passes.

## Notes
