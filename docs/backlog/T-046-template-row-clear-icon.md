---
id: T-046
type: ticket
title: Template editor — a lesson row is cleared by an icon, and the clear can be undone before saving
status: todo
depends_on: [T-010]
refs:
  - docs/specs/specification.md §5.1
  - docs/architecture/architect-overview.md §10.2
  - docs/architecture/design/T-010-weekly-template-editor.md §1
  - docs/architecture/decisions/ADR-006-template-day-is-the-save-unit.md
---

## Goal

On `/schedule` the teacher removes a lesson from a template day with one
click on an icon in that lesson's row header, instead of erasing every input
of the row by hand. The icon only empties the row's inputs in the browser;
the lesson is removed by the day's «Зберегти», exactly as an emptied row is
removed today (`design/T-010-weekly-template-editor.md` §1). Until the save,
the same place offers an icon that brings the row's stored values back. The
action, the validation and the save unit do not change.

## Acceptance criteria

- [ ] Each lesson row of `DayForm` carries an icon button in its header line,
      at the end of the «3 · 10:15» label, in both views (`OWN` and `CLASS`)
      and on a phone as on a desktop. No text button is added to the form.
- [ ] The icon is shown only on a row with at least one non-empty input. A
      row that is empty shows nothing there.
- [ ] Activating it empties every input of that row and of no other row. It
      submits nothing and is `type="button"`.
- [ ] A row emptied this way shows, in the same place, an undo icon that
      restores each of the row's inputs to the value it had when the form was
      rendered (`defaultValue`). Typing into the row again replaces the undo
      icon with the clear icon.
- [ ] Saving the day with an emptied row removes that lesson through the
      existing `saveTemplateDayAction()`; the action, `readTemplateDay()` and
      the slot validation are unchanged.
- [ ] Both icons have an accessible name that names the lesson
      («Прибрати урок 3», «Повернути урок 3») and the same text as a hover
      hint; the hit area is at least 24×24 CSS px. Icons come from
      `lucide-react`.
- [ ] With JavaScript off the form renders and saves as it does today; the
      icons may be absent.
- [ ] Every word the feature shows lives in `components/schedule/labels.ts`.
- [ ] `design/T-010-weekly-template-editor.md` §1 names the row header as the
      place of a row's actions and describes the clear and the undo.
- [ ] Tests: which rows show the clear icon, and that clear followed by undo
      returns the row's inputs to their rendered values.

Out of scope: removing a lesson without saving the day, a confirmation
dialog, and the override form under the calendar (T-011).

## Notes
