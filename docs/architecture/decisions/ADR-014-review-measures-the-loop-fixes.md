---
id: ADR-014
title: The review tooling measures and never edits; the fix-and-merge loop is a caller
status: accepted
date: 2026-09-11
ticket: T-035
---

## Context

`/teachers-review` holds the method for judging a change and edits nothing: it
reports findings, and its phase 6 proposes a lint rule or a convention test
rather than writing one. Two of its rules depend on that: a proposal that wrote
itself into the working tree would mix the reviewer's edits into the diff under
review, and a reviewer that fixed a defect would be grading its own fix in the
same context that produced it.

The loop that *does* fix — review, triage, fix, gate, re-review, under caps
counted from records the agent did not author — exists, but only as prose inside
`/teachers-ticket` phase 7. It is reachable only from a run that selected a
backlog ticket and implemented it in the same session.

Two things follow. The habitual invocation — review this pull request, fix what
the review finds, then merge it — has no entry point at all. And a pull request
that this session did not produce, one stalled on a red check or on review
comments from yesterday, cannot reach the loop: `/teachers-ticket` would begin
by choosing a ticket and cutting a branch.

`T-034` rewrites that loop — a phase state file, a subagent boundary per round,
an exit criterion that stops at the first round with no finding inside the diff.
Whatever shape the loop ends up in, it is being written now, which is when the
cost of giving it a second caller is lowest.

## Options

**Add `--fix` to `/teachers-review`.** One flag, no new file, and the thing the
user asks for is where they already look for it. It costs the property that
makes the review worth running: the reviewer would apply a fix and then be the
one to judge whether the fix holds, in the context that produced it. Phase 6
would have to be suppressed or would contaminate the diff under review. The
skill's own description — reviews only, never edits — stops being true, and the
`/teachers-ticket` loop that calls it would be calling something that edits
behind its back.

**A second skill carrying its own copy of the loop.** Keeps the review read-only
and gives the invocation an entry point. It costs a second copy of the caps, the
four dispositions, the rule that a count comes from a record the agent did not
author, and the exit criterion — the things `T-029` spent a ticket getting
right. Two copies of a loop diverge at the first change to either, and the
divergence is silent because nothing compares them.

**Extract the loop once; give it two entry points.** The loop becomes a named
unit with a stated contract: what a caller supplies, what it returns, where its
state lives. `/teachers-ticket` phase 7 is a call into it with a ticket bound;
a new `/teachers-land <pr>` is the same call with no ticket. It costs one more
file, one more contract to keep honest, and the discipline of writing the loop
so that what it cannot infer — a ticket, or the absence of one — is an argument
rather than an assumption.

## Decision

The review tooling **measures**. `/teachers-review` reports findings, proposes
in phase 6, and edits nothing; its two policy flags (`--merge`, `--comment`) stay
the only way it touches a pull request. No `--fix`.

The **fix-and-merge loop is a caller of it**, extracted once by `T-034` with a
stated contract and invoked by two entry points:

- `/teachers-ticket` phase 7 — the loop with a ticket bound, which is what lets
  it tick acceptance criteria and set the ticket's status;
- `/teachers-land <pr>` (`T-035`) — the loop with no ticket, for a pull request
  this session did not produce.

Merging stays in `/teachers-review` under `--merge`: the merge conditions are
already stated there, and the loop's exit condition — a round that leaves no
finding inside the diff — is the same condition the merge policy requires, so
the loop passes the flag rather than re-deciding it.

This decision is checkable: a second copy of the caps, the dispositions or the
count-derivation rules appearing in any skill file contradicts it.

## Consequences

The loop gains a contract that must be written down, and both callers are bound
by it. That is the cost of not having two copies, and it is paid once.

A review stays usable as the loop's measuring instrument precisely because it
cannot fix. That is what makes a second round's empty report mean something:
nothing the reviewer did between the rounds could have caused it.

`/teachers-land` inherits the caps rather than getting its own. A stalled pull
request that needs more than the cap allows will stop and report what is open,
the same as a ticket run does, and that is the intended answer — a run of rounds
that did not converge is information.

Revisit if the two callers stop needing the same loop. The likeliest wedge is
the ticket-bound end: `/teachers-ticket` must tick acceptance criteria against
evidence and set a backlog status, and a bare pull request has neither. If that
divergence grows past what one argument can carry, the shared unit is the wrong
shape and the honest fix is two loops with a shared vocabulary, not a contract
with a growing list of exceptions.
