# Calendar read views

**Ticket:** `docs/backlog/T-007-calendar-read-views.md`
**Status:** authoritative for T-007.

Rationale lives in `docs/architecture/architect-overview.md` §5, §8.5, §9 and
§10.2. This document adds no reasoning: it states the mechanics — the URL the
screen is addressed by, the range each view expands, the type the components
consume, and how a cancelled lesson is recovered from an expansion that
deliberately drops it.

---

## 1. Modules

| File | Exports |
|---|---|
| `lib/domain/calendar/views.ts` | `CalendarViewName`, `CALENDAR_VIEWS`, `isCalendarViewName()`, `rangeFor()`, `stepBy()`, `isInMonthOf()` |
| `lib/domain/calendar/days.ts` | `CalendarDay`, `NamedNonTeachingPeriod`, `buildCalendarDays()` |
| `lib/domain/schedule/dates.ts` | gains `isIsoDate()`, `isoDaysBetween()`, `startOfIsoWeekOn()`, `endOfIsoWeekOn()`, `startOfMonthOn()`, `endOfMonthOn()`, `addIsoDays()`, `addIsoWeeks()`, `addIsoMonths()`, `addIsoYears()`, `yearOf()` |
| `components/calendar/links.ts` | `calendarHref()`, `scheduleViewOf()`, `CLASS_SEARCH_VALUE` |
| `components/calendar/labels.ts` | every Ukrainian string and every date format the calendar shows |
| `components/calendar/lesson-row.tsx` | `LessonRow` |
| `components/calendar/day-lessons.tsx` | `DayLessons` — the day-centric unit of overview §10.2 |
| `components/calendar/day-card.tsx` | `DayCard` — `DayLessons` with a heading, parity and the today ring |
| `components/calendar/views.tsx` | `DayView`, `WeekView`, `MonthView`, `YearView` |
| `components/calendar/calendar-nav.tsx` | `CalendarNav` — view switch, ← →, «Сьогодні», quick jumps, `OWN`/`CLASS` |
| `app/(app)/(calendar)/calendar/page.tsx` | redirect to today's day view |
| `app/(app)/(calendar)/calendar/[view]/[date]/page.tsx` | the screen |

Every component is server-rendered and stateless; the only client components on
the screen are the shell's own (T-014). With JavaScript off the calendar
navigates, because every control is a `<Link>`.

## 2. URL

```
/calendar                       → redirect to /calendar/day/<today()>
/calendar/<view>/<date>         view ∈ {day, week, month, year}, date = YYYY-MM-DD
/calendar/<view>/<date>?schedule=class
```

`date` is the **anchor**, not the range: the view derives the range from it. A
segment that is not a view name, or not a real date (`2026-02-30`), is
`notFound()` — never a silent fallback to today, which would show a day the
teacher did not ask for. `?schedule=class` selects `CLASS`; anything else,
absent included, is `OWN`.

Read order on the page: `requireUser()` first (overview §8.3), then the three
reads. Only the year view's range depends on `getYearFrame()`, so the other
three views await it alongside `getScheduleInput()` and `getNonTeachingPeriods()`
rather than before them.

`zoomLink` renders as an `<a href>` only when it starts with `http://` or
`https://`; anything else is shown as text. `z.url()` accepts schemes an `href`
must not carry, and the write path (T-010, T-011) does not exist yet.

## 3. Ranges — `rangeFor(view, date, yearRange?)`

Both ends inclusive, as everywhere in the domain (schema §6).

| View | Range |
|---|---|
| `day` | `[date, date]` |
| `week` | the ISO week of `date`, Monday → Sunday (overview §8.5) |
| `month` | the whole ISO weeks the month spans: `startOfISOWeek(firstOfMonth)` → `endOfISOWeek(lastOfMonth)` |
| `year` | `yearRange` when `getYearFrame()` found an `AcademicYear`; otherwise `[YYYY-01-01, YYYY-12-31]` |

