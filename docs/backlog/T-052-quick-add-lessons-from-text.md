---
id: T-052
type: ticket
title: Quick add — free text becomes template lessons and day overrides, with a preview of the new version
status: todo
depends_on: [T-043, T-051, T-055, T-058, T-059, Q-007]
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
      payloads are the inputs `{ target, data }` of the template day and day
      override commands of T-059 and T-058, with the override's `target.date`
      widened to accept a date expression. The model proposes the target too:
      the view, the weekday and the parity weeks of a template day, and the
      date, view and lesson number of an override. Nothing in a target is
      taken from the page the input sits on. A target field the text does not
      settle is a «choose one of» or «a date is needed» question of T-051
      (ADR-029). A test sends «2-й урок математики у 7-Б» with no day and
      asserts a question on the weekday, not a default.
- [ ] A proposed template day names only the lessons the text talks about, and
      the save covers only those (ADR-028). A test starts from a Monday with
      lessons 1 and 3, confirms «по понеділках 2-й урок математики», and
      asserts that Monday then has lessons 1, 2 and 3. A removal («у понеділок
      прибери 3-й урок») is an entry with an empty lesson and is shown on the
      confirmation screen as a removal.
- [ ] The model receives the teacher's subjects, classes, lesson numbers and
      bell times (`getLessonSuggestions()`, `getBellSchedule()`). A subject or
      class that matches an existing one modulo case and common abbreviations is
      proposed as the existing value.
- [ ] «По понеділках» without a parity becomes a «choose one of» question of
      T-051 on the template day change, with the options «в обох тижнях»,
      «лише в чисельнику» and «лише в знаменнику», not a default. Each option
      sets the change's `target.parity` together with the per-row both-weeks
      choice of ADR-025.
- [ ] The preview marks each existing lesson a change replaces, with the old
      lesson and the new side by side, as a conflict of ADR-029 the teacher
      may answer with a clarification.
- [ ] All template changes of one confirmation are applied as one template
      version, through the T-059 commands, run by T-051's command for a
      confirmed proposal. The preview on the confirmation screen is that same
      command in the rollback ending of the T-056 helper, so it shows what the
      write will leave.
- [ ] The preview names the date the change starts on and, where the version
      in force is trimmed, the warning of overview §3.2 I2. By default the
      date is `today()`. Where the text names a start («з 13.10 по понеділках
      …», «після канікул»), the confirmation screen offers T-055's start
      choices («з сьогодні», «після канікул», «з дати»), as T-053 does. The
      change is made through T-055's future cut, and its start date comes
      back with its symbol and is checked as T-051 checks a date.
- [ ] When a planned version lies ahead, the confirmation screen applies
      T-055's rule for a change that starts before it (overview §10.8). Each
      template day it changes is a day-save scope. The screen says that the
      change stops at the planned start, offers to carry it, and lists the
      planned rows a carry would replace. A test asserts that a lesson
      confirmed with the carry is in the calendar on the planned version's
      start date, and one confirmed without it is not.
- [ ] The preview's fingerprint is checked at confirmation as T-051 checks
      it. Tests save a template day in another request between preview and
      confirmation, and let midnight pass between them. Each asserts that
      nothing is written and that the new preview is shown.
- [ ] A day override proposal resolves its date with the T-051 date
      expressions and is applied through the day override command.
- [ ] The evaluation set gains at least 15 lesson and override cases.

## Notes
