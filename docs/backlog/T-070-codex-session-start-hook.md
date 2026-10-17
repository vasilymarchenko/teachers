---
id: T-070
type: ticket
title: A Codex session starts from a current main — the same SessionStart script, registered in .codex/hooks.json
status: todo
depends_on: [T-066]
refs:
  - docs/architecture/decisions/ADR-031-codex-reads-the-harness-through-thin-adapters.md
  - docs/backlog/T-036-session-starts-from-current-main.md
  - .claude/hooks/session-start-fetch.sh
  - .claude/settings.json
  - scripts/gate/checks.routing.test.ts
  - docs/architecture/harness.md
---

## Goal

Give a Codex session the guarantee `T-036` gave a Claude Code session: it starts
with `origin/main` fetched. Codex runs the same script, registered in Codex's
own hook file, as `ADR-031` decision 4 states. The harness map also says which
of its elements serve one agent only (decision 6).

## Acceptance criteria

- [ ] The Codex hook format is checked against Codex's documentation at the
      version recorded in `## Notes`: file location, the `SessionStart` event,
      how the command finds the repository root, and the timeout field.
- [ ] `.codex/hooks.json` registers `.claude/hooks/session-start-fetch.sh` on
      `SessionStart`. The script is the same file `.claude/settings.json`
      registers, and it reads no variable only one agent sets.
- [ ] A Codex session in a trusted checkout runs the hook and shows its output.
      A session in an untrusted checkout does not, and the root instructions'
      rule for a session whose hook could not run covers that case. Both are
      checked by hand and recorded.
- [ ] `docs/architecture/harness.md` §4 describes both registrations.
- [ ] `docs/architecture/harness.md` §1 and §11 mark `npm run cost` as Claude
      Code only, and every other element of §1 as serving both agents or
      naming the one it serves.
- [ ] `npm run gate` passes.

## Notes
