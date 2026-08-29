---
id: T-008
type: ticket
title: Read queries for the calendar data path
status: done
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

- [x] One query module per read: `AcademicYear` + `Semester` frame,
      `NonTeachingPeriod` and `NonTeachingWeekdayRule` for a range,
      `BellSchedule`, `ParityAnchor[]`, the `ScheduleTemplate` versions
      covering a range with their `TemplateSlot`s, `DayOverride` for a range,
      `Event` for a range.
- [x] Every function takes `userId` as its first argument (overview §8.4) and
      is read-only.
- [x] One assembling query returns exactly the input `expand()` takes for a
      `(range, view)` pair; the domain still receives plain data, no Drizzle
      types leak into `lib/domain`.
- [x] Range queries select by overlap, not by loading a whole year and
      filtering in JS.
- [x] Integration test against a seeded database: the assembled input for the
      T-001 fixture range equals the fixture document's input rows.
- [x] Index usage checked for the range queries; each starts with `user_id`.

## Notes

Mechanics — signatures, the predicate of each range read, the query count and
the observed index usage — are in
`docs/architecture/design/T-008-calendar-read-queries.md`.

Two reads are deliberately not overlap reads, and that document says why:
`ParityAnchor` is read up to the end of the window, and the template and
override reads return both views whatever view is being rendered.

`scripts/seed.ts`'s transcription of the fixture rows moved to
`lib/db/fixtures/scenarioRows.ts` so that the seed and the integration suite
insert the same rows; it stays independent of the domain-side transcription in
`lib/domain/schedule/fixtures/scenario.ts`, which is what the new test compares
it against.
