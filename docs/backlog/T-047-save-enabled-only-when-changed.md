---
id: T-047
type: ticket
title: Edit forms enable «Зберегти» only when they hold unsaved changes
status: todo
depends_on: [T-009, T-010, T-011, T-012]
refs:
  - docs/architecture/architect-overview.md §8.2
  - docs/architecture/architect-overview.md §10.2
  - docs/architecture/design/T-010-weekly-template-editor.md §1
  - docs/architecture/design/T-011-day-overrides.md §1
---

## Goal

Every form that edits stored data shows its save button as unavailable while
the form holds exactly what was stored, and as available as soon as any input
differs from it — and unavailable again if the teacher puts the old value
back. One mechanism serves every such form: a form opts in, and
`SubmitButton` reads the form's changed state from it. Forms that are not
edits of stored data keep today's button.

## Acceptance criteria

- [ ] One client-side mechanism in `components/forms/` (a wrapper component
      or a hook with a context) records the form's submitted fields as
      rendered and compares the current fields against that record on every
      `input` and `change` event of the form. The form's inputs stay
      uncontrolled.
- [ ] "Changed" means the current fields differ from the record, not that an
      input event happened: restoring every edited value makes the form
      unchanged again.
- [ ] `SubmitButton` inside an opted-in form is unavailable when the form is
      unchanged or the action is pending, and available otherwise. Outside an
      opted-in form it behaves exactly as today.
- [ ] Unavailable is `aria-disabled="true"`, not `disabled`: the button stays
      in the tab order, a click on it submits nothing, and it is visibly
      muted. A short hint next to it says there are no changes; the hint's
      text lives in `components/forms/`, next to `SubmitButton`.
- [ ] After a successful save the record is taken again from the re-rendered
      form, so the button is unavailable. After a save that returned errors
      the record is kept, so the form still reads as changed and the button
      stays available.
- [ ] Before hydration, and with JavaScript off, the button is available and
      the form saves as it does today.
- [ ] Opted in: every `components/year/*` form rendered for a stored row
      (the year, a semester, a non-teaching period, a weekday rule, a parity
      reset) and the bell grid, `DayForm`, `BoundaryForm`, the day override
      form, and the event form when it edits an existing event. Not opted
      in: sign-in, every form that adds a new row (the empty year, semester,
      period, rule and parity reset forms of `/year`, and the event form when
      it creates one), and the buttons that perform a single action with a
      confirmation (`override-actions`, `copy-parity-form`, `DeleteButton`).
- [ ] Tests: the comparison (an edit, an edit reverted, a cleared field, a
      checkbox, a field added to the form by the page); the record kept after
      an error and retaken after a success.
- [ ] The convention — which forms opt in and what "changed" means — is
      stated once, in `architect-overview.md` §8.2, and
      `design/T-010-weekly-template-editor.md` §1 and
      `design/T-011-day-overrides.md` §1 reference it.

Out of scope: a warning on leaving the page with unsaved changes, and a
marker of unsaved changes outside the form itself.

## Notes
