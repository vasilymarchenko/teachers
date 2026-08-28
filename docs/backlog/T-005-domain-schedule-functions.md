---
id: T-005
type: ticket
title: Schedule domain — today, parity, calendar rules, boundaries, expand
status: todo
depends_on: [T-001, T-002]
refs:
  - docs/architecture/architect-overview.md §2
  - docs/architecture/architect-overview.md §3
  - docs/architecture/architect-overview.md §5
  - docs/architecture/architect-overview.md §8.5
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
- [ ] `parity.ts` implements the formula in overview §3.5, ISO weeks, Monday
      start; the break-week default (Q-001) lives here and nowhere else.
- [ ] `calendarRules.ts` answers "is this date non-teaching", covering both
      `NonTeachingPeriod` and `NonTeachingWeekdayRule`.
- [ ] `boundaries.ts` resolves `NEXT_BREAK` / `END_OF_SEMESTER` to a date at
      write time (overview §8.1).
- [ ] `types.ts` exports `ResolvedLesson` and `ResolvedDay` as defined in
      overview §5.
- [ ] `expand.ts` implements the algorithm in overview §3.1 for a date range and
      one `view`. It reads `DayOverride` rows for non-teaching dates too — a
      non-teaching date is not a short circuit (overview §3.4, fixtures §8.7).
- [ ] `replacedOriginal` is omitted when no `TemplateSlot` is in force under a
      `SUBSTITUTION`, and a `CLEARED` with no slot under it is a no-op
      (overview §3.4, fixtures §8.8).
- [ ] Vitest suite reproduces every expected value from the T-001 fixture
      document; no expectation in the suite was obtained by running the code
      first.
- [ ] Copy-on-write helper for template edits cuts at `today()`, never at a
      caller-supplied date (overview §3.2, I1).

## Notes
