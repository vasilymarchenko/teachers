---
id: T-023
type: ticket
title: A field error whose field is not on the screen must still be shown
status: todo
depends_on: [T-009, T-010]
refs:
  - docs/architecture/architect-overview.md §8.2
  - docs/architecture/decisions/ADR-005-forms-use-action-state.md
---

## Goal

Make it impossible for a Server Action to refuse a save and have the refusal
render nowhere. `FormState.fieldErrors` is keyed by the `name=` a form spells,
so a message keyed to a field the submitting form does not render is a save that
silently does nothing — the teacher presses «Зберегти» and the screen does not
move.

## Acceptance criteria

- [ ] A form that renders a `FormState` shows every `fieldErrors` entry: one
      whose key it rendered goes on that control, as now; one whose key it did
      not goes where `FormMessage` puts a form-level message.
- [ ] The mechanism is in the shared form layer, not repeated per screen — a
      new form gets the behaviour without opting in.
- [ ] A unit test covers the case: a `FormState` with a `fieldErrors` key no
      control on the form claims, and the message still reaches the output.
- [ ] `architect-overview.md` §8.2 states the rule, since it is the contract
      between an action and the form it answers.

## Notes

Found twice, in two consecutive tickets, which is why it is a ticket rather than
a third fix:

- T-009 — `acb052f`, «Route the out-of-year boundary message to a field the form
  shows»;
- T-010 — a day save and a parity copy both reach the boundary refusal of
  `boundaryFor()` (the default `END_OF_SEMESTER` of specification §5.1 has
  nothing to resolve against until the year has semesters), and neither form
  carries a boundary input. Fixed in that ticket by `boundaryRefusal()`, which
  decides per submission whether the message goes on a field or on the form —
  a per-call-site fix, which is exactly what this ticket replaces.

Both fixes were correct and both were reasoning a reviewer had to do by hand.
The safety net belongs one level down: an action author cannot always know which
form is submitting, and should not have to.

A static check was considered and rejected: whether a form renders a given field
name is not decidable from the syntax of `lib/actions`, which is where the
message is written. Hence a runtime fallback plus a test, not a lint rule.
