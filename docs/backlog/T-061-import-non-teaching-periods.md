---
id: T-061
type: ticket
title: Import non-teaching periods — a list of holidays and breaks from text or a file becomes year rows through a proposal
status: todo
depends_on: [T-051, T-057]
refs:
  - docs/architecture/decisions/ADR-029-the-model-proposes-and-deterministic-code-writes.md
  - docs/specs/specification.md §3.1
  - docs/specs/specification.md §10
  - docs/architecture/architect-overview.md §4
---

## Goal

The teacher pastes or drops a list of holidays and breaks («осінні канікули
26.10–01.11», a file of public holidays) onto the quick-add input. The
application proposes the non-teaching periods it read, the teacher confirms
them, and they are written as `NonTeachingPeriod` rows of the academic year.
This is the non-teaching period kind of ADR-029's closed set.

## Acceptance criteria

- [ ] The proposal schema gains the non-teaching period kind. Its payload is the
      raw input of the non-teaching period command of T-057, with each date
      widened to accept a date expression.
- [ ] A spreadsheet is read on the server into a text grid with cell addresses,
      within limits on file size and cells, by the one reader T-053 also uses,
      whichever of the two tickets builds it first.
- [ ] The confirmation screen lists each period with its dates in words and
      marks one that overlaps a period already entered. Confirming writes the
      ticked ones through the T-057 command, run by T-051's command for a
      confirmed proposal in one transaction. A refusal on any item writes
      nothing and names that item.
- [ ] A period outside the academic year in force raises T-051's «a date
      is needed» on its dates, and is not written until it is answered.
- [ ] The evaluation set gains at least five lists, one of them a file.

## Notes
