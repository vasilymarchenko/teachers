---
id: T-011
type: ticket
title: Day overrides — edit, substitution, cancel a single lesson
status: done
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

- [x] From a lesson in the day or week view: edit it (`EDIT`), record a
      substitution (`SUBSTITUTION`), or cancel it (`CLEARED`).
- [x] `CLEARED` writes a tombstone row, not a delete; the calendar keeps
      showing a cancelled lesson distinct from an empty slot (overview §3.4).
- [x] Removing an override restores the template lesson.
- [x] An override can be created on a date with no template slot at all.
- [x] Overrides survive a later template version covering the same date, and
      the UI does not promise otherwise — the `replacedOriginal` shown under a
      `SUBSTITUTION` is always computed from the version in force
      (overview §3.4, accepted behaviour).
- [x] Payload validated per `view` at the Zod boundary (overview §3.3).
- [x] All UI text in Ukrainian.

## Notes

Mechanics: `docs/architecture/design/T-011-day-overrides.md`. The editor is a
route of its own — `decisions/ADR-008-calendar-edits-have-their-own-route.md`,
outcome in `architect-overview.md` §5.

Two things settled while doing the work, neither named by a criterion:

- an all-blank save is refused rather than written — design doc §5;
- the fields of a lesson are shared with the weekly template editor
  (`lib/validation/slotFields.ts`, `components/forms/slot-labels.ts`) — design
  doc §1.
