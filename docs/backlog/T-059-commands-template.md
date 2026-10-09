---
id: T-059
type: ticket
title: Commands 4/4 — the template, previewable in one transaction, and no write left in lib/actions
status: todo
depends_on: [T-057, T-058, T-060]
refs:
  - docs/architecture/decisions/ADR-028-writes-are-commands-and-transports-are-adapters.md
  - docs/architecture/architect-overview.md §3.2
  - docs/architecture/architect-overview.md §8.1
  - docs/architecture/decisions/ADR-006-template-day-is-the-save-unit.md
  - docs/architecture/decisions/ADR-025-both-parity-weeks-is-decided-per-lesson-row.md
---

## Goal

The last slice of ADR-028. The template writes (the day save, copy parity, the
boundary) move into commands, after T-043 has changed the day save and T-060
has pinned it down, so that the save moves once and in its final form.
`applyTemplateEdit()` stops taking `FormData`, and its reads go through the
caller's handle, so that several template commands compose in one transaction
and in the preview the import screens show (ADR-028).
The slice closes the series, after T-057 and T-058 have moved theirs: after it
no write is left in `lib/actions`, and a test keeps it that way, so the two styles do not live side by side past
the series. The teacher sees no difference.

## Acceptance criteria

- [ ] `lib/commands` holds the commands for the template day save, copy parity
      and the boundary, in the shape and under the convention tests of T-056.
      The copy-on-write planning stays in `lib/domain`, and the cut is still
      read from `lib/time/today.ts`.
- [ ] The template commands read the version in force and the next version's
      start through the caller's handle. An integration test saves two days of
      one view in one transaction and asserts that the result is one new
      version (the second save a `replace` of the version the first created),
      not an overlap refused by I3.
- [ ] The helper of T-056, in its rollback ending, over the same two day
      saves returns the versions and slots their commit leaves, and leaves no
      row.
- [ ] T-060's tests for these actions pass unmodified.
- [ ] A convention test asserts that no file in `lib/actions` writes to the
      database: no `insert`, `update`, `delete` or `transaction` on a Drizzle
      handle. Every write is a command.
- [ ] `architect-overview.md` §2, §8.2 and §8.4 and the root `CLAUDE.md` drop
      the note T-056 left that the move is incomplete.

## Notes
