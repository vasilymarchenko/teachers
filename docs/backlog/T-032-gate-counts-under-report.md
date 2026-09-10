---
id: T-032
type: ticket
title: The gate can under-report — a missing origin/main, a dirty tree, an unresolvable opening head
status: todo
depends_on: [T-029]
refs:
  - docs/architecture/decisions/ADR-012-one-check-definition.md
  - docs/backlog/T-029-gate-and-loop.md
---

## Goal

Three places in the gate answer a question it could not measure, and each
answers it in the direction that lets work through. Found by the review of
T-021, in code that ticket did not touch.

1. `scripts/gate/index.ts:63` — when `origin/main` is absent (a fresh clone, a
   detached checkout), the fallback for the committed half of the change is
   `git diff --name-only HEAD`, which is the *uncommitted* diff and is already
   the next line. Everything committed on the branch therefore disappears from
   the change, so a branch that edits `lib/db/**` or a `Dockerfile` selects
   neither the database checks nor the image builds — not even as `skipped`,
   which would at least be visible — and the table prints all green.
2. `scripts/gate/index.ts:296` — `--report` reads the last run's `dirty` flag
   and compares its commit with `HEAD`, but never asks whether the tree is dirty
   *now*. Gate a clean tree at commit A, then edit three files without
   committing: both guards hold and the ticket is reported done on the strength
   of a run that never saw the edits.
3. `scripts/gate/ledger.ts:222` — when the opening head resolves in neither the
   reflog nor `rev-list`, the count falls back to `0`, and the derivation string
   printed beside it reads like a measurement. The `pushesAfterOpening` cap can
   then never trip.

## Acceptance criteria

- [ ] With no `origin/main` present, a committed change under `lib/db/**` still
      selects the database checks — or, if the change cannot be resolved at all,
      every check that depends on knowing it is reported `skipped` with that as
      the reason. A test covers the no-`origin/main` case.
- [ ] `npm run gate -- --report` refuses when the working tree is dirty at the
      moment it runs, naming that as the blocker.
- [ ] A count that could not be derived is never printed as a number: it says so
      and `--report` treats it as a blocker rather than as zero.
- [ ] Each of the three has a test that fails against today's code.

## Notes

The rule these share is the gate's own: «A check it cannot run here is reported
`skipped` with the reason, which is not a pass» — the same must hold for an
input it cannot resolve.
