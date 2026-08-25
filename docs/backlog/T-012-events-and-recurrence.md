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
- [ ] All UI text in Ukrainian.

## Notes

T-007 renders whatever the event query returns for a range; expanding a
recurring INFO event into that range is this ticket's job.
