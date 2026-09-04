---
id: ADR-005
title: Forms submit through useActionState, not react-hook-form
status: accepted
date: 2026-09-03
ticket: T-009
---

## Context

`architect-overview.md` §8.2 fixed validation as *«Одна Zod-схема на форму, що
використовується і на клієнті (react-hook-form), і в Server Action як межа
довіри»*. The naming of react-hook-form there is a fifteen-word aside in a
section whose subject is the *single schema*, and it was written before any form
existed.

By T-009 one form did exist: sign-in (T-006). It uses `useActionState` with the
schema parsed in the Server Action and the field errors returned in the action's
state — no react-hook-form, no resolver, and no dependency beyond React and Zod.
T-009 adds six more forms across one screen, so whatever it does becomes the
pattern for the weekly template editor (T-010), day overrides (T-011) and events
(T-012).

## Options

**Add react-hook-form and `@hookform/resolvers`.** Matches §8.2 word for word,
and validates in the browser before a round trip. Costs two dependencies, a
second validation path to keep in step with the server's, and — the part that
decides it — every form becomes JavaScript-dependent, because a react-hook-form
form submits through its own handler. The sign-in form would also be the odd one
out until it was migrated, which is work T-009 was not asked for.

**Adopt react-hook-form everywhere, sign-in included.** Removes the
inconsistency at the cost of widening T-009 past its acceptance criteria, and
keeps every other cost above.

**Keep `useActionState`.** The Zod schema stays the single definition of the
form and is still shared with the client — not as a resolver but as the
*contract*: each schema module exports a field-name map declared
`as const satisfies Record<keyof <Input>, string>`, and the form spells its
`name=` attributes from it, so a renamed key fails the type check. The browser
still validates cheaply through `required`, `type="date"`, `type="time"` and
`maxLength`, which are attributes rather than a second code path. Costs a round
trip to learn that a date range is backwards, and messages that arrive one
submission at a time.

## Decision

Forms submit through `<form action={…}>` and `useActionState`. The Server Action
is the only place a schema is parsed, and it returns `FormState`
(`lib/validation/formState.ts`) carrying the field errors, a message about the
submission as a whole, and the submitted values echoed back — React resets an
uncontrolled form when its action resolves, so a refused submission would
otherwise come back empty.

One Zod schema per form still holds, and the client's half of the sharing is the
`*_FIELD` name map, not a resolver. `architect-overview.md` §8.2 has been
corrected to say this and to point here.

react-hook-form is not a dependency of this project.

## Consequences

Every form on the year-setup screen works with JavaScript off, which is also
what makes the calendar's navigation work (T-007) and is the cheapest form of
resilience on a teacher's phone. The one exception is the delete confirmation,
which is a `confirm()` and degrades to deleting straight away.

Validation lives in exactly one place, so a rule cannot pass in the browser and
fail on the server or the reverse.

The cost is latency on a refused submission and one message per field per
submission. Revisit if a form appears whose validation genuinely needs to be
interactive before submission — a schedule editor that must say «цей слот уже
зайнятий» while the teacher is still choosing — since that is a requirement no
attribute can express, and it would be an argument for a client validator on
that screen rather than for changing this one.
