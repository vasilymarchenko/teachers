---
id: Q-003
type: question
title: Which printed reports are actually required
status: open
depends_on: []
refs:
  - docs/architecture/architect-overview.md#10.3
  - docs/specs/specification.md#12.1
  - docs/specs/specification.md#7
---

## Question

Which documents must be printable: weekly schedule, semester schedule, class
list, anything else?

## Current default

None chosen. Print is a set of `/print/...` pages over the existing
`ResolvedDay[]` / `Event[]`.

## Cost of changing later

Low and isolated — one page per report. The only real risk is a report needing
data the model does not hold at all; aggregations such as total hours per
subject per semester are derivable from `expand()`, but have to be known about.

## Needed from

The teacher, before print work starts. Does not affect the schema.
