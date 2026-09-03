---
id: T-021
type: ticket
title: Week view — lesson text overflows the day card from the xl breakpoint
status: todo
depends_on: [T-007]
refs:
  - docs/architecture/architect-overview.md §10.2
  - docs/specs/specification.md §6.1
  - docs/architecture/design/T-007-calendar-views.md
---

## Goal

`WeekView` reaches seven columns at `xl`, which leaves each `DayCard` about
130 px wide. `LessonRow` spends 64 px of that on the fixed `w-16 shrink-0`
number-and-time column and puts no wrapping constraint on the subject name, so
the subject escapes the card and overlaps the neighbouring one. Measured at a
1400 px viewport on the seeded fixture: «Інформатика» +57 px, «Математика»
+52 px, «Алгебра» +22 px past the card's right edge. `MonthCell` does not have
the defect — it truncates with `truncate` — and neither does the day view, where
the card is wide.

## Acceptance criteria

- [ ] No descendant of a `DayCard` renders outside its box in the week view at
      any viewport from 320 px to 2560 px. `document.documentElement.scrollWidth`
      never exceeds `window.innerWidth`, and no element's bounding rect crosses
      its card's.
- [ ] The lesson number and its bell times stay readable — the fix constrains
      the payload side rather than dropping the left column.
- [ ] The subject name stays identifiable at seven columns: wrapped or
      truncated, not clipped mid-glyph, and the full text reachable (a `title`
      is enough, matching what `dayTooltip` already does for the year view).
- [ ] The day view and the phone-width week view are unchanged — `LessonRow` is
      shared, so a fix that narrows it everywhere is not the fix.
- [ ] A test pins the constraint so the next layout change cannot reintroduce
      it.

## Notes

Found by inspection of the running app against the seeded fixture, after T-007
merged; the ticket's own criteria are about content, not overflow, which is why
its review did not catch this. The overflow is CSS-only — no query, no domain
code and no data is involved.
