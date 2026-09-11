---
id: T-034
type: ticket
title: Bound the context a /teachers-ticket run accumulates
status: todo
depends_on: [T-033]
refs:
  - .claude/skills/teachers-ticket/SKILL.md
  - .claude/skills/teachers-review/SKILL.md
  - CLAUDE.md
  - docs/architecture/decisions/ADR-012-one-check-definition.md
  - docs/backlog/T-029-gate-command-and-bounded-loop.md
---

## Goal

A `/teachers-ticket` run accumulates one context from phase 1 to phase 7 and
never resets it, so every tool call re-sends everything the run has read so far
and the cost of the run grows with the square of the number of calls it makes.
Give the run boundaries it can restart from, and give the agent working it the
two habits that keep each call small.

## Acceptance criteria

- [ ] Root `CLAUDE.md` states two working rules: independent reads, searches and
      shell calls go in one message rather than one per turn; and command output
      larger than a screen is written to a file and read back narrowed, never
      inlined.
- [ ] The skill writes a run state file at every phase boundary — ticket id,
      branch, pull request number, the plan condensed, the files touched, what
      remains — and each phase's first instruction is to read it.
- [ ] `/teachers-ticket --resume` picks a run up from that file alone, carrying
      no context from the session that wrote it.
- [ ] The loop is extracted as a named unit with a written contract — what a
      caller supplies, what it returns, where its state lives — invoked by
      `/teachers-ticket` phase 7 as its one consumer. A second caller must need
      no rewrite of it (`ADR-014`, implemented by `T-035`).
- [ ] Phase 7 runs each review round in a subagent whose input is the state
      file, the ticket path and the pull request number, and whose output is
      that round's findings in the `.gate/findings.json` shape. The round's own
      file reads do not enter the caller's context.
- [ ] Phase 7 exits when the previous round produced no finding inside the diff,
      without running a further round. Hitting a cap remains the other exit, and
      the caps stay in `scripts/gate/caps.ts` with no number restated in prose.
- [ ] Phase 7 passes `--effort medium` to `/teachers-review`, on every round,
      and `teachers-ticket` is the one file that states it — `teachers-review`
      references it rather than restating the value. The level names are
      `/code-review`'s, which `T-033` puts into `teachers-review` unchanged.
- [ ] The frontmatter `description` of `teachers-ticket` names `--resume`
      alongside the flags it already takes, so the arguments are readable from
      the skill list.
- [ ] Phases 6 and 7 do not run `npm run gate` against a tree it has already
      been run against; the ledger is read instead.
- [ ] No `sleep` is used to wait for CI; the skill names what it reads instead.
- [ ] A script reports, for one session transcript, the API-call count, the
      context size per call, and the four token classes per phase.
- [ ] `docs/architecture/design/T-034-context-cost-baseline.md` records the
      measured baseline from session `4c401314` and the same measurements taken
      from one real ticket worked with the reworked skill.
- [ ] An ADR records the phase-boundary state file and the subagent boundary at
      phase 7, with the measured evidence and the alternatives rejected.

## Notes

Baseline from session `4c401314` (the `/teachers-ticket T-021` run), measured
from the transcript: 535 API calls, 58.85M cache-read tokens against 1,070
fresh input tokens, and a context that grew from 67K to 244K across the run
without one reset. Phase 7 was 71.8% of it. All 141 tool calls in the main
session were issued one per assistant message.

Subagents are not a saving on their own: that run already spent 40% of its cost
in six of them, and the widest — the round-3 `/code-review` fork — reached a
~113K context of its own. The boundary in phase 7 earns its keep because the
round's input and output are both small, not because it is a subagent.

`medium` is the self-review level because a round's breadth is no longer what
keeps it honest: `T-033` scopes the pass to the diff, and the exit criterion
above stops the loop at the first round with no finding inside it. `high` bought
the measured run its third round and none of that round's findings were in the
pull request. A deliberate standalone `/teachers-review` still defaults to
`high`, and any round can be re-run by hand at a higher level.

The phase-7 exit criterion touches `scripts/gate/caps.ts`, which `T-029`
introduced; this ticket changes when the loop exits, not what the caps are. The
run this ticket is measured against is the one that closed `T-029`'s last
criterion.
