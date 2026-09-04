---
id: T-009
type: ticket
title: Year setup — year, semesters, non-teaching periods, bells, parity
status: done
depends_on: [T-006, T-014]
refs:
  - docs/architecture/architect-overview.md §4
  - docs/architecture/architect-overview.md §8.1
  - docs/specs/specification.md §3
  - docs/specs/specification.md §4
  - docs/architecture/design/T-009-year-setup.md
---

## Goal

Give the teacher the screens that create the year frame every other feature
reads, so the calendar stops depending on the seed script for its data.

## Acceptance criteria

- [x] CRUD for `AcademicYear`, `Semester`, `NonTeachingPeriod` (all three
      `kind`s), `NonTeachingWeekdayRule` and `BellSchedule` (lesson numbers
      0–9).
- [x] Initial `ParityAnchor` set from the year settings, plus "reset parity
      from this date" adding a further anchor (specification §4); no separate
      reset entity.
- [x] `NonTeachingWeekdayRule` boundary entered as `DATE`, `NEXT_BREAK` or
      `END_OF_SEMESTER` and stored as the resolved `boundaryDate` +
      `boundaryKind` pair (overview §8.1); the UI displays the symbolic form.
- [x] Editing the dates of a `NonTeachingPeriod` shows the warning that
      already-resolved boundaries do not move (overview §8.1, accepted cost).
- [x] One Zod schema per form, shared by the client form and the Server Action
      (overview §8.2).
- [x] Server Actions follow `requireUser` → Zod → domain/db → revalidate.
- [x] All UI text in Ukrainian.

## Notes

Mechanics — modules, field names, what each action does in order, and the
constraint-to-message table — are in
`docs/architecture/design/T-009-year-setup.md`, which is authoritative for this
ticket.

Two decisions were taken here and recorded:

- `ADR-004` — a `NonTeachingWeekdayRule` written by these screens starts at the
  later of the year's first day and today, not unconditionally at
  `academic_year.date_from` as `design/schema.md` §4.4 read. That paragraph and
  `architect-overview.md` §8.1 have been corrected to point at the ADR.
- `ADR-005` — forms submit through `useActionState` rather than react-hook-form,
  which `architect-overview.md` §8.2 had named in passing. §8.2 now states what
  is true and links the ADR.

Left out on purpose, with the reasons in `design/T-009-year-setup.md` §8: no
re-resolution of boundaries when a break moves (overview §8.1 records that cost),
no dedupe of overlapping weekday rules, no edit form for a parity reset, no
generated semesters or holiday import.
