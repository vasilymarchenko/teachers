---
id: T-001
type: ticket
title: Golden fixtures for expand() — the hard-week walkthrough
status: done
depends_on: []
refs:
  - docs/architecture/design/expand-fixtures.md
  - docs/architecture/architect-overview.md §3
  - docs/architecture/architect-overview.md §11
  - docs/specs/specification.md §4
  - docs/specs/specification.md §5
---

## Goal

Produce `docs/architecture/design/expand-fixtures.md`: a hand-computed academic
year fragment covering the three mechanics that interact worst — a mid-week
`ScheduleTemplate` version change, a `ParityAnchor` reset after a break, and a
`SUBSTITUTION` — together with the exact `ResolvedDay[]` each date must yield.
The document is the specification the Vitest suite in T-005 is written against,
not a throwaway sanity check.

## Acceptance criteria

- [x] Fixture input is written as concrete rows: `AcademicYear`, `Semester`,
      `NonTeachingPeriod`, `NonTeachingWeekdayRule`, `BellSchedule`,
      `ParityAnchor[]`, two `ScheduleTemplate` versions with their
      `[validFrom, validTo)`, their `TemplateSlot`s, and `DayOverride` rows of
      all three `kind`s.
- [x] Expected output is given per date as `ResolvedDay`, including `parity`,
      `isNonTeaching`, and each `ResolvedLesson`'s `origin`.
- [x] Covers a `SUBSTITUTION` on a date that a later template version also
      covers, showing the resulting `replacedOriginal` (overview §3.4 states
      this shifts — the fixture pins the accepted behaviour).
- [x] Covers a full break week and states the resulting parity of the next
      teaching week under the current default (see Q-001).
- [x] Covers a gap between template versions, expected to render as an empty
      calendar rather than an error.
- [x] Covers both `OWN` and `CLASS` views on one slot, showing `isTaughtByMe`.
- [x] Every expected value was derived by hand from the rules in overview §3,
      not by running code.

## Notes

This document is the single source for the hard-week scenario: the T-005 Vitest
expectations and the T-004 seed script are both derived from it.

Delivered as `docs/architecture/design/expand-fixtures.md`. The window is
2026-10-12 … 2026-11-13 (ISO weeks W42–W46); the walkthrough was written for
`Europe/Kyiv` dates only, with `date(1)` used for weekday and ISO-week numbers
and nothing else.

The exercise changed three things outside this ticket (fixture document §9):

- `architect-overview.md` §4 — `isTaughtByMe` cannot be decided from
  `(weekday, lessonNumber, parity)`; it compares `subject` as well, and compares
  against the resolved `OWN` day rather than the template. The residual case is
  the new **Q-006** (`architect-overview.md` §10.6).
- `architect-overview.md` §8.1 — `boundaryDate` is exclusive everywhere; nothing
  had said so, and the `FRI` rule in the fixture cannot be resolved without it.
- **T-003** gained a criterion: `NonTeachingWeekdayRule` has an end but no
  beginning, so a rule entered mid-year retroactively blanks past dates, which
  contradicts specification §5.2.

`architect-overview.md` §11 asked for exactly this walkthrough and now records
that it happened.
