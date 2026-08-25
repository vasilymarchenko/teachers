---
id: T-007
type: ticket
title: Calendar read views — day, week, month, year
status: blocked
depends_on: [T-005, T-006, Q-002]
refs:
  - docs/architecture/architect-overview.md#5
  - docs/specs/specification.md#6
---

## Goal

Render the four calendar views over `ResolvedDay[]`, with the `OWN` / `CLASS`
switch. Read-only: no editing of templates or overrides in this ticket.

## Acceptance criteria

- [ ] Day, week, month and year views, each a different date range passed to the
      same `expand()` call plus an `Event` query over that range.
- [ ] `OWN` / `CLASS` switch per specification §6.2, with `isTaughtByMe` marked
      on the `CLASS` side.
- [ ] Week starts on Monday everywhere (overview §8.5).
- [ ] `SUBSTITUTION` shows `replacedOriginal` alongside the new lesson;
      `CLEARED` renders as a cancelled lesson, distinct from an empty slot.
- [ ] Non-teaching days are visually distinct and name their
      `NonTeachingPeriod`.
- [ ] All UI text in Ukrainian (root `CLAUDE.md`).
- [ ] Views are usable on a 390 px viewport; the interaction pattern follows
      whatever Q-002 settles.
- [ ] Year-view render time measured and recorded, against the ~300 ms trigger
      in overview §9.

## Notes

Blocked on Q-002 only for the layout pattern — the data path is ready as soon as
T-005 and T-006 land.
