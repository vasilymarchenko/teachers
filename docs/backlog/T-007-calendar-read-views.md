---
id: T-007
type: ticket
title: Calendar read views — day, week, month, year
status: done
depends_on: [T-005, T-008, T-014]
refs:
  - docs/architecture/architect-overview.md §5
  - docs/specs/specification.md §6
  - docs/architecture/design/T-007-calendar-views.md
---

## Goal

Render the four calendar views over `ResolvedDay[]`, with the `OWN` / `CLASS`
switch. Read-only: no editing of templates or overrides in this ticket.

## Acceptance criteria

- [x] Day, week, month and year views, each a different date range passed to the
      same `expand()` call.
- [x] `OWN` / `CLASS` switch per specification §6.2, with `isTaughtByMe` marked
      on the `CLASS` side.
- [x] Week starts on Monday everywhere (overview §8.5).
- [x] `SUBSTITUTION` shows `replacedOriginal` alongside the new lesson;
      `CLEARED` renders as a cancelled lesson, distinct from an empty slot.
- [x] Non-teaching days are visually distinct and name their
      `NonTeachingPeriod`.
- [x] All UI text in Ukrainian (root `CLAUDE.md`).
- [x] Views are usable on a 390 px viewport, following the day-centric flow of
      overview §10.2.
- [x] Year-view render time measured and recorded, against the ~300 ms trigger
      in overview §9.

## Notes

Q-002 is answered — the day-centric flow of `architect-overview.md` §10.2 — and
the data path is `getScheduleInput()` (T-008). The shell the views render into
is T-014, now done, so nothing blocks this ticket. Read-only by design: writing
is T-010 (templates) and T-011 (day overrides).

The year-view render measurement is a number recorded in the PR body and in
these notes when the work is done — not a committed benchmark.

**Done in this ticket.** Mechanics: `docs/architecture/design/T-007-calendar-views.md`.
The screen is `/calendar/<view>/<date>` (`?schedule=class` for the `CLASS`
side); `CalendarDay` (overview §5, glossary §7) is what the components consume.

**Measurement.** A full academic year (273 days, 1 215 resolved lessons per
view), `buildCalendarDays()` plus `renderToStaticMarkup(<YearView/>)` on Node
22.14.0, without a database: `OWN` 91 ms first run and 42 ms warm median,
`CLASS` 112 ms / 51 ms. One fixture for both views, each measured in its own
process, so `CLASS` — the more expensive view, as it must be — is not flattered
by the warm-up of the run before it. The ~300 ms trigger of overview §9 does not
fire, so no caching was added. Database round trips are excluded — no Postgres was available
in the environment the work was done in, which is also why the integration suite
did not run there. It has since been run against a migrated, seeded database:
33 tests, all passing.

**Events are not this ticket's.** The first criterion originally also required an
`Event` query over the range. `getEventsInRange()` (T-008) was left uncalled by
this screen: placing a recurring `Event` on its dates is T-012's `recurrence.ts`,
and showing one-off events while silently dropping repeating ones would mislead
rather than help. The day components take a `CalendarDay`, so the markers
attached to that type when T-012 landed — which it has, `design/T-007-calendar-views.md` §4.

The criterion was therefore dropped from here rather than left unchecked. It was
being carried by both tickets at once — T-012's own list has owned it verbatim
since it was written — and a fact stated twice is the one that rots
(`docs/backlog/CLAUDE.md`). Keeping this ticket open on it also read, through
`depends_on`, as if T-011, T-013 and T-021 were waiting on events, which they
are not. T-012 is the single owner.
