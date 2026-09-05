# Events — deadlines, information events and recurrence

**Ticket:** `docs/backlog/T-012-events-and-recurrence.md`
**Status:** authoritative for T-012.

Rationale lives in `docs/architecture/architect-overview.md` §4, §5 and §8.1,
and in `decisions/ADR-009-recurrence-skips-a-date-that-does-not-exist.md`. This
document adds no reasoning: it states the mechanics — the modules and their
signatures, where the boundary is resolved, what the calendar renders, and the
worked cases the tests are checked against.

---

## 1. Modules

| File | Exports |
|---|---|
| `lib/domain/events/recurrence.ts` | `RecurrenceInput`, `occurrencesInRange()` |
| `lib/domain/events/marks.ts` | `EventInput`, `EventMark`, `eventMarksByDate()` |
| `lib/domain/calendar/days.ts` | `CalendarDay` gains `events`; `buildCalendarDays()` gains a fourth argument |
| `lib/db/queries/events.ts` | gains `EventEditRow`, `listEvents()` |
| `lib/validation/event.ts` | `deadlineInput`, `infoEventInput`, `EVENT_FIELD`, `readDeadline()`, `readInfoEvent()` |
| `lib/actions/events.ts` | `createDeadlineAction()`, `updateDeadlineAction()`, `createInfoEventAction()`, `updateInfoEventAction()`, `setEventDoneAction()`, `deleteEventAction()` |
| `lib/actions/eventsShared.ts` | the paths and messages the actions share; constants only, no `"use server"` |
| `components/events/labels.ts` | every Ukrainian string of the events screen, and `eventSchedule()` |
| `components/events/event-form.tsx` | `DeadlineForm`, `InfoEventForm` |
| `components/events/events-list.tsx` | `EventsList` — one section per kind |
| `components/calendar/event-marks.tsx` | `EventMarks` — the events of one day |
| `components/calendar/event-done-toggle.tsx` | `EventDoneToggle` |
| `app/(app)/(events)/events/page.tsx` | the screen (it was a placeholder) |

## 2. `occurrencesInRange(event, range)`

Takes the columns `getEventsInRange()` selects, answers with the dates the event
falls on inside the window, both ends inclusive, in order. Pure: no database, no
clock.

```
NONE     → every date of [dateFrom, dateTo ?? dateFrom] ∩ range
WEEKLY   → dateFrom + 7n
MONTHLY  → the same day-of-month, each month
YEARLY   → the same month and day, each year
```

A repeating event occurs while `date < boundaryDate` — the exclusive form every
boundary in the schema has (overview §8.1) — so the last day it can fall on is
`boundaryDate - 1 day`. A `MONTHLY` or `YEARLY` candidate that is not a real
date produces nothing (ADR-009): a candidate is built as a string and accepted
only if `isIsoDate()` accepts it, and it is never obtained by stepping the
previous occurrence with `addIsoMonths()` / `addIsoYears()`, which clamp. The
monthly loop does step a cursor with `addIsoMonths()`, and may: the cursor is
the first of a month, a day every month has, so no candidate can be clamped.

A recurring row with no `boundaryDate` — a shape `event_recurrence_ck` forbids —
expands to nothing rather than to an unbounded series.

## 3. `eventMarksByDate(events, range, today)`

Groups the expansions into a `Map<IsoDate, EventMark[]>`, which is what
`buildCalendarDays()` takes as its fourth argument and hangs on each
`CalendarDay.events` (empty, never absent).

```
EventMark = { id, kind, title, note, done, isOverdue }
```

`isOverdue` is `kind = DEADLINE ∧ done ≠ true ∧ date < today`. Strictly before
today: a deadline due today is due, not late. `today` is a parameter — the
domain has no clock (overview §8.5) and the calendar page reads it once.

The order inside a date is the order the rows arrive in, which
`getEventsInRange()` fixes as `date_from`, then `title`.

## 4. Worked cases

The fixture year of `expand-fixtures.md` §3 — 2026-09-01 … 2027-05-31, autumn
break opening 2026-10-26. Every value below is derived here and is what
`recurrence.test.ts` and `marks.test.ts` assert; none of it was obtained by
running the code.

