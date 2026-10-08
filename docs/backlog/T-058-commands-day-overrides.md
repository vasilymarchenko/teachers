---
id: T-058
type: ticket
title: Commands 3/4 — day overrides
status: todo
depends_on: [T-056]
refs:
  - docs/architecture/decisions/ADR-028-writes-are-commands-and-transports-are-adapters.md
  - docs/architecture/architect-overview.md §3.4
  - docs/specs/specification.md §5.3
  - docs/specs/specification.md §5.4
---

## Goal

The third slice of ADR-028, in the shape T-056 set: saving, clearing and
removing a day override move into commands, and their Server Actions become
adapters. Quick add of lessons and overrides (T-052) needs these commands. The
teacher sees no difference.

## Acceptance criteria

- [ ] `lib/commands` holds the commands for saving a day override, clearing a
      lesson and removing an override, in the shape and under the convention
      tests of T-056.
- [ ] T-050's tests for these actions pass unmodified.

## Notes
