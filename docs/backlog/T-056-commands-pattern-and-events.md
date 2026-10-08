---
id: T-056
type: ticket
title: Commands 1/4 — the command pattern, its convention tests, and the event writes
status: todo
depends_on: [T-050]
refs:
  - docs/architecture/decisions/ADR-028-writes-are-commands-and-transports-are-adapters.md
  - docs/architecture/architect-overview.md §2
  - docs/architecture/architect-overview.md §8.2
  - docs/architecture/architect-overview.md §8.4
  - docs/architecture/design/T-006-auth-boundary.md
  - docs/architecture/decisions/ADR-005-forms-use-action-state.md
---

## Goal

The first slice of ADR-028. It sets the shape every later slice copies, with
the event writes as its first case, because they are the simplest writes and
the first ones the import track needs (T-051). The event Server Actions keep
their signatures and become adapters: `requireUser()`, read `FormData`, call
the command, map its result onto `FormState`, `revalidatePath()`. The teacher
sees no difference.

## Acceptance criteria

- [ ] `lib/commands/events.ts` holds the commands for creating and updating a
      deadline and an info event, marking an event done, and deleting one.
      Each takes `userId` first and the raw input of the write's existing Zod
      schema (`z.input<typeof schema>`) second, and parses it with that schema
      (ADR-028). The event Server Actions no longer parse a schema.
- [ ] A refusal carries `code`, an optional `field` that is the issue's path in
      the raw input, and the Ukrainian `message` the form shows today.
- [ ] A command accepts an optional database handle and, with one, writes
      inside the caller's transaction. An integration test runs two event
      commands in one transaction and rolls it back.
- [ ] Convention tests over `lib/commands/**`, written here so that every later
      slice is held to them:
      - no command reads `FormData`, calls `requireUser()` or calls
        `revalidatePath()`;
      - `z.toJSONSchema(schema, { io: "input" })` converts every schema a
        command parses;
      - the T-022 test (every UPDATE checks the rows it matched) and the §8.4
        check in `lib/auth/queryDiscipline.test.ts` cover `lib/commands`, and
        the §8.4 check asserts that every exported command takes `userId`
        first and that every statement filters by it.
- [ ] T-050's tests for the event actions pass unmodified.
- [ ] `architect-overview.md` §2 shows `lib/commands/` in the layout and
      describes `lib/actions` as the form adapter. §8.2 states that the schema
      is parsed only in the command. §8.4 and the root `CLAUDE.md` state that
      a command takes `userId` first and only its adapter obtains it, from
      `requireUser()`. Each says the move is complete only with T-059.
- [ ] ADR-028 moves to `accepted`.

## Notes
