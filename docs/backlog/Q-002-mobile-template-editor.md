---
id: Q-002
type: question
title: Mobile interaction pattern for the weekly template editor
status: answered
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

Answered: the day-centric flow. On a narrow screen both the calendar and the
template editor show **one day** — that day's lessons, with navigation between
days — and the 6 × 10 grid appears only from the tablet breakpoint up, as a
wrapper over seven day components rather than the other way round.

The decision and its consequence for how the components split are recorded in
`docs/architecture/architect-overview.md` §10.2; this file is the record that it
was asked.

## Cost of changing later

Highest of the open questions, and structural: it decides how the calendar and
template-editor components are split. Zero cost while no component exists;
designing a desktop table first most likely means rewriting the editor rather
than adding CSS.

Domain and schema are unaffected — `expand()`, `parity()` and the data model do
not depend on this at all.

## Needed from

A design decision before UI work starts — taken, so T-007 and T-010 no longer
wait on it.
