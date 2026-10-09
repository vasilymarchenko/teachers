---
id: T-060
type: ticket
title: Commands 0/4 — characterization tests for the template write Server Actions, on the save T-043 leaves
status: todo
depends_on: [T-043, T-050]
refs:
  - docs/architecture/decisions/ADR-028-writes-are-commands-and-transports-are-adapters.md
  - docs/architecture/architect-overview.md §3.2
  - docs/architecture/architect-overview.md §8.1
  - docs/architecture/decisions/ADR-006-template-day-is-the-save-unit.md
  - docs/architecture/decisions/ADR-025-both-parity-weeks-is-decided-per-lesson-row.md
  - docs/architecture/design/expand-fixtures.md §3.8
---

## Goal

T-050 pins down the write Server Actions outside the template. This ticket
does the same for the three in `lib/actions/scheduleTemplate.ts` (the day
save, copy parity, the boundary), after T-043 has changed the day save, so that
the tests are written once and against the save T-059 moves. It changes no
application code.

## Acceptance criteria

- [ ] The three template Server Actions have integration tests in the shape of
      T-050's, with its shared helper: `FormData` in, `FormState` out, the rows
      left in the database asserted, every refusal path asserted with nothing
      written, and a second teacher's rows untouched (overview §8.4).
- [ ] The tests cover the copy-on-write paths of overview §3.2: the first
      version of a view, a trim, a second edit of the same day (replace), a new
      version capped by a later one (`capToNextVersion()`), a version changed in
      another window (`VersionChanged`), and a boundary that cannot be
      resolved. They cover too the per-row both-weeks choice T-043 adds
      (ADR-025). Each fixes the clock through the instant `today()` takes,
      never through a date.
- [ ] The tests are written against the actions' public behaviour only, so
      that T-059 can run them unmodified through the adapters it leaves behind.
- [ ] No file outside the new tests changes.

## Notes
