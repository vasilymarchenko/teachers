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
- [ ] Each command takes `userId` first and validates its input with its own
      command input schema in `lib/validation`, which has no `transform`,
      `preprocess` or `coerce` (ADR-028). The rules about the data live in the
      command input schema. Each form schema keeps only the reading of the
      form's strings and ends in `.pipe()` into the command input schema of the
      same write.
- [ ] A convention test runs over every command input schema and asserts that
      `z.toJSONSchema()` converts it and that the output of parsing a valid
      sample parses again to the same value. It covers at least the bell
      schedule, the deadline and the template day, whose form schemas fail
      both checks today.
- [ ] A refusal carries `code`, an optional `field` that is a path in the
      command input, and the Ukrainian `message` the form shows today. The
      Server Action maps the path onto the form's field name. The `FormState` a
      form receives for every refusal path is unchanged. The existing action
      and schema tests pass unmodified, or are moved to the command or the
      command input schema with the same assertions.
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
- [ ] `architect-overview.md` §8.2 states the two schemas as they now hold: a
      form schema reads the form and ends in the command input schema, and a
      command input schema has no transforms.
- [ ] `architect-overview.md` §2 shows `lib/commands/` in the layout, and
      `lib/actions` is described as the form adapter. ADR-028 moves to
      `accepted`.
- [ ] `lesson-input-and-import.md` §5, §6 and §7.2 describe the write path
      with the commands in place.

## Notes
