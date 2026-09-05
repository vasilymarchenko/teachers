import type { RecurrenceKind } from "@/lib/db/schema/enums";
import {
  addIsoDays,
  addIsoMonths,
  eachIsoDateInRange,
  isIsoDate,
  isoDaysBetween,
  startOfMonthOn,
  yearOf,
} from "@/lib/domain/schedule/dates";
import type { DateRange } from "@/lib/domain/schedule/types";
import type { IsoDate } from "@/lib/time/today";

/**
 * A repeating `Event` turned into the dates it falls on inside a window —
 * specification §6.3, overview §4 and §8.1. Mechanics:
 * `docs/architecture/design/T-012-events.md`.
 *
 * Pure and database-free, like the rest of `lib/domain`: it takes the columns
 * `getEventsInRange()` selects and answers with dates. Nothing is stored per
 * occurrence — the same decision the schedule makes in `expand()` (overview §1),
 * and for the same reason: an occurrence is computed, not a row.
 *
 * Two shapes, as the table has them (schema §4.10):
 *
 *  - `NONE` — the event occupies `[dateFrom, dateTo ?? dateFrom]`, every day of
 *    it, clipped to the window;
 *  - `WEEKLY` / `MONTHLY` / `YEARLY` — one day per occurrence, stepped from
 *    `dateFrom` while the date is **before** the exclusive `boundaryDate`
 *    (§8.1). A recurring event never spans days (`event_recurring_span_ck`).
 */

/** The columns an expansion reads — `EventRow` minus what it does not use. */
export type RecurrenceInput = {
  dateFrom: IsoDate;
  /** `NONE` only, inclusive; `null` is a one-day event. */
  dateTo: IsoDate | null;
  recurrenceKind: RecurrenceKind;
  /** Exclusive; present exactly when the event recurs. */
  boundaryDate: IsoDate | null;
};

/**
 * The dates the event falls on inside `range`, both ends inclusive, in order.
 *
 * Empty is an ordinary answer: `getEventsInRange()` returns a recurring row for
 * every window inside its validity, and a `YEARLY` event has no occurrence in
 * most of them.
 */
export function occurrencesInRange(
  event: RecurrenceInput,
  range: DateRange,
): IsoDate[] {
  const from = later(range.from, event.dateFrom);
  const to = earlier(range.to, lastDayOf(event));
  if (to === undefined || from > to) return [];

  switch (event.recurrenceKind) {
    case "NONE":
      return eachIsoDateInRange(from, to);
    case "WEEKLY":
      return weeklyOccurrences(event.dateFrom, from, to);
    case "MONTHLY":
      return monthlyOccurrences(event.dateFrom, from, to);
    case "YEARLY":
      return yearlyOccurrences(event.dateFrom, from, to);
  }
}

/**
 * The last day the event can still fall on, or `undefined` when there is none.
 *
 * For a one-off that is `dateTo` — an entity range, inclusive at both ends
 * (§8.1). For a recurring event it is the day **before** `boundaryDate`, which
 * is the exclusive form every boundary in the schema has: the rule applies to a
 * date `d` while `d < boundaryDate`.
 *
 * `undefined` answers the shape the database cannot hold — a recurrence with no
 * boundary (`event_recurrence_ck`). Rather than invent an end for it, the
 * expansion yields nothing, so a row broken by hand shows up as an event that
 * never occurs instead of one that occurs forever.
 */
function lastDayOf(event: RecurrenceInput): IsoDate | undefined {
  if (event.recurrenceKind === "NONE") return event.dateTo ?? event.dateFrom;
  return event.boundaryDate === null
    ? undefined
    : addIsoDays(event.boundaryDate, -1);
}

/** Every seventh day from `dateFrom` — the same weekday, by construction. */
function weeklyOccurrences(
  dateFrom: IsoDate,
  from: IsoDate,
  to: IsoDate,
): IsoDate[] {
  // The first occurrence not before `from`: whole weeks only, so the weekday
  // never drifts.
  const weeks = Math.ceil(isoDaysBetween(dateFrom, from) / 7);
  const dates: IsoDate[] = [];
  for (
    let date = addIsoDays(dateFrom, weeks * 7);
    date <= to;
    date = addIsoDays(date, 7)
  ) {
    dates.push(date);
  }
  return dates;
}

/**
 * The same day-of-month, every month — and **nothing at all** in a month that
 * has no such day (ADR-009).
 *
 * The candidate is built as a string and checked with `isIsoDate()` rather than
 * stepped with `addIsoMonths()`, which clamps: 31 January plus one month is 28
 * February there, and a monthly event would slide onto a date the teacher never
 * chose and stay there.
 */
function monthlyOccurrences(
  dateFrom: IsoDate,
  from: IsoDate,
  to: IsoDate,
): IsoDate[] {
  const day = dateFrom.slice(8);
  const dates: IsoDate[] = [];
  // The cursor is the first of the month, which every month has, so stepping it
  // with `addIsoMonths()` cannot clamp.
  for (
    let month = startOfMonthOn(from);
    month <= to;
    month = addIsoMonths(month, 1)
  ) {
    const candidate = `${month.slice(0, 8)}${day}`;
    if (!isIsoDate(candidate)) continue;
    if (candidate >= from && candidate <= to) dates.push(candidate);
  }
  return dates;
}

/** The same month and day, every year; 29 February skips a common year. */
function yearlyOccurrences(
  dateFrom: IsoDate,
  from: IsoDate,
  to: IsoDate,
): IsoDate[] {
  const monthAndDay = dateFrom.slice(4);
  const dates: IsoDate[] = [];
  for (let year = yearOf(from); year <= yearOf(to); year += 1) {
    const candidate = `${year}${monthAndDay}`;
    if (!isIsoDate(candidate)) continue;
    if (candidate >= from && candidate <= to) dates.push(candidate);
  }
  return dates;
}

const later = (a: IsoDate, b: IsoDate): IsoDate => (a >= b ? a : b);

/** `undefined` propagates: no end at all means nothing to expand into. */
function earlier(a: IsoDate, b: IsoDate | undefined): IsoDate | undefined {
  return b === undefined ? undefined : a <= b ? a : b;
}
