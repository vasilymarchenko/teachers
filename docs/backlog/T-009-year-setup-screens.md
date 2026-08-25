---
id: T-009
type: ticket
title: Year setup — year, semesters, non-teaching periods, bells, parity
status: todo
depends_on: [T-006, T-014]
refs:
  - docs/architecture/architect-overview.md §4
  - docs/architecture/architect-overview.md §8.1
  - docs/specs/specification.md §3
  - docs/specs/specification.md §4
---

## Goal

Give the teacher the screens that create the year frame every other feature
reads, so the calendar stops depending on the seed script for its data.

## Acceptance criteria

- [ ] CRUD for `AcademicYear`, `Semester`, `NonTeachingPeriod` (all three
      `kind`s), `NonTeachingWeekdayRule` and `BellSchedule` (lesson numbers
      0–9).
- [ ] Initial `ParityAnchor` set from the year settings, plus "reset parity
      from this date" adding a further anchor (specification §4); no separate
      reset entity.
- [ ] `NonTeachingWeekdayRule` boundary entered as `DATE`, `NEXT_BREAK` or
      `END_OF_SEMESTER` and stored as the resolved `boundaryDate` +
      `boundaryKind` pair (overview §8.1); the UI displays the symbolic form.
- [ ] Editing the dates of a `NonTeachingPeriod` shows the warning that
      already-resolved boundaries do not move (overview §8.1, accepted cost).
- [ ] One Zod schema per form, shared by the client form and the Server Action
      (overview §8.2).
- [ ] Server Actions follow `requireUser` → Zod → domain/db → revalidate.
- [ ] All UI text in Ukrainian.

## Notes
