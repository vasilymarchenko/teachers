---
id: T-043
type: ticket
title: Template editor — a lesson row is written into both parity weeks by a per-row toggle, and the form shows where the weeks differ
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
  - docs/architecture/decisions/ADR-025-both-parity-weeks-is-decided-per-lesson-row.md
---

## Goal

On `/schedule` every lesson row of the day form carries a toggle «в обох
тижнях» (`bothWeeks`). A save writes the week on the screen as today and, in
the same version, writes into the other parity week exactly the rows whose
toggle is on — the same lesson, or its removal if the row was emptied — and
leaves every other row of the other week as it was. The toggle opens on for a
row equal in both weeks, so a new day is filled once and a shared lesson is
changed once, and a lesson added to one week is carried into the other
without touching the lessons that already differ. Every row that differs
from the other week shows what the other week has there. «Скопіювати з
чисельника» stays as it is. The data model does not change (ADR-025).

## Acceptance criteria

- [ ] Each lesson row of `DayForm` has a `bothWeeks` toggle in its header
      line, in both views (`OWN` and `CLASS`) and on a phone as on a desktop:
      a native checkbox drawn as an icon (`lucide-react`, linked / unlinked),
      so it works with JavaScript off. Its accessible name names the lesson
      and the other week («Урок 3 також у знаменнику»). There is no
      day-level checkbox.
- [ ] A row's toggle is on when the form opens exactly when that `weekday` ×
      `lessonNumber` is equal in both parity weeks — equal payloads, or empty
      in both — and off otherwise.
- [ ] A save replaces the week on the screen at the rendered rows, as today.
      In the other parity week it replaces only the lesson numbers whose
      toggle is on: with the submitted payload, or by removing the slot when
      the row is empty. Lesson numbers whose toggle is off, and lessons the
      form did not render, are carried into the new version of the other week
      unchanged. Both halves go through one `applyTemplateEdit()` call, so
      they are written in one transaction or not at all.
- [ ] The slot plan for that save is computed by one pure function in
      `lib/domain/schedule/templateSlots.ts`, next to `replaceDaySlots()`.
- [ ] A row whose content differs from the other week is marked and shows
      the other week's content in small text, or that the other week has no
      lesson there. The mark is not colour alone. Rows equal in both weeks
      show nothing extra.
- [ ] A differing row whose toggle is on says that saving replaces the other
      week's lesson there, naming it. This text needs no JavaScript to appear
      (CSS on the checkbox state).
- [ ] With JavaScript on, a row equal in both weeks whose inputs the teacher
      has changed while its toggle is on says that the change goes to the
      other week too.
- [ ] "Equal", for the toggle default and the row mark, is decided by one
      pure, unit-tested function. It compares payloads after the same
      trimming the slot schema applies on save, so a cell does not read as
      different because of a trailing space.
- [ ] The toggles are the only new input of `saveTemplateDayAction`, read as
      one boolean per rendered lesson number; `view`, `parity`, `weekday` and
      `lessonNumbers` stay the bound arguments of
      `design/T-010-weekly-template-editor.md` §1, and the other parity is
      derived from the bound one, never submitted.
- [ ] A field error is shown on the row it concerns, whether the row's toggle
      is on or off.
- [ ] Every word the feature shows lives in `components/schedule/labels.ts`.
- [ ] `design/T-010-weekly-template-editor.md` §1 and §2 describe the toggle,
      its default, and the two-parity write.
- [ ] ADR-025 is set to `accepted` and ADR-006 to `superseded by ADR-025`;
      neither ADR's body is edited.
- [ ] Overview §3.2 states the save unit as one weekday of the week on the
      screen plus the rows shared with the other week, and links ADR-025
      alongside ADR-006.
- [ ] Tests: the equality function; the slot plan of a save (the scenario of
      ADR-025's context — a lesson added in one week with its toggle on
      reaches the other week while the rows that differ there are kept; an
      emptied shared row is removed from both weeks; other weekdays
      untouched; one version); the toggle default and the row mark for a
      differing, an equal, a one-sided and an empty row.

Out of scope: a «both weeks» value of `parity`, a whole-template switch, a
day-level checkbox, and any change to `expand()` (ADR-025, ADR-021).

## Notes

Rewritten on 2026-10-04 before any work started: the day-level checkbox this
ticket first asked for could not carry one lesson into the other week without
overwriting that week's differences. The decision and the scenario that broke
it are ADR-025, which supersedes ADR-021.
