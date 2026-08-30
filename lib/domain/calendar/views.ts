import type { IsoDate } from "@/lib/time/today";
import {
  addIsoDays,
  addIsoMonths,
  addIsoWeeks,
  addIsoYears,
  endOfIsoWeekOn,
  endOfMonthOn,
  startOfIsoWeekOn,
  startOfMonthOn,
  yearOf,
} from "@/lib/domain/schedule/dates";
import type { DateRange } from "@/lib/domain/schedule/types";

/**
 * The four calendar views as ranges — overview §5 and §10.2.
 *
 * This is the whole difference between the views: each one is a different range
 * handed to the same `expand()` call. Nothing here knows about React, and
 * nothing in the components computes a date, so the rule that a week starts on
 * Monday (overview §8.5) is asserted once, in `views.test.ts`, rather than
 * being re-derived in a grid component.
 */

export type CalendarViewName = "day" | "week" | "month" | "year";

export const CALENDAR_VIEWS: readonly CalendarViewName[] = [
  "day",
  "week",
  "month",
  "year",
];

/** Narrows a route segment; anything else is a 404, not a silent default. */
export function isCalendarViewName(value: string): value is CalendarViewName {
  return (CALENDAR_VIEWS as readonly string[]).includes(value);
}

/**
 * The range a view expands, both ends inclusive.
 *
 * - **day** — the date itself.
 * - **week** — its ISO week, Monday to Sunday.
 * - **month** — the whole ISO weeks the month spans, so the grid is a rectangle
 *   and the days spilling in from the neighbouring months are real resolved
 *   days rather than blank padding.
 * - **year** — the `AcademicYear` the date falls in, when the teacher has set
 *   one up; otherwise the calendar year, so an August date before year setup
 *   still renders instead of erroring (`getYearFrame()` returns `null` there).
 */
export function rangeFor(
  view: CalendarViewName,
  date: IsoDate,
  yearRange?: DateRange,
): DateRange {
  switch (view) {
    case "day":
      return { from: date, to: date };
    case "week":
      return { from: startOfIsoWeekOn(date), to: endOfIsoWeekOn(date) };
    case "month":
      return {
        from: startOfIsoWeekOn(startOfMonthOn(date)),
        to: endOfIsoWeekOn(endOfMonthOn(date)),
      };
    case "year":
      return yearRange ?? { from: `${yearOf(date)}-01-01`, to: `${yearOf(date)}-12-31` };
  }
}

/**
 * The anchor date one period away — what the ← and → links point at.
 *
 * The step is the view's own period, so it lands on the same weekday in the
 * next week and on the same day-of-month in the next month (clamped: 31 March
 * back one month is 28 February). For the year view the step moves a calendar
 * year; `rangeFor()` then snaps it to whichever `AcademicYear` covers it.
 */
export function stepBy(
  view: CalendarViewName,
  date: IsoDate,
  count: number,
): IsoDate {
  switch (view) {
    case "day":
      return addIsoDays(date, count);
    case "week":
      return addIsoWeeks(date, count);
    case "month":
      return addIsoMonths(date, count);
    case "year":
      return addIsoYears(date, count);
  }
}

/** `true` while the date is inside the month the month view is anchored on. */
export function isInMonthOf(date: IsoDate, anchor: IsoDate): boolean {
  return date.slice(0, 7) === anchor.slice(0, 7);
}
