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
- [ ] The import's scope is the file's grid (ADR-029). Each weekday of the
      grid is a template day change with an entry for every lesson number of
      the grid, so an empty cell clears that lesson. Where the version in
      force has lessons outside the grid (a weekday or a lesson number the
      file has no place for), one «choose one of» question for the whole
      proposal lists them, with «прибрати» and «залишити». Without lessons
      there, no question is asked. The preview marks every lesson the import
      removes. Tests cover three cases: a file without Saturday while the
      version in force has Saturday lessons (the question, answered each
      way); a file whose grid starts at lesson 1 while the version in force
      has a lesson 0 (the question); and an empty cell inside the grid (that
      lesson is removed, with no question).
- [ ] A file that does not tell the parity weeks apart raises one «choose
      one of» question for the whole proposal: «в обох тижнях», «лише в
      чисельнику» or «лише в знаменнику», as T-052 asks it for one day. A
      file with both weeks, on one sheet or two, raises none.
- [ ] The file's bell times become the raw input of the T-057 bell schedule
      command: a start for each of the ten lesson numbers and one
      `lessonMinutes` for all of them (`bellScheduleInput`), built as follows.
      - A lesson number the file has a time for takes its start from the file.
        A lesson number the file has no time for keeps the teacher's current
        start, so the import never deletes a bell row.
      - Where the file gives start–end pairs of one length, that length is
        `lessonMinutes`. Where it gives starts only, the teacher's current
        length stays.
      - Where the file's lessons differ in length, which the schedule cannot
        store (overview §9, «Кінець уроку зберігається, тривалість — лише
        поле форми»), a «choose one of» question on the bell change offers
        each length the file has. The preview marks the lessons whose end
        moves. A length that makes lessons overlap is refused by the
        command, and the refusal shows on the bell change (ADR-029).
      - Tests cover: start–end pairs of one length; starts only; two lengths,
        answered each way, one of which overlaps and is refused; and a file
        without a lesson 0 the teacher has, whose bell row is kept.
- [ ] Bell times from the file are written only when the version starts
      today. They then go through the T-057 bell schedule command in the same
      transaction. When the version starts later, they are not written,
      because `BellSchedule` has no start date (overview §9). The confirmation
      screen then lists the lesson numbers whose times differ from the
      teacher's, old and new side by side, and says to change them on the
      bell schedule screen once the new timetable is in force. The bell part
      is then shown only: it is not a change of the proposal, it is not in
      the preview, and it raises no question and no refusal, so lessons of
      different lengths in the file never block «Додати». A test asserts
      that a confirmation with a future start, from a file with two lesson
      lengths, is enabled without a bell answer and leaves `BellSchedule`
      unchanged.
      T-062 replaces this criterion once the bell schedule has a start date.
- [ ] The start is one «choose one of» question for the whole proposal
      (ADR-029) over T-055's start choices («з сьогодні», «після канікул»,
      «з дати»), and its answer sets `target.from` on every template day
      change of the file. Where the file or the teacher's text names a start
      («з 03.11», «після канікул»), that choice is proposed. Where neither
      does, «з сьогодні» is shown already chosen, the one default ADR-029
      allows here. «З сьогодні» sends no `from` and is `today()` at write
      time. The other choices resolve against the proposal's anchor date and
      are sent as `{ date, whenPassed: "refuse" }`. The version is created
      through T-055's future cut.
- [ ] A planned version already ahead is handled by T-055's rule for a
      change against a planned version (overview §10.8). The scope is the
      import's scope above, and D is the start the teacher chose. Before the
      planned start, an import whose own boundary ends after it raises
      ADR-029's carry question once for the whole proposal, and its answer
      sets `target.carryInto` on every template day change of the file. One
      whose boundary ends on or before the planned start does not touch it
      and asks nothing. On the planned start the import replaces it, and
      after it the import trims it.
- [ ] The preview's fingerprint is checked at confirmation as T-051 checks
      it. A test changes the template in another request between preview and
      confirmation. Another, for a version that starts today, changes the bell
      times in between. Each asserts that nothing is written and that the new
      preview is shown.
- [ ] The evaluation set gains at least five timetable files, including one
      with merged cells and one with both parity weeks on a single sheet.

## Notes
