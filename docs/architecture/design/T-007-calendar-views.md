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
must not carry, so what the write path stores is not enough on its own.

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
  events: EventMark[]             ← the events of §6.3 that fall on this date (T-012)
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
  week is not seven days of cancellations;
- **`isTaughtByMe` is stripped from a cancelled lesson.** The override-free
  expansion resolves that flag against the *planned* `OWN` day, while the rule
  (`expand.ts`, fixtures §8.6) is the *resolved* one — the two answers differ in
  exactly the case an override on the teacher's own day creates, so the flag is
  dropped rather than shown wrong. `days.test.ts` pins it.

Reading the `CLEARED` rows directly would need a second copy of «which slot was
in force on this date», which is exactly the rule `expand()` owns.

Cost: two expansions per window, and four for `CLASS` (each expansion resolves
`OWN` as well, for `isTaughtByMe`). §5 below is the measurement.

### 4.2 How each view shows a cancellation

Specification §5.3 asks that the teacher *see* the cancellation, so no view may
render a cancelled lesson as an absence:

| View | What it shows |
|---|---|
| `day`, `week` | the `LessonRow` at its own `lessonNumber`, struck through, «скасовано» |
| `month` | a struck-through line in the cell; on a phone the same `DayLessons` list |
| `year` | the cell counts as a day with something on it (bold) and is underlined in the destructive colour; its tooltip adds «скасовано: N» |

The year cell shows a number and nothing else, so the tooltip is most of what
it can say — `dayTooltip()` in `labels.ts`, pinned by `labels.test.ts`.

## 5. Year-view measurement (overview §9 trigger: ~300 ms)

Node 22.14.0, no database — the numbers are `buildCalendarDays()` plus
`renderToStaticMarkup(<YearView/>)` over a synthetic full academic year
(2026-09-01 … 2027-05-31): 273 days, 7 lessons × 5 weekdays × 2 parities per
template version, three versions per view, 40 overrides, three breaks. That is
1 215 resolved lessons in each view — **the same fixture for both**, and each
view measured in its own process, so the second one does not inherit the first
one's warm JIT. Twenty warm runs per view.

| View | First run | Warm median | Warm max |
|---|---|---|---|
| `OWN` (2 expansions) | 91 ms | 42 ms | 66 ms |
| `CLASS` (4 expansions) | 112 ms | 51 ms | 76 ms |

`CLASS` is the more expensive view, as §4.1's cost model says it must be; the
gap is well under 2× because the day assembly and the React render are shared
and do not double with the expansions.

Well inside the trigger, so nothing in overview §9 fires and no caching is
introduced. The database round trips are excluded — they are eight queries that
do not grow with the range (T-008 §1) — and so is React's serialisation of the
RSC payload. If the trigger is ever reached, the recorded reaction is to cache
`getScheduleInput()` / this expansion, not to change the model.

## 6. What this ticket deliberately leaves out

- **Events (§6.3).** `getEventsInRange()` existed (T-008) and nothing on this
  screen called it: placing a recurring event on its dates is T-012's
  `recurrence.ts`, and a calendar showing one-off events while silently
  dropping repeating ones would mislead. **T-012 has since added them**, as the
  `events` field above and a fourth argument to `buildCalendarDays()` —
  mechanics in `design/T-012-events.md`. The rest of this document describes
  the screen as it still is.
- **Editing.** Read-only by design: templates are T-010, day overrides T-011.
  The `origin` badges and the struck-through cancelled rows are what T-011
  attached its «Змінити» links to (`design/T-011-day-overrides.md`).
- **Birthdays**, second phase (specification §9).

The year view's title says «Навчальний рік» only when an `AcademicYear` covers
the anchor; on the calendar-year fallback it says «Рік», and the quick jump
§6.1 calls «до вересня» is named «На початок року» for a year that does not
begin in September.
