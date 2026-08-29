import {
  addDays,
  differenceInCalendarISOWeeks,
  format,
  getISODay,
  parseISO,
} from "date-fns";
import type { IsoDate } from "@/lib/time/today";

/**
 * Calendar arithmetic over `IsoDate` strings, for the schedule domain only.
 *
 * Two rules make this file small. First, a `YYYY-MM-DD` string sorts
 * lexicographically in date order, so every comparison in the domain is a plain
 * `<=` on strings and needs nothing from here. Second, only `date-fns` calendar
 * functions are used — they compare calendar fields, so a DST change cannot
 * shift a result, and no `new Date()` is written anywhere (overview §8.5).
 */

const parse = (date: IsoDate): Date => parseISO(date);

const toIso = (date: Date): IsoDate => format(date, "yyyy-MM-dd");

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
