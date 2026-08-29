---
id: T-005
type: ticket
title: Schedule domain — today, parity, calendar rules, boundaries, expand
status: done
depends_on: [T-001, T-002]
refs:
  - docs/architecture/architect-overview.md §2
  - docs/architecture/architect-overview.md §3
  - docs/architecture/architect-overview.md §5
  - docs/architecture/architect-overview.md §8.5
  - docs/architecture/design/expand-fixtures.md
  - docs/architecture/design/T-005-schedule-domain.md
---

## Goal

Implement `lib/domain/schedule` as pure functions with no database and no Next.js
imports, tested against the T-001 fixtures. This is the highest-risk logic in the
product and it is fully testable before any UI exists.

## Acceptance criteria

- [x] `lib/time/today.ts` returns the current date in `Europe/Kyiv`; no
      `new Date()` anywhere else in domain code (overview §8.5). Landed in
      T-002 — the scaffold needed it — and is covered by
      `lib/time/today.test.ts`. What remains here is the second half: keeping
      `new Date()` out of the rest of the domain as it is written.
- [x] `parity.ts` implements the formula in overview §3.5, ISO weeks, Monday
      start; the break-week default (Q-001) lives here and nowhere else.
- [x] `calendarRules.ts` answers "is this date non-teaching", covering both
      `NonTeachingPeriod` and `NonTeachingWeekdayRule`.
- [x] `boundaries.ts` resolves `NEXT_BREAK` / `END_OF_SEMESTER` to a date at
      write time (overview §8.1).
- [x] `types.ts` exports `ResolvedLesson` and `ResolvedDay` as defined in
      overview §5.
- [x] `expand.ts` implements the algorithm in overview §3.1 for a date range and
      one `view`. It reads `DayOverride` rows for non-teaching dates too — a
      non-teaching date is not a short circuit (overview §3.4, fixtures §8.7).
- [x] `replacedOriginal` is omitted when no `TemplateSlot` is in force under a
      `SUBSTITUTION`, and a `CLEARED` with no slot under it is a no-op
      (overview §3.4, fixtures §8.8).
- [x] Vitest suite reproduces every expected value from the T-001 fixture
      document; no expectation in the suite was obtained by running the code
      first.
- [x] Copy-on-write helper for template edits cuts at `today()`, never at a
      caller-supplied date (overview §3.2, I1).

## Notes

Mechanics — module signatures, the `ScheduleInput` contract T-008 builds, and
the copy-on-write cases T-010 calls — are in
`docs/architecture/design/T-005-schedule-domain.md`. Six decisions the overview
and the fixtures left open are recorded there as D-1 … D-6; the two that a
reader is most likely to trip over are that a `DATE` boundary is the teacher's
inclusive last day plus one (D-1), and that a lesson number with no
`BellSchedule` row keeps no time keys (D-5).

`architect-overview.md` §2 gained `copyOnWrite.ts` and `dates.ts` in the
`domain/schedule/` tree; `glossary.md` §7 gained `ScheduleInput` and `IsoDate`
as code-level terms. No decision in either document changed.

