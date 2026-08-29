---
id: T-012
type: ticket
title: Events — deadlines, info events and recurrence expansion
status: todo
depends_on: [T-005, T-008, T-014]
refs:
  - docs/architecture/architect-overview.md §2
  - docs/architecture/architect-overview.md §4
  - docs/architecture/architect-overview.md §8.1
  - docs/specs/specification.md §6.3
---

## Goal

Implement `Event` end to end: `lib/domain/events/recurrence.ts` plus the forms
that create both kinds, so the calendar has events to render.

## Acceptance criteria

- [ ] `recurrence.ts` turns a repeating INFO event into concrete dates over a
      range; pure, no database, Vitest-covered.
- [ ] The recurrence boundary is entered symbolically and stored resolved
      (overview §8.1), reusing `boundaries.ts` from T-005.
- [ ] DEADLINE events are one-off and carry `done`; the UI offers no
      repetition for them (overview §4, deliberate).
- [ ] Marking a deadline done and undone from the calendar.
- [ ] CRUD forms for both kinds, one Zod schema each, shared client and server.
- [ ] The calendar views show events on their dates, overdue deadlines marked
      (specification §6.3) — the half of T-007's first criterion T-007 left open.
- [ ] All UI text in Ukrainian.

## Notes

Expanding a recurring INFO event into a range is this ticket's job, and so is
putting events on the calendar: T-007 built the four views without them
deliberately, because a calendar that showed one-off events while silently
dropping repeating ones would mislead. `getEventsInRange()` (T-008) is written
and unused; the day components consume `CalendarDay`
(`docs/architecture/design/T-007-calendar-views.md` §4), which is where the
markers attach. T-007 stays `in-progress` until this ticket closes that
criterion.
