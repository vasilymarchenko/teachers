---
id: T-050
type: ticket
title: Commands 0/4 — characterization tests for the write Server Actions outside the template
status: todo
depends_on: [T-009, T-010, T-011, T-012]
refs:
  - docs/architecture/decisions/ADR-028-writes-are-commands-and-transports-are-adapters.md
  - docs/architecture/architect-overview.md §3.2
  - docs/architecture/architect-overview.md §8.1
  - docs/architecture/architect-overview.md §8.2
  - docs/architecture/architect-overview.md §8.4
  - docs/architecture/decisions/ADR-005-forms-use-action-state.md
  - docs/architecture/design/expand-fixtures.md §3.8
---

## Goal

The series T-056–T-059 moves every write out of `lib/actions` into command
functions (ADR-028) and promises that the teacher sees no difference. Today
nothing can check that promise: none of the 27 write Server Actions has a test,
and the only tests that import `lib/actions` are about signing in. This ticket
pins down what the 24 actions outside the template do now (events, the year
frame and the bells, day overrides), so that each slice of the refactor is
checked against it. The three template actions are T-060's, after T-043 has
changed their save. It changes no application code.

## Acceptance criteria

- [ ] Every exported write Server Action in `lib/actions` except `auth.ts` and
      `scheduleTemplate.ts` has integration tests (`*.integration.test.ts`, against a migrated Postgres),
      called the way a form calls it: `FormData` in, `FormState` out. They mock
      `requireUser()` and `revalidatePath()` as
      `lib/auth/setupGate.integration.test.ts` already does, and nothing else.
- [ ] For each action, a successful submission asserts the rows it leaves in
      the database, not only the `FormState`.
- [ ] For each action, every refusal path the action has asserts the exact
      `FormState`: `fieldErrors`, the message about the submission as a whole,
      and the values echoed back. A refusal asserts too that nothing was
      written.
- [ ] For each action, a second teacher's rows are untouched by the first
      teacher's submission, including one that names the second teacher's row
      id (overview §8.4).
- [ ] A test whose outcome depends on the date fixes the clock through the
      instant `today()` takes, never through a date.
- [ ] The tests are written against the actions' public behaviour only, so
      that T-056–T-058 can run them unmodified through the adapters they leave
      behind.
- [ ] No file outside the new tests changes, apart from a test helper they
      share, which T-060 reuses.

## Notes
