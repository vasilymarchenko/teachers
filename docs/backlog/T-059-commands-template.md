---
id: T-059
type: ticket
title: Commands 4/4 — the template, with a dry run, and no write left in lib/actions
status: todo
depends_on: [T-056, T-043]
refs:
  - docs/architecture/decisions/ADR-028-writes-are-commands-and-transports-are-adapters.md
  - docs/architecture/architect-overview.md §3.2
  - docs/architecture/architect-overview.md §8.1
  - docs/architecture/decisions/ADR-006-template-day-is-the-save-unit.md
  - docs/architecture/decisions/ADR-025-both-parity-weeks-is-decided-per-lesson-row.md
  - docs/architecture/lesson-input-and-import.md §5
---

## Goal

The last slice of ADR-028. The template writes (the day save, copy parity, the
boundary) move into commands, after T-043 has changed the day save, so that
the save moves once and in its final form. `applyTemplateEdit()` stops taking
`FormData`. The commands gain the dry run the import screens preview with.
The slice closes the series: after it no write is left in `lib/actions`, and
a test keeps it that way, so the two styles do not live side by side past
the series. The teacher sees no difference.

## Acceptance criteria

- [ ] `lib/commands` holds the commands for the template day save, copy parity
      and the boundary, in the shape and under the convention tests of T-056.
      The copy-on-write planning stays in `lib/domain`, and the cut is still
      read from `lib/time/today.ts`.
- [ ] The three commands accept `{ dryRun: true }` and return the
      `TemplateEditPlan` and the resulting slots without writing. A unit test
      covers trim, replace and create.
- [ ] An integration test runs two template commands in one caller's
      transaction and rolls it back.
- [ ] T-050's tests for these actions pass unmodified.
- [ ] A convention test asserts that no file in `lib/actions` writes to the
      database: no `insert`, `update`, `delete` or `transaction` on a Drizzle
      handle. Every write is a command.
- [ ] `architect-overview.md` §2, §8.2 and §8.4 and the root `CLAUDE.md` drop
      the note T-056 left that the move is incomplete.
      `lesson-input-and-import.md` §5, §6 and §7.2 describe the write path
      with the commands in place.

## Notes
