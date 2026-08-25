---
id: T-010
type: ticket
title: Weekly template editor with copy-on-write versioning
status: blocked
depends_on: [T-005, T-008, T-014, Q-002]
refs:
  - docs/architecture/architect-overview.md §3.2
  - docs/architecture/architect-overview.md §3.3
  - docs/specs/specification.md §5.1
  - docs/specs/specification.md §5.2
---

## Goal

Let the teacher edit the weekly `ScheduleTemplate` for both views without ever
rewriting the past — the UI where invariants I1 and I2 are either honoured or
silently broken.

## Acceptance criteria

- [ ] Grid of `weekday` × `lessonNumber` × `parity` per `view`, with the OWN
      field set (subject, className) and the CLASS field set (subject,
      teacherName, zoomLink, note) kept separate (overview §3.3).
- [ ] Saving an edit calls the T-005 copy-on-write helper: the current version
      is cut at `today()` and a new version carries the change (I1). No code
      path updates a live version's slots in place.
- [ ] Creating a version truncates the previous one (I2) and the UI shows the
      warning that the earlier schedule now ends on that date instead of its
      original `validTo`.
- [ ] Backdated editing is not offered at all; the UI points the teacher at a
      `DayOverride` for a past date instead (specification §5.3).
- [ ] "Copy from NUMERATOR to DENOMINATOR" per view, per specification §5.1.
- [ ] A version's `validTo` is entered symbolically and stored resolved
      (overview §8.1).
- [ ] The overlap constraint from T-004 is never hit in normal use; a test
      covers the concurrent-save case that would hit it.
- [ ] Usable on a 390 px viewport following the pattern Q-002 settles — this is
      the screen §10.2 names as structurally dependent on that answer.
- [ ] All UI text in Ukrainian.

## Notes

Blocked on Q-002. Overview §10.2 states this editor is the reason the question
must close before UI work starts: adapting a desktop table afterwards means
rewriting it, not adding CSS.
