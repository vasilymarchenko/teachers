---
id: ADR-023
title: A form shows every field error, claimed or not
status: accepted
date: 2026-10-01
ticket: T-023
---

## Context

A Server Action answers a form with `FormState` (ADR-005), whose `fieldErrors`
is keyed by the `name=` the form spells. A form rendered a message by indexing
that record with each name it knew — `state.fieldErrors?.[X]` — and rendered
`state.error` in `FormMessage`.

Nothing connected the two sides. An action that keyed a message to a field the
submitting form did not render produced a refusal that appeared nowhere: the
save did nothing and the screen did not move. It happened in two consecutive
tickets. T-009 keyed an out-of-year message to a field its form lacked. In T-010
a day save and a parity copy reached the boundary refusal that the boundary form
also reaches, and neither carries a boundary control; the fix there was
`boundaryRefusal()`, which looked at the submission to decide between a field
message and a form message. Both fixes were reasoning done by hand at one call
site, and the next shared refusal would need it done again.

An action cannot always know which form is submitting, and whether a control is
on the screen can depend on client state — the event form renders its boundary
controls only once a repetition is chosen.

## Options

**Decide in the action helpers, from the submission.** `rejectedField()` and
`invalidInput()` move a message to `error` when `formData` has no entry under
the field's name. One file changes and no form does. It generalises exactly what
`boundaryRefusal()` did. It is wrong in one direction: a hidden input is
submitted and has no control to carry a message, so an error keyed to it would
still vanish. It also guesses about rendering from the request, when the
renderer knows.

**A static check.** Rejected in the ticket: whether a form renders a field name
is not decidable from the syntax of `lib/actions`, and the event form's
conditional controls make it undecidable from the form's syntax too.

**Decide in the form, at render.** The form hands out each field message as it
renders the control for it and records which names were asked for; the
form-level message component prints everything that was not. Exact — what is
shown is what was rendered — at the cost of touching every form once and of a
rule about where the form-level message sits.

**Register fields through context and an effect.** Also exact, and independent
of where the message component sits, but an effect does not run on the server:
the fallback would be missing from the HTML a browser with JavaScript off
receives, which is the property ADR-005 was taken for.

## Decision

A form reads its errors through `formErrorsOf(state)`
(`components/forms/field-errors.ts`) and nowhere else:

- `errors.for(name)` returns the message for a field and records the name as
  claimed. The form calls it for the control it is rendering.
- `FormMessage` takes that object as its only input and renders
  `errors.unclaimed()`: `state.error`, then every `fieldErrors` message whose
  name was not claimed.
- The object is created in the render that uses it and never kept. Recording a
  claim is a mutation of a value local to that render, so a repeated render
  gives the same output, and the whole mechanism runs in the single server
  pass.
- `FormMessage` is rendered after the form's controls.
- No file under `app/` or `components/`, outside `components/forms/`, names
  `fieldErrors` at all — member access, destructuring or a string key.
  `components/forms/field-errors.test.ts` enforces it. `lib/` is outside the
  check: actions write the record and tests assert on it; neither renders it.

An action names the field its message is about and makes no decision about
where it is shown. `boundaryRefusal()` no longer inspects the submission.

## Consequences

A new form gets the fallback by being written at all: `FormMessage` accepts
nothing but the object that carries it, and the convention test refuses the
direct read that would bypass it.

An action author no longer has to know the forms that call the action, and a
reviewer no longer has to check each field key against each form.

The cost is the ordering rule. A control rendered after `FormMessage` — or
claimed inside a child component that renders after it — would have its message
shown twice, once at the form level and once on the control. That is a visible
duplicate rather than a silent loss, which is the safe direction to fail in, but
it is not checked by a test. A message that falls back is also shown without its
field's label, so an action's wording has to stand on its own; the two messages
that take this path today already do.

Revisit if a form needs its form-level message above its controls, or if forms
stop being rendered in one pass on the server — either would remove the property
the render-time record depends on, and the context-and-effect option would then
be the one to weigh again.
