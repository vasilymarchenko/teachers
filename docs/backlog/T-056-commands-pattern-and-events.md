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
      Each takes `userId` first and `{ target, data }` second (ADR-028).
      `data` is the raw input of the write's existing Zod schema
      (`z.input<typeof schema>`). `target` is `{ eventId }` for an update, the
      done mark and a delete, parsed by a target schema added to
      `lib/validation`, and empty for a create. The event Server Actions fill
      `target` from their bound `eventId` and no longer parse a schema.
- [ ] A refusal carries `code`, an optional `field`, and the Ukrainian
      `message` the form shows today. `field` is the issue's path in `data`,
      or `target.<name>` for an issue in the target.
- [ ] A command accepts an optional database handle and, with one, both reads
      and writes inside the caller's transaction: every `lib/db/queries`
      function it calls takes the handle as an optional last parameter
      (ADR-028). An integration test runs two event commands in one
      transaction, the second reading what the first wrote, and rolls it back.
- [ ] One helper in `lib/commands` runs a caller's commands in one
      transaction and ends it either with a commit or with a rollback after
      reading the resulting state through the same handle (ADR-028). The
      rollback ending is the preview. Integration tests run two event
      commands through it. In the commit ending, both rows are written. In the
      rollback ending, the state it returns equals what the commit leaves,
      and no row is left. When the second of three commands refuses:
      - in the commit ending, nothing is left;
      - in the rollback ending, each command runs in its own savepoint
        (ADR-028), the preview shows the outcome of the first and the third,
        the second's refusal is reported against it, and no row is left.
- [ ] The rollback ending returns the state the caller reads for its screen
      and the fingerprint of the diff the commands made, and the commit
      ending accepts an expected fingerprint (ADR-028). The helper reads the
      teacher's rows of every table with a `userId` column before and after
      the commands, and a convention test asserts that it covers every such
      table. Integration tests show five things:
      - The same state previewed twice gives the same fingerprint, so no
        generated id or timestamp enters it.
      - A commit whose expected fingerprint matches writes.
      - A commit after another request has changed a row the commands touch
        rolls back and returns the new preview.
      - A commit after another request has changed a row the commands do not
        touch, such as another event marked done, writes.
      - A commit with no expected fingerprint writes as before.
- [ ] Convention tests over `lib/commands/**`, written here so that every later
      slice is held to them:
      - no command reads `FormData`, calls `requireUser()` or calls
        `revalidatePath()`;
      - `z.toJSONSchema(schema, { io: "input" })` converts every schema a
        command parses, target schemas included;
      - the T-022 test (every UPDATE checks the rows it matched) and the §8.4
        check in `lib/auth/queryDiscipline.test.ts` cover `lib/commands`, and
        the §8.4 check asserts that every exported command takes `userId`
        first and that every statement filters by it. The helper and the
        fingerprint run other commands and are not commands themselves. They
        live in one module, which is the only exemption the test names.
- [ ] T-050's tests for the event actions pass unmodified.
- [ ] `architect-overview.md` §2 shows `lib/commands/` in the layout and
      describes `lib/actions` as the form adapter. §8.2 states that the schema
      is parsed only in the command. §8.4 and the root `CLAUDE.md` state that
      a command takes `userId` first and only its adapter obtains it, from
      `requireUser()`. Each says the move is complete only with T-059.
- [ ] ADR-028 moves to `accepted`.

## Notes
