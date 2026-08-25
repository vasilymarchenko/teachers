---
id: Q-001
type: question
title: Does a full break week consume a parity position?
status: open
depends_on: []
refs:
  - docs/architecture/architect-overview.md#10.1
  - docs/architecture/architect-overview.md#3.5
  - docs/specs/specification.md#4
---

## Question

When a break covers a whole week, does the next teaching week continue the
alternation (the break week consumed a position), or repeat the parity of the
last teaching week?

## Current default

Consumed: the counter walks consecutive ISO weeks. The default lives inside
`parity.ts` and its tests, nowhere else.

## Cost of changing later

Minimal. One pure function and its tests. No migration, no model change, no
stored data to rewrite — `ParityAnchor` records points, not results.

## Needed from

The teacher: how the school actually behaves. Wanted before the first release;
does not block development. If wrong, the calendar shows shifted parity after
each break until a manual `ParityAnchor` reset is added — display only, no data
corruption.
