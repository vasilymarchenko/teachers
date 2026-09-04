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
route of its own rather than a form inside the calendar cell —
`docs/architecture/decisions/ADR-008-calendar-edits-have-their-own-route.md`,
summarised in `architect-overview.md` §5.

Two things the work settled that the criteria did not name:

- an all-blank save is refused rather than written as an empty payload.
  «Прибрати правку» deletes the override and «Скасувати урок» writes the
  tombstone, so an empty payload would be a third state the model has no room
  for (schema §4.9);
- the fields of a lesson — which ones each view has, how long they may be and
  what they may not be left as — moved to `lib/validation/slotFields.ts`, shared
  with the weekly template editor. An `EDIT` or a `SUBSTITUTION` renders as a
  lesson, so it carries a lesson's fields (overview §3.4), and one wording of
  «Вкажіть предмет» is one product.
