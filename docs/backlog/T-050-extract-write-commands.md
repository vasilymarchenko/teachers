---
id: T-050
type: ticket
title: Extract every write into a command function taking userId first; Server Actions become adapters
status: todo
depends_on: [T-009, T-010, T-011, T-012, T-043, T-046]
refs:
  - docs/architecture/decisions/ADR-028-writes-are-commands-and-transports-are-adapters.md
  - docs/architecture/architect-overview.md §2
  - docs/architecture/architect-overview.md §8.2
  - docs/architecture/architect-overview.md §3.2
  - docs/architecture/architect-overview.md §8.1
  - docs/architecture/architect-overview.md §8.4
  - docs/architecture/design/T-006-auth-boundary.md
  - docs/architecture/decisions/ADR-005-forms-use-action-state.md
  - docs/architecture/lesson-input-and-import.md §5
---

## Goal

Every write the application makes runs through a command function in
`lib/commands`, `(userId, input, options?) → result`, as ADR-028 states. The
Server Actions in `lib/actions` keep their signatures and become adapters:
`requireUser()`, read `FormData`, call the command, map its result onto
`FormState`, `revalidatePath()`. The teacher sees no difference.

## Acceptance criteria

- [ ] `lib/commands/` holds one file per aggregate. It covers every write
      `lib/actions` makes today: academic year, semesters, non-teaching
      periods, weekday rules, parity anchors, bell schedule, the template
      (day save, copy parity, boundary), day overrides (save, clear, remove)
      and events (create, update, done, delete).
- [ ] No command reads `FormData`, calls `requireUser()` or calls
      `revalidatePath()`. A convention test asserts all three textually over
      `lib/commands/**`.
- [ ] Each command takes `userId` first and the raw input of the write's
      existing Zod schema (`z.input<typeof schema>`) second, and parses it with
      that schema (ADR-028). No Server Action parses a schema any more: it
      reads `FormData` into the raw input and passes it to the command. The
      schemas in `lib/validation` are unchanged.
- [ ] A convention test asserts that `z.toJSONSchema(schema, { io: "input" })`
      converts every schema a command parses.
- [ ] A refusal carries `code`, an optional `field` that is the issue's path in
      the raw input, and the Ukrainian `message` the form shows today. The
      `FormState` a form receives for every refusal path is unchanged. The
      existing action and schema tests pass unmodified, or are moved to the
      command with the same assertions.
- [ ] A command accepts an optional database handle and, with one, writes
      inside the caller's transaction. An integration test runs two template
      commands in one transaction and rolls it back.
- [ ] The template day save, copy parity and boundary commands accept
      `{ dryRun: true }` and return the `TemplateEditPlan` and the resulting
      slots without writing. A unit test covers trim, replace and create.
- [ ] The T-022 convention test (every UPDATE checks the rows it matched)
      covers `lib/commands`.
- [ ] The §8.4 static check (`lib/auth/queryDiscipline.test.ts`) scans
      `lib/commands`, and asserts there that every exported command takes
      `userId` first and that every statement filters by it.
- [ ] `architect-overview.md` §8.4 and the root `CLAUDE.md` state the rule as
      it now holds: a command takes `userId` first, and only its adapter
      obtains it, from `requireUser()`.
- [ ] `architect-overview.md` §8.2 states that the schema is parsed only in
      the command, and the Server Action only reads `FormData`.
- [ ] `architect-overview.md` §2 shows `lib/commands/` in the layout, and
      `lib/actions` is described as the form adapter. ADR-028 moves to
      `accepted`.
- [ ] `lesson-input-and-import.md` §5, §6 and §7.2 describe the write path
      with the commands in place.

## Notes
