---
id: T-067
type: ticket
title: Codex finds the project skills — .agents/skills links to .claude/skills, and a test holds the link
status: todo
depends_on: [T-066]
refs:
  - docs/architecture/decisions/ADR-031-codex-reads-the-harness-through-thin-adapters.md
  - docs/architecture/decisions/ADR-002-skill-project-prefix.md
  - scripts/gate/skills.test.ts
  - scripts/gate/checks.ts
  - docs/architecture/harness.md
---

## Goal

Give Codex the six project skills without a second copy, as `ADR-031`
decision 2 states: `.agents/skills` is a relative symlink to `../.claude/skills`,
a convention test fails if the link is broken, and the documents say how each
agent invokes a skill.

## Acceptance criteria

- [ ] `.agents/skills` is committed as a relative symlink to
      `../.claude/skills`, and nothing else is under `.agents/`.
- [ ] A test in `scripts/gate/` fails when `.agents/skills` is missing, is not
      a symlink (including a checkout that wrote it as a file), or resolves
      anywhere but `.claude/skills`. Its failure message names
      `core.symlinks` as the usual cause on Windows.
- [ ] `changeKind()` and the path routing in `scripts/gate/checks.ts` classify a
      path under `.agents/` the way they classify the same path under
      `.claude/`, and `checks.routing.test.ts` covers it.
- [ ] Codex, at the version recorded in `## Notes`, lists all six skills in
      this repository. The check is done by hand and recorded with the command
      used.
- [ ] Where a skill or a document tells the agent to run another skill by its
      slash command, it names the skill and its `SKILL.md` path, so the
      instruction holds in an agent whose invocation syntax differs.
      `AGENTS.md` states each agent's invocation syntax once.
- [ ] `README.md` (developer setup) states what a Windows checkout needs for
      the link to survive.
- [ ] `docs/architecture/harness.md` §1 lists `.agents/skills` as Codex's view
      of `.claude/skills`.
- [ ] `npm run gate` passes.

## Notes
