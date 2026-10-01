---
id: T-040
type: ticket
title: Bell schedule — the teacher enters start times and one lesson length, ends are computed
status: todo
depends_on: [T-009]
refs:
  - docs/specs/specification.md §3.3
  - docs/architecture/architect-overview.md §4
  - docs/architecture/architect-overview.md §8.5
  - docs/architecture/architect-overview.md §9
  - docs/architecture/design/schema.md §4.5
  - docs/architecture/design/T-009-year-setup.md §3
  - docs/architecture/design/T-009-year-setup.md §4
  - docs/architecture/glossary.md §1
---

## Goal

Cut the bell schedule form on `/year` from twenty time inputs to ten plus one:
the teacher enters the start of each lesson in use and one lesson length,
`lessonMinutes`, which defaults to 45. The end of each lesson is computed from
the two and stored in `BellSchedule.timeTo` exactly as it is stored today, so
nothing that reads `BellSchedule` changes. A lesson length that changes in the
middle of the year is not built here; it must stay possible to add later
without a migration of the rows this ticket writes (overview §9).

## Acceptance criteria

- [ ] The bells section shows one time input per lesson number 0–9 — the
      start — and one whole-minutes input for `lessonMinutes` above the grid.
      There is no input for the end of a lesson.
- [ ] Every time on the section is 24-hour `HH:MM` — `08:30`, `13:30`,
      `15:10` — whatever the browser's or the operating system's locale: the
      start inputs, their placeholders and the computed ends. No AM/PM is
      ever shown. The native `<input type="time">` cannot promise this — it
      follows the browser locale, not `lang="uk"` — so the start is a text
      input with a numeric keyboard and the `HH:MM` check `clockTimeField`
      already makes. A start typed as `8:30` is accepted and shown as `08:30`.
- [ ] Next to each filled start the section shows the computed end, and the
      ends follow the start and `lessonMinutes` as the teacher types, before
      the form is saved.
- [ ] The end is computed by one pure function in `lib/domain` from a start
      and `lessonMinutes`. The form preview and the Server Action both call
      it; the action never accepts an end from the request. Unit tests cover
      it, including an end that would pass midnight.
- [ ] The default of 45 is one named constant, and outside tests the only
      place the number appears in code.
- [ ] Saving writes, for each filled row, `timeFrom` = the start and `timeTo` =
      the computed end. A cleared start deletes the row, as it does today. No
      migration: `bell_schedule` keeps both columns and its constraints, and
      `expand()`, the queries and the calendar are unchanged.
- [ ] `lessonMinutes` is not stored anywhere. On reopening the screen the
      field shows the length of the stored rows, or 45 when there are none.
      When the stored rows do not share one length, the field shows the length
      of the lowest-numbered row and the section says, in Ukrainian, that
      saving gives every lesson that one length.
- [ ] Validation, with a Ukrainian message on the field it concerns:
      `lessonMinutes` is a whole number from 10 to 90; a start is `HH:MM`;
      a lesson that would end after 23:59 is refused; starts grow with the
      lesson number; and a lesson may not end after the next filled lesson
      starts.
- [ ] Every word the section shows lives in `components/year/labels.ts`: the
      `timeTo` label is gone, and there are labels for `lessonMinutes`, for
      the computed end, and for the note about stored rows of mixed length.
- [ ] `design/T-009-year-setup.md` §3 lists the bells form's new fields, and
      §4 says `saveBellScheduleAction` computes each end instead of reading
      one from the request.
- [ ] `lib/validation/bellSchedule.test.ts` covers the new input shape and
      every refusal above. `npm run db:seed` and the fixtures need no change
      (their lessons are 45 minutes already) — or, if they do, the change is
      to the rows, not to the scenario.
- [ ] Not in this ticket: one lesson with a length different from the others,
      and bell times or a lesson length that change from a date. Both are rows
      of overview §9 with their triggers; nothing here may store the length in
      a way that a dated version of `BellSchedule` would have to migrate.

## Notes

The choice to store the end and keep the length a form field, and the two
deferred cases, are rows of overview §9.
