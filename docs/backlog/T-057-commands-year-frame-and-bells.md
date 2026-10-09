---
id: T-057
type: ticket
title: Commands 2/4 — the year frame and the bell schedule
status: todo
depends_on: [T-056]
refs:
  - docs/architecture/decisions/ADR-028-writes-are-commands-and-transports-are-adapters.md
  - docs/architecture/decisions/ADR-004-year-setup-valid-from.md
  - docs/architecture/architect-overview.md §8.1
---

## Goal

The second slice of ADR-028, in the shape T-056 set: the writes of `/year` and
the bell schedule move into commands, and their Server Actions become
adapters. The import of a timetable (T-053) needs the bell schedule command.
The teacher sees no difference.

## Acceptance criteria

- [ ] `lib/commands` holds the commands for the academic year (create,
      update, delete), semesters (create, update, delete), non-teaching
      periods (create, update, delete), weekday rules (create, update,
      delete), parity anchors (create, delete) and the bell schedule (save),
      in the shape and under the convention tests of T-056. Their target holds
      the ids the Server Actions now receive bound: the academic year's id
      for a create under a year, and the row's id (with its year's, where the
      action takes both) for an update or a delete. The bell schedule has an
      empty target.
- [ ] The rules these writes resolve at write time stay where they are
      resolved now: a weekday rule still starts at `ruleValidFrom()`
      (ADR-004), and every boundary still resolves when it is written
      (overview §8.1).
- [ ] T-050's tests for these actions pass unmodified.

## Notes
