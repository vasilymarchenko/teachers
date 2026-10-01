---
id: T-043
type: ticket
title: Template editor — fill a day for both parity weeks at once, and show where the weeks differ
status: todo
depends_on: [T-010]
refs:
  - docs/specs/specification.md §5.1
  - docs/architecture/glossary.md §3
  - docs/architecture/architect-overview.md §3.2
  - docs/architecture/architect-overview.md §10.2
  - docs/architecture/design/T-010-weekly-template-editor.md §1
  - docs/architecture/design/T-010-weekly-template-editor.md §2
  - docs/architecture/decisions/ADR-006-template-day-is-the-save-unit.md
---

## Goal

On `/schedule` the teacher fills a day once when it is the same in the
numerator and the denominator week: the day form carries a checkbox
«Однаково для обох тижнів», and a save with it on writes the day into both
parity weeks in one version. Every lesson that differs from the other week is
marked and shows what the other week has in that slot, so a difference of one
or two lessons is visible without switching weeks. «Скопіювати з чисельника»
stays as it is. The data model does not change: a `TemplateSlot` still
belongs to exactly one `parity`, and a day saved for both weeks is two sets of
rows.

## Acceptance criteria

- [ ] `DayForm` shows a checkbox «Однаково для обох тижнів» below the lesson
      rows, in both views (`OWN` and `CLASS`) and on a phone as on a desktop.
- [ ] The checkbox is on when the form opens if this weekday has the same
      slots in both parity weeks — the same lesson numbers with equal
      payloads, both weeks empty included — and off otherwise.
- [ ] A save with the checkbox on replaces this weekday in **both** parity
      weeks with the submitted lessons, through one `applyTemplateEdit` call,
      so it produces one new version, not two (ADR-006, overview §3.2). A
      save with it off writes only the parity week on the screen, as today.
- [ ] When the checkbox is on and the other week's day differs, the form says
      in Ukrainian that saving replaces that day of the other week. The
      sentence needs no JavaScript to appear.
- [ ] A lesson row whose content differs from the same `weekday` ×
      `lessonNumber` of the other parity week is marked, and shows the other
      week's content in small text — or that the other week has no lesson
      there. The mark is not colour alone. Rows equal in both weeks show
      nothing extra.
- [ ] "Equal", for both the checkbox default and the row mark, is decided by
      one pure, unit-tested function. It compares payloads after the same
      trimming the slot schema applies on save, so a cell does not read as
      different because of a trailing space.
- [ ] The Server Action reads the checkbox as a boolean from the form and
      nothing else; the parity weeks it writes are still bound by the form,
      never taken from the request (overview §8.4).
- [ ] A field error on a both-weeks save is shown on the row it concerns,
      exactly as on a single-week save.
- [ ] Every word the feature shows lives in `components/schedule/labels.ts`.
- [ ] `design/T-010-weekly-template-editor.md` §1 and §2 describe the
      checkbox and the two-parity write; ADR-006 is not edited.
- [ ] Tests: the equality function; the action's slot plan for a both-weeks
      save (both parities replaced, other weekdays untouched, one version);
      and the row mark for a differing, an equal and a one-sided row.
- [ ] Not in this ticket: a «both weeks» value of `parity`, a whole-template
      switch, or any change to `expand()`.

## Notes
