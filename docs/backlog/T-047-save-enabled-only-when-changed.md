---
id: T-047
type: ticket
title: Edit forms enable «Зберегти» only when they hold unsaved changes
status: in-progress
depends_on: [T-009, T-010, T-011, T-012]
refs:
  - docs/architecture/architect-overview.md §8.1
  - docs/architecture/architect-overview.md §8.2
  - docs/architecture/architect-overview.md §10.2
  - docs/architecture/design/T-010-weekly-template-editor.md §1
  - docs/architecture/design/T-011-day-overrides.md §1
---

## Goal

Every form that opens filled with stored or planned values shows its save
button as unavailable while it still holds those values, and as available as
soon as any input differs from them — and unavailable again if the teacher
puts the old value back. One mechanism serves every such form: a form opts
in, and `SubmitButton` reads the form's changed state from it. Forms that open
empty keep today's button.

## Acceptance criteria

- [ ] One client-side mechanism in `components/forms/` (a wrapper component
      or a hook with a context) records the form's submitted fields as
      rendered and compares the current fields against that record on every
      `input`, `change` and `reset` event of the form. An uncontrolled form's
      inputs stay uncontrolled.
- [ ] The contract for a value set from code — a clear or an undo by icon
      (T-046), a value normalised on blur — is that the code dispatches a
      bubbling `input` event on the field it changed. The mechanism needs no
      other notification.
- [ ] A controlled form (the bell grid of `components/year/bells-section.tsx`)
      reports its changed state to the mechanism itself, computed from its own
      state against the stored rows, instead of the DOM comparison.
- [ ] A form can leave a field out of the comparison: a field that changes
      how the save is written but, in that row, not what it writes (T-043's
      toggle on a row equal in both weeks) does not make the form changed by
      itself.
- [ ] "Changed" means the current fields differ from the record, not that an
      input event happened: restoring every edited value makes the form
      unchanged again.
- [ ] A form whose stored boundary is symbolic (`boundaryKind`) — a weekday
      rule, `BoundaryForm`, an event being edited — and whose symbol the page
      would now resolve to a different date than the stored one opens as
      changed, because resubmitting it rewrites that date (overview §8.1). It
      says so in one sentence next to the boundary field: the date is out of
      date, and saving updates it. The page decides this on the server, so the
      sentence needs no JavaScript to appear; its text lives in the labels file
      of that form's screen.
- [ ] `SubmitButton` inside an opted-in form is unavailable when the form is
      unchanged or the action is pending, and available otherwise. Outside an
      opted-in form it behaves exactly as today.
- [ ] Unavailable is `aria-disabled="true"`, not `disabled`: the button stays
      in the tab order, a click on it submits nothing, and it is visibly
      muted. Nothing is said while the teacher has not touched it. Activating
      the muted button — a click, a tap, Enter in a field — shows next to it,
      as text, why nothing was saved, and the button's `aria-describedby`
      points at that text; it goes away once the form changes. The text lives
      in `components/forms/`, next to `SubmitButton`.
- [ ] After a successful save the record is taken again from the re-rendered
      form, so the button is unavailable. After a save that returned errors
      the record is kept, so the form still reads as changed and the button
      stays available.
- [ ] Before hydration, and with JavaScript off, the button is available and
      the form saves as it does today.
- [ ] Opted in — every form that opens filled with stored or planned values:
      the `components/year/*` forms rendered for a stored row (the year, a
      semester, a non-teaching period, a weekday rule) and the bell grid,
      `DayForm`, `BoundaryForm`, the override form (whether or not an override
      is in force: without one it opens filled with the planned lesson, and an
      unchanged save would create an override row), and
      the event form when it edits an existing event. Not opted in: sign-in,
      every form that opens empty (the empty year, semester, period, rule and
      parity reset forms of `/year`, and the event form when it creates one),
      and every form without fields, which is a single action button
      (`DeleteButton`, the forms of `override-actions`, `copy-parity-form`).
- [ ] Tests: the comparison (an edit, an edit reverted, a cleared field, a
      checkbox, a field added to the form by the page, a value set from code
      with its `input` event, a form reset, a field left out of the
      comparison); a controlled form's own report; a stale symbolic boundary
      opening as changed and a current one as unchanged; the reason shown only
      after the muted button is activated; the record kept after an error and
      retaken after a success.
- [ ] The convention — which forms opt in (those that open filled with stored
      or planned values), what "changed" means, a field left out of it, and
      the contract for a value set from code — is stated once, in
      `architect-overview.md` §8.2, and
      `design/T-010-weekly-template-editor.md` §1 and
      `design/T-011-day-overrides.md` §1 reference it. `architect-overview.md`
      §8.1 states that a form whose symbolic boundary is stale opens as
      changed and says so, beside the period form's hint it already names.

Out of scope: a warning on leaving the page with unsaved changes, and a
marker of unsaved changes outside the form itself.

## Notes

Implemented on `claude/ticket-t-047-save-when-changed`. Mechanics:
`docs/architecture/design/T-047-save-when-changed.md`; the decision between a
DOM record and controlled forms, and `aria-disabled` over `disabled`:
`docs/architecture/decisions/ADR-026-save-is-available-only-with-changes.md`.
The page and the action resolve a symbolic boundary against the same data —
`getBoundaryFrame()` for the template and event forms, the selected year's own
lists for a weekday rule — so a stale boundary is never announced that the
save would not write. Remaining: the review (phase 7) and the criteria ticked
against evidence.
