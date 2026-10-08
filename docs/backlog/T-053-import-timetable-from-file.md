---
id: T-053
type: ticket
title: Import a timetable from a spreadsheet or a photo as one new template version, with bell times
status: todo
depends_on: [T-052, T-055, T-057, T-059]
refs:
  - docs/architecture/decisions/ADR-029-the-model-proposes-and-deterministic-code-writes.md
  - docs/architecture/lesson-input-and-import.md §7
  - docs/specs/specification.md §10
  - docs/specs/specification.md §3.3
  - docs/specs/specification.md §5.1
  - docs/architecture/architect-overview.md §3.2
  - docs/architecture/architect-overview.md §10.8
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
      is sent as an image.
- [ ] File size and the number of rows and cells are limited, and exceeding a
      limit is a message, not a truncated import.
- [ ] The confirmation view shows the proposed week in the layout of the
      template editor, with the cells that differ from the version in force
      marked.
- [ ] Confirming creates exactly one template version for the view through the
      T-059 commands. Proposed bell times go through the T-057 bell schedule command
      in the same transaction.
- [ ] The confirmation screen offers the start choices of T-055 («з
      сьогодні», «після канікул», «з дати»), proposed from the file or the
      teacher's text where it names one («з 03.11», «після канікул»), and the
      version is created through T-055's future cut. A planned version already
      ahead is handled as T-055 handles it. The start date comes back with its
      symbol and is checked as T-051 checks a date.
- [ ] The evaluation set gains at least five timetable files, including one
      with merged cells and one with both parity weeks on a single sheet.

## Notes
