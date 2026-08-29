---
id: T-007
type: ticket
title: Calendar read views — day, week, month, year
status: todo
depends_on: [T-005, T-008, T-014]
refs:
  - docs/architecture/architect-overview.md §5
  - docs/specs/specification.md §6
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
- [ ] Views are usable on a 390 px viewport, following the day-centric flow of
      overview §10.2.
- [ ] Year-view render time measured and recorded, against the ~300 ms trigger
      in overview §9.

## Notes

Q-002 is answered — the day-centric flow of `architect-overview.md` §10.2 — and
the data path is `getScheduleInput()` (T-008). The shell the views render into
is T-014, now done, so nothing blocks this ticket. Read-only by design: writing
is T-010 (templates) and T-011 (day overrides).

The year-view render measurement is a number recorded in the PR body and in
these notes when the work is done — not a committed benchmark.
