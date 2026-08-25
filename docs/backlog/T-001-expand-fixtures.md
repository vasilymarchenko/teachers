---
id: T-001
type: ticket
title: Golden fixtures for expand() — the hard-week walkthrough
status: todo
depends_on: []
refs:
  - docs/architecture/architect-overview.md#3
  - docs/architecture/architect-overview.md#11
  - docs/specs/specification.md#4
  - docs/specs/specification.md#5
---

## Goal

Produce `docs/architecture/design/expand-fixtures.md`: a hand-computed academic
year fragment covering the three mechanics that interact worst — a mid-week
`ScheduleTemplate` version change, a `ParityAnchor` reset after a break, and a
`SUBSTITUTION` — together with the exact `ResolvedDay[]` each date must yield.
The document is the specification the Vitest suite in T-005 is written against,
not a throwaway sanity check.

## Acceptance criteria

- [ ] Fixture input is written as concrete rows: `AcademicYear`, `Semester`,
      `NonTeachingPeriod`, `NonTeachingWeekdayRule`, `BellSchedule`,
      `ParityAnchor[]`, two `ScheduleTemplate` versions with their
      `[validFrom, validTo)`, their `TemplateSlot`s, and `DayOverride` rows of
      all three `kind`s.
- [ ] Expected output is given per date as `ResolvedDay`, including `parity`,
      `isNonTeaching`, and each `ResolvedLesson`'s `origin`.
- [ ] Covers a `SUBSTITUTION` on a date that a later template version also
      covers, showing the resulting `replacedOriginal` (overview §3.4 states
      this shifts — the fixture pins the accepted behaviour).
- [ ] Covers a full break week and states the resulting parity of the next
      teaching week under the current default (see Q-001).
- [ ] Covers a gap between template versions, expected to render as an empty
      calendar rather than an error.
- [ ] Covers both `OWN` and `CLASS` views on one slot, showing `isTaughtByMe`.
- [ ] Every expected value was derived by hand from the rules in overview §3,
      not by running code.

## Notes
