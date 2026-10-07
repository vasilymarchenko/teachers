---
id: T-051
type: ticket
title: Quick add — free text becomes template lessons and day overrides, with a preview of the new version
status: todo
depends_on: [T-043, T-050]
refs:
  - docs/architecture/decisions/ADR-028-the-model-proposes-and-deterministic-code-writes.md
  - docs/architecture/lesson-input-and-import.md §7
  - docs/architecture/architect-overview.md §3.2
  - docs/architecture/architect-overview.md §3.4
  - docs/architecture/decisions/ADR-006-template-day-is-the-save-unit.md
  - docs/architecture/decisions/ADR-025-both-parity-weeks-is-decided-per-lesson-row.md
  - docs/specs/specification.md §5.1
  - docs/specs/specification.md §5.3
  - docs/specs/specification.md §5.4
---

## Goal

The quick-add input of T-050 also understands lessons. Two examples are
«по понеділках 2-й урок математики у 7-Б», which is a template lesson, and
«у вівторок 3-м уроком заміна в 5-А», which is a day override. The
confirmation screen shows the template change as the version it would create,
from which date and for which parity weeks, before anything is written.

## Acceptance criteria

- [ ] The proposal schema gains the template day and day override kinds. Their
      payloads are those of the template day form and the day override form,
      for the view the teacher has selected.
- [ ] The model receives the teacher's subjects, classes, lesson numbers and
      bell times (`getLessonSuggestions()`, `getBellSchedule()`). A subject or
      class that matches an existing one modulo case and common abbreviations is
      proposed as the existing value.
- [ ] «По понеділках» without a parity becomes a question («в обох тижнях чи
      лише в чисельнику?»), not a default. The teacher's answer sets the
      per-row both-weeks choice of ADR-025.
- [ ] All template changes of one confirmation are applied as one template
      version, through the T-049 commands in one transaction. A dry run of the
      same commands produces the preview shown on the confirmation screen.
- [ ] The preview names the cut date (`today()`) and, where the version in
      force is trimmed, the warning of overview §3.2 I2.
- [ ] A day override proposal resolves its date with the T-050 date
      expressions and is applied through the day override command.
- [ ] The evaluation set gains at least 15 lesson and override cases.

## Notes