The month view is padded so the grid is a rectangle; the padding days are real
`CalendarDay`s (`isInMonthOf()` dims them). The year fallback exists because an
August date before the year setup of T-009 has no frame, and the screen still
has to render.

`stepBy(view, date, ±1)` moves the anchor by the view's own period — day, ISO
week, month (clamped: 31 March − 1 month = 28 February), calendar year.

## 4. `CalendarDay`

```
CalendarDay = ResolvedDay & {
  cancelled: ResolvedLesson[]     ← lessons a CLEARED override took off this date
  nonTeachingName?: string        ← the NonTeachingPeriod that shades the day
}
```

The rendering-level merge, made once in the domain for the same reason
`ResolvedLesson` is (overview §5). `nonTeachingName` is absent when the day is
non-teaching by a `NonTeachingWeekdayRule` — a weekday has no name — and when
two periods cover the date the **shorter** one is named (a `PUBLIC_HOLIDAY`
inside a `BREAK`).

### 4.1 Where `cancelled` comes from

`expand()` deletes a `CLEARED` lesson and must keep doing so:
`expand-fixtures.md` §8.8 pins that a tombstone with no slot under it produces
no lesson at all. Specification §5.3 nevertheless wants the teacher to see that
the lesson was cancelled rather than to find a shorter day.

`buildCalendarDays()` therefore expands the window **twice** — once as it
stands, once with `overrides: []` — and takes the difference by `lessonNumber`:

- a number the override-free expansion holds and the real one does not is a
  cancelled lesson, and the second expansion carries its planned payload and
  bell times, which is what renders struck through;
- `EDIT` and `SUBSTITUTION` keep their number, so neither appears in the
  difference;
- a tombstone over an absent slot is in neither expansion, so it produces
  nothing (fixture O8, 2026-11-12);
- a non-teaching date has no template lessons in either expansion, so a break
  week is not seven days of cancellations.

Reading the `CLEARED` rows directly would need a second copy of «which slot was
in force on this date», which is exactly the rule `expand()` owns.

Cost: two expansions per window, and four for `CLASS` (each expansion resolves
`OWN` as well, for `isTaughtByMe`). §5 below is the measurement.

## 5. Year-view measurement (overview §9 trigger: ~300 ms)

Node 22.22.2, no database — the numbers are `buildCalendarDays()` plus
`renderToStaticMarkup(<YearView/>)` over a synthetic full academic year
(2026-09-01 … 2027-05-31): 273 days, 7 lessons × 5 weekdays × 2 parities per
template version, three versions per view, 40 overrides, three breaks. That is
~1 210 resolved lessons per view.

| View | First run | Warm median | Warm max |
|---|---|---|---|
| `OWN` (2 expansions) | 64 ms | 28 ms | 44 ms |
| `CLASS` (4 expansions) | 31 ms | 18 ms | 29 ms |

Well inside the trigger, so nothing in overview §9 fires and no caching is
introduced. The database round trips are excluded — they are eight queries that
do not grow with the range (T-008 §1) — and so is React's serialisation of the
RSC payload. If the trigger is ever reached, the recorded reaction is to cache
`getScheduleInput()` / this expansion, not to change the model.

## 6. What this ticket deliberately leaves out

- **Events (§6.3).** `getEventsInRange()` exists (T-008) but nothing on this
  screen calls it: placing a recurring event on its dates is T-012's
  `recurrence.ts`, and a calendar showing one-off events while silently
  dropping repeating ones would mislead. T-012 adds the markers; the day
  components take a `CalendarDay`, so events arrive as one more field on it.
- **Editing.** Read-only by design: templates are T-010, day overrides T-011.
  The `origin` badges and the struck-through cancelled rows are what T-011 will
  attach its actions to.
- **Birthdays**, second phase (specification §9).

The year view's title says «Навчальний рік» only when an `AcademicYear` covers
the anchor; on the calendar-year fallback it says «Рік», and the quick jump
§6.1 calls «до вересня» is named «На початок року» for a year that does not
begin in September.
