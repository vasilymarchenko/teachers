import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarISOWeeks,
  endOfISOWeek,
  endOfMonth,
  format,
  getISODay,
  isValid,
  parseISO,
  startOfISOWeek,
  startOfMonth,
} from "date-fns";
import type { IsoDate } from "@/lib/time/today";

/**
 * Calendar arithmetic over `IsoDate` strings, for the domain — the schedule
 * (`expand`, `parity`) and the calendar views (`lib/domain/calendar`) alike.
 *
 * Two rules make this file small. First, a `YYYY-MM-DD` string sorts
 * lexicographically in date order, so every comparison in the domain is a plain
 * `<=` on strings and needs nothing from here. Second, only `date-fns` calendar
 * functions are used — they compare calendar fields, so a DST change cannot
 * shift a result, and no `new Date()` is written anywhere (overview §8.5).
 */

const parse = (date: IsoDate): Date => parseISO(date);

const toIso = (date: Date): IsoDate => format(date, "yyyy-MM-dd");

/**
 * `true` for a real `YYYY-MM-DD` date.
 *
 * Both halves are needed: the pattern rejects everything that is not the plain
 * format, and the round trip rejects a date that matches the pattern without
 * existing — `parseISO` normalises `2026-02-30` into 2 March, and a route
 * segment that silently became another day would render the wrong day
 * (`lib/domain/calendar/views.ts` narrows the URL with this).
 */
export function isIsoDate(value: string): value is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parse(value);
  return isValid(parsed) && toIso(parsed) === value;
}

/** ISO weekday number, 1 = Monday … 7 = Sunday. */
export function isoDayNumber(date: IsoDate): number {
  return getISODay(parse(date));
}

/**
 * Whole ISO weeks from `from` to `to`, Monday-start — that is,
 * `weeksBetween(startOfISOWeek(from), startOfISOWeek(to))` of the overview §3.5
 * formula. Negative when `to` is the earlier date.
 */
export function isoWeeksBetween(from: IsoDate, to: IsoDate): number {
  return differenceInCalendarISOWeeks(parse(to), parse(from));
}

/** Whole calendar days from `from` to `to`; negative when `to` is earlier. */
export function isoDaysBetween(from: IsoDate, to: IsoDate): number {
  return differenceInCalendarDays(parse(to), parse(from));
}

/** The day after `date`. */
export function nextIsoDate(date: IsoDate): IsoDate {
  return toIso(addDays(parse(date), 1));
}

/** Every date from `from` to `to`, both ends included, in order. */
export function eachIsoDateInRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let date = from; date <= to; date = nextIsoDate(date)) {
    dates.push(date);
  }
  return dates;
}

/** The Monday of the ISO week containing the date (overview §8.5). */
export function startOfIsoWeekOn(date: IsoDate): IsoDate {
  return toIso(startOfISOWeek(parse(date)));
}

/** The Sunday of the ISO week containing the date. */
export function endOfIsoWeekOn(date: IsoDate): IsoDate {
  return toIso(endOfISOWeek(parse(date)));
}

/** The first day of the month containing the date. */
export function startOfMonthOn(date: IsoDate): IsoDate {
  return toIso(startOfMonth(parse(date)));
}

/** The last day of the month containing the date. */
export function endOfMonthOn(date: IsoDate): IsoDate {
  return toIso(endOfMonth(parse(date)));
}

/** The date `count` days later; negative counts move back. */
export function addIsoDays(date: IsoDate, count: number): IsoDate {
  return toIso(addDays(parse(date), count));
}

/** The same weekday `count` weeks later; negative counts move back. */
export function addIsoWeeks(date: IsoDate, count: number): IsoDate {
  return toIso(addWeeks(parse(date), count));
}

/**
 * The same day-of-month `count` months later, clamped to the month's length —
 * 31 January plus one month is 28 February, not 3 March.
 */
export function addIsoMonths(date: IsoDate, count: number): IsoDate {
  return toIso(addMonths(parse(date), count));
}

/** The same date `count` years later, clamped the same way on 29 February. */
export function addIsoYears(date: IsoDate, count: number): IsoDate {
  return toIso(addYears(parse(date), count));
}

/** The calendar year of the date, as a number. */
export function yearOf(date: IsoDate): number {
  return Number(date.slice(0, 4));
}
