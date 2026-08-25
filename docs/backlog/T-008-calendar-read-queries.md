---
id: T-008
type: ticket
title: Read queries for the calendar data path
status: todo
depends_on: [T-004, T-006]
refs:
  - docs/architecture/architect-overview.md §2
  - docs/architecture/architect-overview.md §5
  - docs/architecture/architect-overview.md §8.4
---

## Goal

Implement `lib/db/queries` for everything `expand()` and the calendar need for a
date range, so that T-007 renders a domain result instead of assembling rows of
its own.

## Acceptance criteria

- [ ] One query module per read: `AcademicYear` + `Semester` frame,
      `NonTeachingPeriod` and `NonTeachingWeekdayRule` for a range,
      `BellSchedule`, `ParityAnchor[]`, the `ScheduleTemplate` versions
      covering a range with their `TemplateSlot`s, `DayOverride` for a range,
      `Event` for a range.
- [ ] Every function takes `userId` as its first argument (overview §8.4) and
      is read-only.
- [ ] One assembling query returns exactly the input `expand()` takes for a
      `(range, view)` pair; the domain still receives plain data, no Drizzle
      types leak into `lib/domain`.
- [ ] Range queries select by overlap, not by loading a whole year and
      filtering in JS.
- [ ] Integration test against a seeded database: the assembled input for the
      T-001 fixture range equals the fixture document's input rows.
- [ ] Index usage checked for the range queries; each starts with `user_id`.

## Notes
