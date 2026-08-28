/**
 * The single source of "today" for the whole application (overview §8.5).
 *
 * The container runs in UTC; at 01:00 Kyiv time a naive `new Date()` yields
 * yesterday's date, which breaks the copy-on-write cut-off (§3.2) and the
 * "today" highlight in the calendar. Domain code must never call `new Date()`.
 */
export const APP_TIME_ZONE = "Europe/Kyiv";

/** A calendar date with no time and no zone, as `YYYY-MM-DD`. */
export type IsoDate = string;

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar date in `Europe/Kyiv` at the given instant (default: now). */
export function today(now: Date = new Date()): IsoDate {
  return isoDateFormatter.format(now);
}
