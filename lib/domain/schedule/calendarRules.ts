import type { Weekday } from "@/lib/db/schema/enums";
import type { IsoDate } from "@/lib/time/today";
import { isoDayNumber } from "./dates";
import type {
  NonTeachingPeriodInput,
  NonTeachingWeekdayRuleInput,
} from "./types";

/**
 * Is this date a teaching day — overview §3.1 and §4.
 *
 * One predicate over two independent sources, OR'ed: overlapping reasons are
 * normal, not an error (a `PUBLIC_HOLIDAY` inside a `BREAK`, a break week whose
 * Friday is also a methodical day — fixtures §6, `2026-10-30`).
 *
 * Nothing here is view-dependent: `OWN` and `CLASS` have the same non-teaching
 * dates (fixtures §7).
 */

/**
 * ISO weekday number → the `weekday` enum value, the only place the two
 * numberings meet (`lib/db/schema/enums.ts`). Index 0 is Monday, ISO day 1.
 */
const WEEKDAYS: readonly Weekday[] = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
];

/** The `weekday` enum value of a date. */
export function weekdayOf(date: IsoDate): Weekday {
  return WEEKDAYS[isoDayNumber(date) - 1];
}

export type CalendarRules = {
  /** `dateFrom` and `dateTo` both inclusive. */
  periods: readonly NonTeachingPeriodInput[];
  /** Applies while `validFrom <= d < boundaryDate` — the bound is exclusive. */
  weekdayRules: readonly NonTeachingWeekdayRuleInput[];
};

/**
 * `true` when any `NonTeachingPeriod` covers the date or any
 * `NonTeachingWeekdayRule` is in force on it.
 *
 * The model has no implicit weekend: Saturday and Sunday are non-teaching only
 * because year setup writes rules for them (fixtures §9, finding F-3).
 */
export function isNonTeachingOn(date: IsoDate, rules: CalendarRules): boolean {
  const covered = rules.periods.some(
    (period) => period.dateFrom <= date && date <= period.dateTo,
  );
  if (covered) return true;

  const weekday = weekdayOf(date);
  return rules.weekdayRules.some(
    (rule) =>
      rule.weekday === weekday &&
      rule.validFrom <= date &&
      date < rule.boundaryDate,
  );
}
