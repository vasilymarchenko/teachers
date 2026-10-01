---
id: T-042
type: ticket
title: Month view — the whole day is one click target, not only its number
status: todo
depends_on: [T-007]
refs:
  - docs/specs/specification.md §6.1
  - docs/architecture/architect-overview.md §10.2
  - docs/architecture/design/T-007-calendar-views.md §4.2
---

## Goal

In the month view a click anywhere on a day opens that day in the day view.
Today only the day number in `MonthCell` and the heading of `MonthDayRow` are
links (`components/calendar/views.tsx`); a click on the lessons, the events
or the empty part of a cell does nothing.

## Acceptance criteria

- [ ] On the grid (`md` and up) a click anywhere inside a day cell — the
      number, a lesson, an event, a non-teaching name, the empty space — goes
      to `calendarHref("day", date, schedule)`. That includes the days spilling
      in from the neighbouring months.
- [ ] On a phone the same holds for the whole `MonthDayRow` card.
- [ ] Each day is one link and one tab stop, with a visible focus ring and a
      hover state on the whole cell; the link's accessible name names the date
      in Ukrainian (weekday, day and month), not the bare number.
- [ ] No interactive element is nested inside the link. The month view holds
      none today (`DayLessons` is rendered without `editing`); if one is ever
      added, the cell switches to a stretched link rather than nesting.
- [ ] The cell keeps everything it shows today: today's ring, the shading of a
      non-teaching day, the reduced opacity of the neighbouring months, the
      struck-through cancelled lessons and done events, and the red overdue
      events.
- [ ] The year view is unchanged: each of its day squares is already a whole
      link.
- [ ] A test pins that a month cell renders exactly one link to the day view.

## Notes