| # | Event | Window | Occurrences |
|---|---|---|---|
| W1 | `WEEKLY` from 2026-09-04 (Friday), boundary 2026-10-26 | October | 10-02, 10-09, 10-16, 10-23 |
| B1 | the same, boundary 2026-09-18 | the year | 09-04, 09-11 — the 18th is excluded, the boundary is exclusive |
| M1 | `MONTHLY` from 2026-10-31, boundary 2027-06-01 | the year | 10-31, 12-31, 01-31, 03-31, 05-31 — November, February and April have no 31st |
| Y1 | `YEARLY` from 2024-02-29, boundary 2029-01-01 | 2024-01-01 … 2028-12-31 | 2024-02-29, 2028-02-29 |
| Y2 | `YEARLY` from 2026-09-13 («День золотої рибки»), boundary 2030-01-01 | the year | 2026-09-13 |
| N1 | one-off 2026-10-26 … 2026-11-01 | October | 10-26 … 10-31, clipped by the window |
| N2 | one-off 2026-11-14 | October | none |

Overdue, against `today` = 2026-10-19:

| Deadline | `done` | `isOverdue` |
|---|---|---|
| 2026-10-15 | `false` | yes |
| 2026-10-15 | `true` | no |
| 2026-10-19 | `false` | no — due today is not late |
| 2026-10-22 | `false` | no |
| any `INFO` event | — | no |

## 5. The two forms

One Zod schema per kind, not one schema with a `kind` field: a `DEADLINE` has no
repetition to offer (overview §4, `event_deadline_shape_ck`), and the form that
cannot show one is a stronger statement than a rule inside a shared schema.

| Field | `deadlineInput` | `infoEventInput` |
|---|---|---|
| `title`, `note` | yes | yes |
| `dateFrom` | the due date | the day it happens |
| `dateTo` | — | optional, inclusive; refused together with a repetition |
| `recurrenceKind` | — | `NONE` \| `WEEKLY` \| `MONTHLY` \| `YEARLY` |
| `boundaryKind`, `lastDay` | — | required exactly when it repeats |

`done` is in neither. A new deadline is written `done: false`, and the column is
changed by `setEventDoneAction()` alone, so saving an edit to a title cannot
reset it.

The two shape rules the schemas carry are the table's own checks said in
Ukrainian, so the teacher meets them as a sentence and not as a refused save:
a repeating event may not span days (`event_recurring_span_ck`) and a repetition
must have an end (`event_recurrence_ck`).

## 6. Where the boundary is resolved

In `lib/actions/events.ts`, at write time, by `resolveBoundary()` — the same
function the weekday rules use (overview §8.1). The **reference date is the
event's own `dateFrom`**, not `today()`: «щотижня до найближчих канікул» on an
event entered in August for September means the break after the event.

- `DATE` — resolves against `lastDay` alone; no year needed.
- `NEXT_BREAK`, `END_OF_SEMESTER` — resolve against the `AcademicYear` covering
  `dateFrom` (`getYearFrame()`), its `BREAK` periods and its semesters.

An event dated outside every year the teacher has set up cannot resolve a
symbol, because `event` has no `academic_year_id` and the screen deliberately
does not confine an event to a year. That is answered on the `boundaryKind`
field with `NO_YEAR_FOR_THE_DATE`, never by inventing a date.

Both actions write `boundaryDate` **and** `boundaryKind` on every save,
`null` included: an event that stops repeating has to lose both, or
`event_recurrence_ck` refuses the half-changed row.

## 7. What the calendar shows

| View | Events |
|---|---|
| `day`, `week` | a list under the lessons; a deadline carries the «виконано» toggle |
| `month` | a line per event in the cell; the phone list uses the same `DayLessons` |
| `year` | the cell counts as a day with something on it, an overdue deadline colours it, and `dayTooltip()` names the counts |

A deadline that is done is struck through; one that is overdue is in the
destructive colour and says «прострочено» (specification §6.3). The toggle is
offered in the day and week views only — the two views ADR-008 edits from; a
month or year cell opens the day instead.

## 8. What this ticket deliberately leaves out

- **Events on the printed page.** `/print` is T-013's route and does not exist
  yet; it consumes the same `CalendarDay`, so it inherits the events when it is
  written.
- **Demo events in the seed.** The fixture scenario (`expand-fixtures.md` §3)
  has no events and is not extended here, so every fixture expectation in the
  schedule suites keeps its meaning.
- **Repeating deadlines** — refused by the model (overview §4), trigger recorded
  in §9.
- **Reminders by mail or messenger** — specification §6.3 puts them outside the
  first release.
