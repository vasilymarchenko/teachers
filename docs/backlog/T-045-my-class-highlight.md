---
id: T-045
type: ticket
title: My class — the teacher names it per year, and my lessons in it are highlighted
status: todo
depends_on: [T-007, T-009, T-044]
refs:
  - docs/specs/specification.md §3.5
  - docs/specs/specification.md §6.2
  - docs/architecture/glossary.md §1
  - docs/architecture/glossary.md §3
  - docs/architecture/architect-overview.md §4
  - docs/architecture/architect-overview.md §5
  - docs/architecture/architect-overview.md §8.6
  - docs/architecture/design/schema.md §4.1
  - docs/architecture/design/T-009-year-setup.md §3
  - docs/architecture/design/T-009-year-setup.md §4
  - docs/architecture/design/T-007-calendar-views.md §4
---

## Goal

The teacher enters the name of their own class — `homeroomClassName`, such
as 9-Б — on the academic year, on `/year`. In the «Мої уроки» schedule, every
lesson whose `className` matches the class of the year its date belongs to is
highlighted in the day, week and month views (`isInMyClass`). The field is
optional and is not part of the year-setup gate. The «Уроки класу» schedule
and its `isTaughtByMe` are unchanged.

## Acceptance criteria

- [ ] `academic_year` gains a nullable `homeroom_class_name` text column
      through a `drizzle-kit generate` migration; `design/schema.md` §4.1 lists it.
      Existing rows read as «no class named».
- [ ] The year form on `/year` has a field «Мій клас», optional, that offers
      the class names of T-044 as suggestions. It is saved by the actions
      that create and update an academic year; an empty value stores `null`.
      The value is trimmed and at most 20 characters, with a Ukrainian
      message on the field.
- [ ] `SetupStatus` and `requireCompleteSetup()` do not look at the field: a
      year without a class is a complete year (overview §8.6).
- [ ] Whether a class name matches the homeroom class is decided by one pure
      function in `lib/domain`. It ignores letter case, whitespace and
      hyphens, so «9-Б», «9Б», «9 б» match and «9-В» does not. Unit tests
      cover it, including a `null` homeroom class, which matches nothing.
- [ ] The calendar marks an `OWN` lesson `isInMyClass` when its `className`
      matches `homeroomClassName` of the academic year containing that
      lesson's date. A range spanning two years uses each date's own year,
      and a date in no year marks nothing. The flag is computed, never
      stored, and is not set on a `CLASS` lesson.
- [ ] The flag follows the resolved lesson: a planned lesson, an `EDIT` and a
      `SUBSTITUTION` are marked when their own `className` matches; a
      cancelled lesson is not marked.
- [ ] In the «Мої уроки» day, week and month views a marked lesson is visibly
      highlighted, and the highlight is not colour alone; on the month grid,
      which shows no class name, the highlight is the only sign. The year
      view and the print views are unchanged.
- [ ] Every new word lives in the `labels.ts` of the screen that shows it.
- [ ] `npm run db:seed` names a homeroom class for the demo teacher that
      appears among the seeded `OWN` lessons, so the demo shows the highlight.
- [ ] `design/T-009-year-setup.md` §3 and §4 list the new field and what the
      year actions do with it, and `design/T-007-calendar-views.md` §4
      describes the flag and where the calendar computes it.
- [ ] Tests: the matching function; the flag over a range that crosses two
      years and over each kind of resolved lesson; and the year actions
      saving and clearing the field.
- [ ] Not in this ticket: using the homeroom class to decide `isTaughtByMe`
      (Q-006 stays open), a class list (specification §9), or a highlight in
      the «Уроки класу» schedule beyond the existing one.

## Notes
