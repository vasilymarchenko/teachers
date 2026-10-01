---
id: T-044
type: ticket
title: Lesson fields suggest the subjects, classes and teachers already entered
status: todo
depends_on: [T-010, T-011]
refs:
  - docs/specs/specification.md §5.1
  - docs/specs/specification.md §5.3
  - docs/architecture/architect-overview.md §4
  - docs/architecture/architect-overview.md §9
  - docs/architecture/design/T-010-weekly-template-editor.md §1
  - docs/architecture/design/T-011-day-overrides.md §1
---

## Goal

The free-text lesson fields suggest what the teacher has already typed, as
overview §4 prescribes: `subject`, `className` and `teacherName` offer the
distinct values already stored in the teacher's template slots and day
overrides, so typing «8-» offers 8-А, 8-Б, 8-В. There are no dictionary tables
and no screen to manage them; the values stay free text.

## Acceptance criteria

- [ ] One read query in `lib/db/queries`, `userId` first, returns three
      sorted lists of distinct non-empty values: subjects (from both views),
      class names (from `OWN`) and teacher names (from `CLASS`). It reads the
      payloads of `template_slot` and `day_override` of every version and
      every date, and nothing from another user.
- [ ] Values are trimmed and deduplicated exactly; two spellings that differ
      only in case are both offered. They are sorted with the Ukrainian
      collation, not by code point.
- [ ] The inputs for `subject`, `className` and `teacherName` in the template
      day form and in the override form are bound to the matching list
      through a native `<datalist>`, so the suggestions work with JavaScript
      off. `zoomLink` and `note` get no suggestions.
- [ ] Suggestions never constrain input: a value that is in no list is saved
      as typed, and the validation of the slot payload is unchanged.
- [ ] A screen loads the lists once, not per day form or per row.
- [ ] An integration test covers the query: values from both tables, the
      view each list reads, trimming and deduplication, and that another
      user's values never appear. It is held to the same invariants as every
      other query in `lib/db/queries`.
- [ ] `design/T-010-weekly-template-editor.md` §1 and
      `design/T-011-day-overrides.md` §1 name the query and the forms that use
      it.

Out of scope: tables for subjects or classes, a screen to edit or merge the
suggestions, and suggestions entered ahead of time. The trigger for real
dictionaries stays the row of overview §9.

## Notes
