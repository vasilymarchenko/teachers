---
id: T-052
type: ticket
title: Quick add — free text becomes template lessons and day overrides, with a preview of the new version
status: todo
depends_on: [T-043, T-051, T-055, T-058, T-059]
refs:
  - docs/architecture/decisions/ADR-029-the-model-proposes-and-deterministic-code-writes.md
  - docs/architecture/architect-overview.md §3.2
  - docs/architecture/architect-overview.md §3.4
  - docs/architecture/architect-overview.md §10.8
  - docs/architecture/decisions/ADR-006-template-day-is-the-save-unit.md
  - docs/architecture/decisions/ADR-025-both-parity-weeks-is-decided-per-lesson-row.md
  - docs/specs/specification.md §5.1
  - docs/specs/specification.md §5.3
  - docs/specs/specification.md §5.4
---

## Goal

The quick-add input of T-051 also understands lessons. Two examples are
«по понеділках 2-й урок математики у 7-Б», which is a template lesson, and
«у вівторок 3-м уроком заміна в 5-А», which is a day override. The
confirmation screen shows the template change as the version it would create,
from which date and for which parity weeks, before anything is written.

## Acceptance criteria

- [ ] The proposal schema gains the template day and day override kinds. Their
      payloads are the raw inputs of the template day and day override commands
      of T-059 and T-058, for the view the teacher has selected, with the override's date
      widened to accept a date expression.
- [ ] The model receives the teacher's subjects, classes, lesson numbers and
      bell times (`getLessonSuggestions()`, `getBellSchedule()`). A subject or
      class that matches an existing one modulo case and common abbreviations is
      proposed as the existing value.
- [ ] «По понеділках» without a parity becomes a question («в обох тижнях чи
      лише в чисельнику?»), not a default. The teacher's answer sets the
      per-row both-weeks choice of ADR-025.
- [ ] All template changes of one confirmation are applied as one template
      version, through the T-059 commands in one transaction. The preview on
      the confirmation screen is the same commands run through the preview
      helper of T-056, so it shows what the write will leave.
- [ ] The preview names the cut date (`today()`) and, where the version in
      force is trimmed, the warning of overview §3.2 I2.
- [ ] When a planned version lies ahead, the confirmation screen applies
      T-055's rule for a change that starts before it (overview §10.8). Each
      template day it changes is a day-save scope. The screen says that the
      change stops at the planned start, offers to carry it, and lists the
      planned rows a carry would replace. A test asserts that a lesson
      confirmed with the carry is in the calendar on the planned version's
      start date, and one confirmed without it is not.
- [ ] A day override proposal resolves its date with the T-051 date
      expressions and is applied through the day override command.
- [ ] The evaluation set gains at least 15 lesson and override cases.

## Notes
