# Architectural decision records

One file per significant decision, English, `ADR-NNN-short-kebab-title.md`. Ids
are assigned once and never reused.

## What an ADR is for

An ADR answers *why*, at a point in time: what the situation was, which options
were real, which one was taken, and what it costs. It is written when the
decision is made and **never rewritten afterwards** — a decision that turns out
wrong is superseded by a new ADR, not edited into agreement with the present.

That immutability is the whole value. Every other document in this repository
describes the current state and is updated in place, which means none of them
can tell you why the state is what it is, or which alternative was already tried
and rejected. Without that record the same rejected option is re-proposed every
few months, and each time it costs a discussion.

## Where it sits among the other documents

| Document | Answers | Lifecycle |
|---|---|---|
| `docs/specs/specification.md` | what the teacher needs | updated with the product |
| `docs/architecture/architect-overview.md` | what is true now, and how it hangs together | updated in place |
| `docs/architecture/decisions/` | why this, and not that — as of a date | immutable |
| `docs/architecture/design/` | mechanics: schema, signatures, fixtures | updated in place |
| `docs/backlog/` | what to do, and when it is done | status changes |

**No fact lives in two of them.** `architect-overview.md` states the decision's
outcome and links to the ADR; the ADR is where the alternatives and their costs
live, and the overview must not re-argue them. Where the overview already
carries the reasoning for a decision taken before this practice existed — §9's
compromise table and §10's open questions — it stays there; an ADR is written
for that decision only if it is reopened.

## When to write one

Any of these:

- the decision changes the data model, or a contract other tickets are written
  against;
- it chooses between real alternatives whose cost outlives the ticket;
- it would otherwise have to be reverse-engineered from the code;
- it reverses or supersedes an earlier decision.

Not for every ticket, and not for a choice that the next developer would make
the same way without being told. Ceremony that records the obvious teaches
everyone to skip reading the ones that matter.

## Template

```markdown
---
id: ADR-NNN
title: Short imperative title
status: accepted        # proposed | accepted | superseded by ADR-MMM
date: YYYY-MM-DD
ticket: T-NNN           # or — , if the decision came from outside a ticket
---

## Context

The situation that forced a choice. Facts and constraints only, no advocacy.

## Options

Each real option, with what it costs. An option nobody seriously considered is
not an option — listing it to make the chosen one look better is noise.

## Decision

What was chosen, stated so that code can be checked against it.

## Consequences

What this costs, what it makes cheap, and what would make it worth revisiting.
The revisit condition is the part a reviewer needs: without it, every future
reader has to re-derive whether the decision still holds.
```

## Status and supersession

A decision that no longer holds gets `status: superseded by ADR-MMM`, and the
new ADR's `## Context` says what changed. Both files stay. The record of a
reversal is worth as much as the record of the original choice — more, usually,
because it carries the evidence that the first answer was wrong.
