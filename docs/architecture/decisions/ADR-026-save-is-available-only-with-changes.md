---
id: ADR-026
title: Save is available only with changes, judged from a record of the rendered form
status: accepted
date: 2026-10-04
ticket: T-047
---

## Context

Every edit form opens filled with stored or planned values, and its «Зберегти»
was always available. Pressing it without changing anything is not harmless.
The template editor writes a new version for every save (ADR-006). The override
form, opened over a planned lesson, creates a `DayOverride` row that repeats
the template. A symbolic boundary is resolved again (overview §8.1).

The forms are uncontrolled and submit through `useActionState` with no client
schema, so that they work with JavaScript off (ADR-005). One form is
controlled: the bell grid computes the lesson ends as the teacher types.
T-043 and T-046 are written against whatever this decides: T-046's clear icon
sets values from code, and T-043's per-row toggle changes how a row is saved
without changing what it holds.

## Options

**Controlled forms, comparing React state with the stored row.** Every input
becomes `value` + `onChange`, and each form states its own equality. This
undoes what ADR-005 kept: the form state moves into React, a form needs
JavaScript to hold what was typed, and every one of about a dozen forms has to
be rewritten and keeps its own copy of the comparison.

**A form library (react-hook-form `isDirty`).** ADR-005 already rejected it.
`isDirty` compares against `defaultValues` declared in JavaScript, which is a
second record of what the page rendered, kept beside the first one.

**A record of the rendered form, compared on DOM events.** Record the
`FormData` the form would submit if reset to its rendered defaults, compare the
current `FormData` against it on `input`, `change` and `reset`,
and let the one controlled form report its own answer. The inputs stay
uncontrolled. The comparison is one function for every form. The price is a
contract: code that sets a value has to say so with an `input` event, because
setting `.value` fires none.

**`disabled` or `aria-disabled` for the unavailable button.** A `disabled`
button leaves the tab order and swallows a press without saying anything. A
teacher who presses Enter in a field or taps the button gets no answer. With
`aria-disabled`, the button keeps its focus and its press, so the press can be
answered with text. The cost is that the press has to be cancelled by hand.

## Decision

- A form that opens filled with stored or planned values renders through
  `TrackedForm`. A form that opens empty, and a form without fields, does not.
- "Changed" means the `FormData` the form would submit now differs from the
  record, which is the form's rendered defaults. The record is retaken on every
  render of the form, except while it shows a refusal, so that it is kept after
  a refusal. Names in `untracked` are left out of the comparison.
- A value set from code dispatches a bubbling `input` event on its field. A
  field the page adds or removes is caught by a `MutationObserver`.
- A controlled form passes `changed` itself. A page passes `changedOnOpen` when
  a save of the unchanged form would still write something new, which is a
  stale symbolic boundary (overview §8.1).
- Inside a tracked form, `SubmitButton` sets `aria-disabled="true"` while the
  form is unchanged or a save is pending. It cancels the press. After a press
  on an unchanged form it shows `UNCHANGED_REASON`, which `aria-describedby`
  points at. Before hydration it is available.

## Consequences

- No input changes shape. With JavaScript off every form saves as before.
- Any future code that writes into a tracked field has to dispatch `input`.
  Code that forgets leaves the button muted over a real change. The failure is
  visible, but the suite cannot catch it, because it has no DOM.
- The browser half — `FormData`, the observer, and the timing of React's form
  reset relative to the effect that settles the record — is tested only by
  hand. Revisit this once the repository has a browser test job (the year-setup
  browser test ticket proposes one), or if a form arrives whose saved value
  cannot be read back from its `FormData`.
