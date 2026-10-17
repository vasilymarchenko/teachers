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
  - .claude/agents/teachers-review-contract.md
  - scripts/gate/skills.test.ts
  - docs/architecture/harness.md
---

## Goal

Make every skill and agent body executable in both agents, as `ADR-031`
decision 5 states. The bodies name capabilities. One section of `AGENTS.md`
binds each capability to Claude Code's tool and to Codex's. Where Codex has no
counterpart, the same section says what Codex does instead. A convention test
holds the map complete, and a run in Codex shows that each binding works.

## Acceptance criteria

- [ ] `AGENTS.md` has one section that lists each capability the bodies use,
      with its Claude Code binding and its Codex binding. It holds the
      differences that change what a run does, and at least these: ask the
      user structured questions (`AskUserQuestion`); dispatch a named project
      subagent; dispatch a planner (`Plan`); dispatch a read-only explorer
      (`Explore`); dispatch a general subagent (`general-purpose`); invoke
      another skill (`Skill`); run the generic correctness review
      (`/code-review`). A tool that differs only in name (a shell), or that a
      body already uses conditionally ("`ReportFindings` when the session has
      it"), gets no entry. `## Notes` records the search over the bodies that
      produced the list.
- [ ] The map's entry for invoking another skill is where the invocation
      syntax `T-067` wrote into `AGENTS.md` now lives, and `AGENTS.md` states
      it once.
- [ ] For the generic correctness review, the Codex binding states what runs,
      and what each `--effort` level of `teachers-review` buys there. The
      review report names the binding that ran.
- [ ] For asking the user, the Codex binding states how a skill's "stop if
      asking is denied" rules apply when no structured-question tool exists.
- [ ] Where a body tells the agent to use one of the map's capabilities, it
      names the capability as the map spells it. A tool name may stay in an
      explanation or an example.
- [ ] A test in `scripts/gate/skills.test.ts` fails when a body names a
      capability the map does not list, or when a map entry lacks a Claude
      Code or a Codex binding. It does not ban tool names in prose.
- [ ] Each skill that uses a capability from the map is run once in Codex, far
      enough to reach each capability it uses. `## Notes` records the
      version, what each binding did, and any binding that did not work.
- [ ] `teachers-review` keeps its `--effort` vocabulary. Its phase 1 table
      states the levels as its own, and states their meaning in each binding
      by reference to the map.
- [ ] `docs/architecture/harness.md` §1 and §8 refer to the map instead of
      naming Claude Code's built-in subagents and skills as the only binding.
- [ ] `npm run gate` passes.

## Notes
