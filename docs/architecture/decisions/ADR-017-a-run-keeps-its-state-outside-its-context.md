---
id: ADR-017
title: A run keeps its state outside its context — a phase-boundary file, and a subagent per review round
status: accepted
date: 2026-09-12
ticket: T-034
---

## Context

A `/teachers-ticket` run is one conversation from phase 1 to phase 7 and never
resets it. Every API call re-sends everything the run has read so far, so the
cost of a run grows with the square of the number of calls it makes, and a
single inlined command output is paid for again on every call that follows it.

Measured on session `4c401314`, the `/teachers-ticket T-021` run, from its own
transcript: 535 API calls, 58.85M cache-read tokens against 1,070 fresh input
tokens, a context that grew from 67K to 244K without one reset, and phase 7
alone accounting for 71.8% of it. All 141 tool calls in the main session were
issued one per assistant message. The measurements, and the script that takes
them, are `docs/architecture/design/T-034-context-cost-baseline.md`.

Nothing in that shape is specific to `T-021`. A run reads the ticket, the
documents its `refs` name, the code it touches and its own diff — and then
carries all of it, unread, through every call of every later phase, because the
conversation is the only place the run remembers anything.

Two further facts bound the options. Subagents are not a saving on their own:
that run already spent 40% of its cost in six of them, and the widest — the
round-3 `/code-review` fork — reached a ~113K context of its own. And a
compacted context is guaranteed to lose exactly what the loop's caps are counted
from, which is why `T-029` already made every count derive from a file
(`.gate/ledger.jsonl`, `.gate/findings.json`) rather than from memory.

## Options

**Leave the run as one context and ask the agent to read less.** No new
mechanism, and the two working rules the root `CLAUDE.md` now states (batch
independent calls; write large output to a file and read it back narrowed) are
most of what it would buy. It does not bound anything: the rules lower the
constant, the growth stays quadratic, and a run interrupted at phase 5 still
starts over.

**Compact the context between phases.** The harness can summarise; a phase
boundary is a natural place to do it. It costs the one thing a summary cannot
promise — that what the next phase needs survived. The facts a later phase needs
are few and nameable (the branch, the pull request number, the plan condensed,
which criteria are covered), and a summary is a worse carrier for them than a
list, because nothing says which fields it dropped.

**Persist the run's own state at every phase boundary, and put a subagent
boundary at the review round.** The state file is the run's memory outside the
conversation: written at every boundary, read first by every phase, and enough
on its own for `--resume` to continue from. The review round becomes a subagent
whose inputs are three values and whose output is that round's findings as JSON,
so the round's own reads — the diff, the documents, the code — never enter the
caller's context. It costs a file to keep honest and a contract at the round
boundary.

## Decision

**The run's state lives in `.gate/run.json`, written at every phase boundary and
read first by every phase.** It holds the ticket and its path, the branch, the
pull request number, the flags in force, the plan condensed to one line per
file, the acceptance criteria against the work that covers them, the files
touched and what remains. `/teachers-ticket --resume` picks a run up from that
file alone, carrying no context from the session that wrote it. `.gate/` is
git-ignored and already holds the ledger and the findings, so the run's records
sit together and none of them reaches a diff.

**Each review round of phase 7 runs in a subagent** — the `teachers-review-round`
agent — whose input is the state file path, the ticket path and the pull request
number, and whose output is that round's findings in the `.gate/findings.json`
shape. The boundary earns its keep because the round's input and output are both
small, **not** because it is a subagent; a subagent handed the caller's context
would cost more than it saves, which is what the measured run demonstrates.

**The loop itself is one unit** — `/teachers-fix-loop` — with a written
contract, called by `/teachers-ticket` phase 7 with a ticket bound and by
`/teachers-land` (`T-035`) without one. That is `ADR-014` implemented rather
than re-decided here.

Two consequences of the same reasoning, recorded with it: a round runs at
`--effort medium`, stated once in `/teachers-ticket`, because the review is
already scoped to the diff (`ADR-015`) and the loop stops at the first round
with no finding inside it; and phases 6 and 7 do not gate a tree that
`.gate/last-run.json` says has already been gated.

## Consequences

A phase that finishes work the state file does not record is work a resumed run
does twice. That is the standing cost of the file, and the reason the write is
part of the phase rather than a step after it.

The caller of a round can no longer see what the round read. A finding it
disagrees with cannot be argued with by re-reading the diff in the caller's
context — that re-read is the cost the boundary exists to avoid. The recourse is
to re-run the round by hand at a higher effort, which is a deliberate purchase.

The state file is not validated by any code, for the same reason
`.gate/findings.json` is not: a validator can check that a field is not empty,
never that it is true. What makes it worth keeping is that the next phase reads
it and a resumed session can.

Revisit when the measurements say so. The design document holds the baseline and
the runs taken against the reworked skill; if a reworked run does not move the
cache-read total and the phase-7 share materially, the boundaries are in the
wrong place and the honest answer is to move them rather than to add more of
them.
