---
id: T-011
type: ticket
title: Day overrides — edit, substitution, cancel a single lesson
status: todo
depends_on: [T-007]
refs:
  - docs/architecture/architect-overview.md §3.4
  - docs/specs/specification.md §5.3
  - docs/specs/specification.md §5.4
---

## Goal

Edit a single day from the calendar through one `DayOverride` row, covering all
three `kind`s, without touching the template.

## Acceptance criteria

- [ ] From a lesson in the day or week view: edit it (`EDIT`), record a
      substitution (`SUBSTITUTION`), or cancel it (`CLEARED`).
- [ ] `CLEARED` writes a tombstone row, not a delete; the calendar keeps
      showing a cancelled lesson distinct from an empty slot (overview §3.4).
- [ ] Removing an override restores the template lesson.
- [ ] An override can be created on a date with no template slot at all.
- [ ] Overrides survive a later template version covering the same date, and
      the UI does not promise otherwise — the `replacedOriginal` shown under a
      `SUBSTITUTION` is always computed from the version in force
      (overview §3.4, accepted behaviour).
- [ ] Payload validated per `view` at the Zod boundary (overview §3.3).
- [ ] All UI text in Ukrainian.

## Notes
