---
id: T-043
type: ticket
title: Template editor — a lesson row is written into both parity weeks by a per-row toggle, and the form shows where the weeks differ
status: todo
depends_on: [T-010, T-046, T-047]
refs:
  - docs/specs/specification.md §5.1
  - docs/architecture/glossary.md §3
  - docs/architecture/architect-overview.md §3.2
  - docs/architecture/architect-overview.md §8.2
  - docs/architecture/architect-overview.md §10.2
  - docs/architecture/design/T-010-weekly-template-editor.md §1
  - docs/architecture/design/T-010-weekly-template-editor.md §2
  - docs/architecture/design/T-010-weekly-template-editor.md §5
  - docs/architecture/decisions/ADR-006-template-day-is-the-save-unit.md
  - docs/architecture/decisions/ADR-025-both-parity-weeks-is-decided-per-lesson-row.md
---

## Goal

On `/schedule` every lesson row of the day form carries a toggle «в обох
тижнях» (`bothWeeks`). A save writes the week on the screen as today and, in
the same version, writes into the other parity week exactly the rows whose
toggle is on — the same lesson, or its removal if the row was emptied — and
leaves every other row of the other week as it was. The toggle opens on for a
row equal in both weeks. Every row that differs from the other week shows
what the other week has there, a row about to change the other week says how,
and after the save the form says what it changed there. «Скопіювати з
чисельника» stays as it is. The data model does not change (ADR-025).

## Acceptance criteria

- [ ] Each lesson row of `DayForm` has a `bothWeeks` toggle in its header
      line, in both views (`OWN` and `CLASS`) and on a phone as on a desktop:
      a native checkbox drawn as an icon (`lucide-react`, linked / unlinked),
      so it works with JavaScript off. The header line reads, in this order:
      «3 · 10:15», the toggle, T-046's clear icon. There is no day-level
      checkbox.
- [ ] The toggle's accessible name and its hover hint are the same text, and
      it names the lesson with the product term: «Урок 3 — в обох тижнях».
      Its state reads without decoding the icon: on is a filled icon in the
      accent colour, off an outlined muted one, and the two differ in shape
      as well as colour. The hit area is at least 24×24 CSS px.
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
- [ ] A row whose toggle is on and whose save would change the other week
      says what it will do there, naming the other week and the lesson:
      «додасть урок у знаменник» when the other week has no lesson there,
      «замінить «Фізика» у знаменнику» when both have one and they differ,
      «видалить «Фізика» зі знаменника» when this row is empty and the other
      week has a lesson. For a row that differs when the form opens, and for
      any row whose lesson fields are all empty, this needs no JavaScript: the
      server renders the candidate sentences and CSS picks one from the
      checkbox state and the fields' emptiness (`:has()`,
      `:placeholder-shown`).
- [ ] With JavaScript on, a row equal in both weeks whose lesson fields the
      teacher has changed while its toggle is on says that the change goes to
      the other week too. "Changed" is T-047's per-field answer; this ticket
      adds no comparison of its own. A clear by T-046's icon leaves the toggle
      as it is, so a cleared shared row says that the lesson will be removed
      from the other week too.
- [ ] After a save that wrote into the other week, the form says which
      lessons it changed there («Також змінено у знаменнику: урок 2, урок 4»).
      The sentence comes from the action's state, so it needs no JavaScript:
      `FormState` gains one optional field for a message about a successful
      submission, and every other form ignores it.
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
- [ ] `design/T-010-weekly-template-editor.md` §5 describes the toggle, its
      default, the header line and the row messages; §2 describes the
      two-parity write.
- [ ] ADR-025 is set to `accepted`; ADR-006 stays `accepted`; neither ADR's
      body is edited.
- [ ] Overview §3.2 states the save unit as one weekday of the week on the
      screen plus the rows shared with the other week, and links ADR-025
      alongside ADR-006.
- [ ] Tests: the equality function; the slot plan of a save (the scenario of
      ADR-025's context — a lesson added in one week with its toggle on
      reaches the other week while the rows that differ there are kept; an
      emptied shared row is removed from both weeks; other weekdays
      untouched; one version); the toggle default and the row mark for a
      differing, an equal, a one-sided and an empty row; which of the three
      sentences a row shows; the after-save message listing exactly the
      lessons the save changed in the other week.

Out of scope: a «both weeks» value of `parity`, a whole-template switch, a
day-level checkbox, and any change to `expand()` (ADR-025, ADR-021).

## Notes

Rewritten on 2026-10-04, before any work started, from a day-level checkbox
to a per-row toggle: ADR-025, which supersedes ADR-021. Revised the same day
after the review of #49: it now follows T-046 and T-047, reuses T-047's
per-field "changed", and reports after the save what it wrote into the other
week.
