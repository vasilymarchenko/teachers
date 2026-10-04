---
id: T-046
type: ticket
title: Template editor — a lesson row is cleared by an icon, and the clear can be undone before saving
status: todo
depends_on: [T-010, T-047]
refs:
  - docs/specs/specification.md §5.1
  - docs/architecture/architect-overview.md §8.2
  - docs/architecture/architect-overview.md §10.2
  - docs/architecture/design/T-010-weekly-template-editor.md §5
  - docs/architecture/decisions/ADR-006-template-day-is-the-save-unit.md
---

## Goal

On `/schedule` the teacher removes a lesson from a template day with one
click on an icon in that lesson's row header, instead of erasing every field
of the row by hand. The icon only empties the lesson's fields in the browser;
the lesson is removed by the day's «Зберегти», exactly as an emptied row is
removed today (`design/T-010-weekly-template-editor.md` §1). Until the save,
the same place offers an icon that puts back what the clear took away. The
action, the validation and the save unit do not change.

## Acceptance criteria

- [ ] Each lesson row of `DayForm` carries an icon button in its header line,
      at the end of the «3 · 10:15» label, in both views (`OWN` and `CLASS`)
      and on a phone as on a desktop. No text button is added to the form.
- [ ] The icon is shown only on a row with at least one non-empty lesson
      field. A row whose lesson fields are all empty shows nothing there.
- [ ] The lesson fields of a row are the inputs of `TEMPLATE_SLOT_FIELDS[view]`
      for that lesson number. Activating the icon empties those of that row
      and nothing else — no other row, and no other input of the same row. It
      submits nothing and is `type="button"`.
- [ ] Every field the clear or the undo changes gets a bubbling `input` event,
      the contract of T-047 for a value set from code, so the save button and
      any per-row message see the change.
- [ ] At the moment of the clear the row's lesson field values are kept in
      the browser. A row emptied this way shows, in the same place, an undo
      icon that restores exactly those values — what the row held just before
      the clear, including edits not yet saved. Typing into the row again
      replaces the undo icon with the clear icon.
- [ ] Saving the day with an emptied row removes that lesson through the
      existing `saveTemplateDayAction()`; the action, `readTemplateDay()` and
      the slot validation are unchanged.
- [ ] Both icons have an accessible name that names the lesson
      («Очистити урок 3», «Відновити урок 3») and the same text as a hover
      hint; the hit area is at least 24×24 CSS px. Icons come from
      `lucide-react`.
- [ ] With JavaScript off the form renders and saves as it does today; the
      icons may be absent.
- [ ] Every word the feature shows lives in `components/schedule/labels.ts`.
- [ ] `design/T-010-weekly-template-editor.md` §5 names the row header as the
      place of a row's actions and describes the clear and the undo.
- [ ] Tests: which rows show the clear icon; that the clear touches only the
      row's lesson fields; and that an edit, then a clear, then an undo returns
      the row to the edited values, not to the rendered ones.

Out of scope: removing a lesson without saving the day, a confirmation
dialog, and the override form under the calendar (T-011).

## Notes
