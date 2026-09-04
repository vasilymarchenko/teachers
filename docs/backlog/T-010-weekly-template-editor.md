---
id: T-010
type: ticket
title: Weekly template editor with copy-on-write versioning
status: done
depends_on: [T-005, T-008, T-014]
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

- [x] Grid of `weekday` × `lessonNumber` × `parity` per `view`, with the OWN
      field set (subject, className) and the CLASS field set (subject,
      teacherName, zoomLink, note) kept separate (overview §3.3).
- [x] Saving an edit calls the T-005 copy-on-write helper: the current version
      is cut at `today()` and a new version carries the change (I1). No code
      path updates a live version's slots in place.
- [x] Creating a version truncates the previous one (I2) and the UI shows the
      warning that the earlier schedule now ends on that date instead of its
      original `validTo`.
- [x] Backdated editing is not offered at all; the UI points the teacher at a
      `DayOverride` for a past date instead (specification §5.3).
- [x] "Copy from NUMERATOR to DENOMINATOR" per view, per specification §5.1.
- [x] A version's `validTo` is entered symbolically and stored resolved
      (overview §8.1).
- [x] The overlap constraint from T-004 is never hit in normal use; a test
      covers the concurrent-save case that would hit it.
- [x] Usable on a 390 px viewport following the day-centric flow Q-002 settled
      on (overview §10.2): one day at a time below the tablet breakpoint, the
      whole week above it. The week is all seven weekdays, and its rows are the
      `BellSchedule` numbers plus any number that already has a slot — not the
      6 × 10 table §10.2 first sketched; see `## Notes`.
- [x] All UI text in Ukrainian.

## Notes

Q-002 is answered — the day-centric flow of overview §10.2. This editor was the
reason it had to close first: adapting a desktop table afterwards means
rewriting it, not adding CSS.

The day is the unit of saving and every write — including the boundary — goes
through `planTemplateEdit()`: `decisions/ADR-006-template-day-is-the-save-unit.md`.
Mechanics: `docs/architecture/design/T-010-weekly-template-editor.md`.

Decisions taken while doing the work, each recorded where it belongs rather than
here:

- a new version stops where a later one starts (`capToNextVersion()`), so that
  «до кінця семестру» over an existing future version is a schedule and not an
  I3 refusal — overview §3.2;
- all seven weekdays are editable, and the `CLASS` week wraps instead of forming
  a seven-column table — overview §10.2, which said six days and a table;
- the rows of the grid are the `BellSchedule` numbers plus any number that
  already has a slot, with gaps in the numbering kept — design §5. A screen
  mechanic, not a change to the model, so it is not in the overview.
