---
id: T-062
type: ticket
title: Bell schedule from a date — a set of bell times takes effect on its start date, and past lessons keep their times
status: todo
depends_on: [T-057]
refs:
  - docs/architecture/architect-overview.md §9
  - docs/architecture/architect-overview.md §3.5
  - docs/architecture/architect-overview.md §8.5
  - docs/architecture/design/schema.md §4.5
  - docs/specs/specification.md §3.3
  - docs/specs/specification.md §5.2
---

## Goal

Today a change to the bell times changes the times of every lesson the
calendar shows, past ones included, because `BellSchedule` has no start date.
This ticket takes the reaction overview §9 records for that trade-off
(«`BellSchedule` без дати початку дії»). A set of bell times takes effect from
a date, `expand()` uses the set in force on each date, and the bell schedule
form asks from when the new times apply. It also lets a timetable imported
with a future start (T-053) bring its bell times along.

## Acceptance criteria

- [ ] `BellSchedule` rows carry `validFrom`. A set of rows is in force from its
      `validFrom` until the next set's, as `ParityAnchor` is (overview §3.5).
      The unique constraint becomes one row per lesson number per set. The
      migration makes the existing rows the teacher's first set, without
      recomputing any time, with a `validFrom` no later than any date the
      calendar can show for that teacher.
- [ ] `expand()` takes the set in force on each date. A fixture case in
      `design/expand-fixtures.md` changes the bells mid-week, and each day
      shows its own set's times.
- [ ] The bell schedule form has «діє з», defaulting to today and never
      earlier than today, checked at write time against `lib/time/today.ts`. A
      set saved from the same date as an existing one replaces it. The form
      shows the set in force today and, where one lies ahead, the planned set
      with its date.
- [ ] Every other reader of `BellSchedule` (the template editor, the day form,
      the print views) shows the set in force on the date it shows. The year
      setup condition «`BellSchedule` has at least one lesson number» still
      holds and still sends a teacher with no set to `/year`.
- [ ] The T-057 bell schedule command takes `validFrom`. T-050's bell schedule
      tests change only where the behaviour changes by design, and the
      ticket's PR names each test it changes.
- [ ] If T-053 is built, its confirmation with a future start writes the
      file's bell times as a set from the version's start date, in the same
      transaction, instead of only listing the difference. If T-053 is not
      built, its bell criterion is rewritten to say this.
- [ ] An ADR records the dated bell schedule. Overview §9 removes the
      trade-off or marks it as taken, and overview §4 and §8.5 state
      `BellSchedule` as it now is. `design/schema.md` §4.5 and finding F-2 are
      updated. `glossary.md` states «діє з» for the bell schedule.
      `specification.md` §3.3 states that new bell times apply from a chosen
      date and that past lessons keep their times.

## Notes
