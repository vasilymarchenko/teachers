---
id: Q-002
type: question
title: Mobile interaction pattern for the weekly template editor
status: open
depends_on: []
refs:
  - docs/architecture/architect-overview.md §10.2
  - docs/specs/specification.md §1
---

## Question

The specification requires a fully functional mobile version. A 6 × 10 weekly
template grid does not fit 390 px, so the editor needs its own interaction
pattern — a day-centric input flow, for instance — rather than a responsive
table. Which pattern?

## Current default

None. No UI code exists yet.

## Cost of changing later

Highest of the open questions, and structural: it decides how the calendar and
template-editor components are split. Zero cost while no component exists;
designing a desktop table first most likely means rewriting the editor rather
than adding CSS.

Domain and schema are unaffected — `expand()`, `parity()` and the data model do
not depend on this at all.

## Needed from

A design decision before UI work starts. Blocks T-007 and T-010; blocks nothing
before them.
