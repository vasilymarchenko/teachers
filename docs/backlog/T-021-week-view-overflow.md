---
id: T-021
type: ticket
title: Week view — lesson text overflows the day card once the grid column is narrow
status: done
depends_on: [T-007]
refs:
  - docs/architecture/architect-overview.md §10.2
  - docs/specs/specification.md §6.1
  - docs/architecture/design/T-007-calendar-views.md
  - docs/architecture/decisions/ADR-013-row-reflows-against-its-container.md
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

- [x] No descendant of a `DayCard` renders outside its box in the week view at
      any viewport from 320 px to 2560 px. `document.documentElement.scrollWidth`
      never exceeds `window.innerWidth`, and no element's bounding rect crosses
      its card's.
      — `components/calendar/lessonRowLayout.ts` and
      `components/calendar/event-marks.tsx:46`; measured in a headless Chromium
      over the real components at 21 viewports, with unbreakable 40-character
      event titles and a non-teaching name, and against the pre-fix code, which
      the same harness reports 69 px outside the card at 1400 px.
- [x] The lesson number and its bell times stay readable — the fix constrains
      the payload side rather than dropping the left column.
      — `lessonRowLayout.ts` keeps `w-16` in the wide form and reflows it;
      `lessonRowLayout.test.ts` «keeps the number and its bell times».
- [x] The subject name stays identifiable at seven columns: wrapped or
      truncated, not clipped mid-glyph, and the full text reachable (a `title`
      is enough, matching what `dayTooltip` already does for the year view).
      — wrapped at the card's full width, never clipped, so the whole name is on
      the screen; `lessonRowLayout.ts:subject` and `lesson-row.tsx:148`. Why no
      `title`: `## Notes`.
- [x] The day view and the phone-width week view are unchanged — `LessonRow` is
      shared, so a fix that narrows it everywhere is not the fix.
      — both are containers above the `14rem` threshold; the day view was
      rendered before and after and compared in the browser, every row and
      column identical to the pixel at 320, 390, 768, 1024, 1280, 1400 and
      1920 px.
- [x] A test pins the constraint so the next layout change cannot reintroduce
      it.
      — `components/calendar/lessonRowLayout.test.ts`, 12 cases; it fails when a
      renderer drops the container and when a new, unstaged renderer omits it.

## Notes

Found by inspection of the running app against the seeded fixture, after T-007
merged; the ticket's own criteria are about content, not overflow, which is why
its review did not catch this. The overflow is CSS-only — no query, no domain
code and no data is involved.

**Decisions taken while doing the work** — the reasoning is in ADR-013
(`refs:`), not here:

- the row reflows against its container, not the viewport, and the threshold
  with every class is `components/calendar/lessonRowLayout.ts`; the constraint
  is pinned by `components/calendar/lessonRowLayout.test.ts`;
- criterion 3 offers a `title` as the way to reach the full subject name. There
  is none: the name wraps at the card's full width and is never clipped, so the
  whole of it is on the screen, and a `title` repeating visible text becomes the
  element's accessible description and has every row read out twice. The test
  pins the absence;
- the defect starts at `lg` (four columns, 135 px of card content), not at `xl`
  as the title said when the ticket was filed. Retitled, mirrored in
  `README.md` in the same commit.

Commits: `ce652d9` the fix, `6510a4f` the review fixes (the day box owns the
wrapping rule the events and the non-teaching name inherit; every renderer of
the row opens the container, the lesson editor of T-011 included; the two bell
times are one wrap item).
