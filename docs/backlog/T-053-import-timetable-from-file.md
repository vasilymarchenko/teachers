---
id: T-053
type: ticket
title: Import a timetable from a spreadsheet or a photo as one new template version, with bell times
status: todo
depends_on: [T-052, T-055, T-057, T-059, Q-007]
refs:
  - docs/architecture/decisions/ADR-029-the-model-proposes-and-deterministic-code-writes.md
  - docs/specs/specification.md §10
  - docs/specs/specification.md §3.3
  - docs/specs/specification.md §5.1
  - docs/architecture/architect-overview.md §3.2
  - docs/architecture/architect-overview.md §10.8
  - docs/architecture/architect-overview.md §9
---

## Goal

The teacher drops an `.xlsx`, `.csv` or a photo of a printed timetable onto
the quick-add input. The application proposes the whole week (both parity
weeks where the file distinguishes them) and, if the file has them, the bell
times. The teacher reviews it as a grid laid out like the template editor and
confirms it as one new template version.

## Acceptance criteria

- [ ] A spreadsheet is read on the server into a text grid with cell addresses,
      merged cells unrolled. The model receives the grid, not the file. A photo
      is sent as an image. The reader is the one T-061 also uses, whichever of
      the two tickets builds it first.
- [ ] File size and the number of rows and cells are limited, and exceeding a
      limit is a message, not a truncated import.
- [ ] The confirmation view shows the proposed week in the layout of the
      template editor, with the cells that differ from the version in force
      marked.
- [ ] Confirming creates exactly one template version for the view through the
      T-059 commands, run by T-051's command for a confirmed proposal. The
      confirmation view is that command's preview.
- [ ] Bell times from the file are written only when the version starts
      today. They then go through the T-057 bell schedule command in the same
      transaction. When the version starts later, they are not written,
      because `BellSchedule` has no start date (overview §9). The confirmation
      screen then lists the lesson numbers whose times differ from the
      teacher's, old and new side by side, and says to change them on the
      bell schedule screen once the new timetable is in force. A test asserts
      that a confirmation with a future start leaves `BellSchedule` unchanged.
      T-062 replaces this criterion once the bell schedule has a start date.
- [ ] The confirmation screen offers the start choices of T-055 («з
      сьогодні», «після канікул», «з дати»), proposed from the file or the
      teacher's text where it names one («з 03.11», «після канікул»), and the
      version is created through T-055's future cut. A planned version already
      ahead is handled by T-055's rule for a change against a planned version
      (overview §10.8). The scope is the whole week, and D is the start the
      teacher chose: before the planned start the import stops there unless
      carried, on it the import replaces it, and after it the import trims it.
      The start date comes back with its symbol and is checked as T-051
      checks a date.
- [ ] The preview's fingerprint is checked at confirmation as T-051 checks
      it. A test changes the template in another request between preview and
      confirmation. Another, for a version that starts today, changes the bell
      times in between. Each asserts that nothing is written and that the new
      preview is shown.
- [ ] The evaluation set gains at least five timetable files, including one
      with merged cells and one with both parity weeks on a single sheet.

## Notes
