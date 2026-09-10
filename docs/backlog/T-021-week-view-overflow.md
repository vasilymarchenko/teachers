---
id: T-021
type: ticket
title: Week view — lesson text overflows the day card once the grid column is narrow
status: in-progress
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

**T-021.** The row now reflows against its container rather than the viewport:
`DayLessons` opens an `@container` and `LessonRow` switches below `14rem`, with
the threshold and every class in `components/calendar/lessonRowLayout.ts`. Why a
container query and not a breakpoint, a prop, a smaller left column or a browser
test — `docs/architecture/decisions/ADR-013-row-reflows-against-its-container.md`;
the constraint is pinned by `components/calendar/lessonRowLayout.test.ts`.

Measurement while implementing found the overflow starts at `lg` (four columns,
135 px of card content) and not at `xl`, which is what the title said when the
ticket was filed — «Інформатика» is 38 px over the card's edge there. The title
now names the narrow column rather than a breakpoint, mirrored in `README.md`
in the same commit; the fix covers both widths anyway, because what it keys on
is the card.

The review of the first implementation added three things it had missed: the
wrapping rule belongs on the day box, where the event titles and the name of a
non-teaching period inherit it, and not on the lesson row alone; the lesson
editor of T-011 renders a `LessonRow` too and had no container, so the test now
walks every file that renders one; and the two bell times have to stay together
as a single wrap item, or the range breaks with its dash hanging off a line.
