import type { ScheduleView } from "@/lib/db/schema/enums";
import type { CalendarViewName } from "@/lib/domain/calendar/views";
import type { IsoDate } from "@/lib/time/today";

/**
 * The calendar's URLs, built in one place.
 *
 * `/calendar/<view>/<date>` — the view and the anchor date are the screen's
 * whole state, so every link is shareable and the ← → arrows, the view switch
 * and the quick jumps need no client-side state at all. The `OWN` / `CLASS`
 * switch of specification §6.2 rides along as `?schedule=class`: `OWN` is the
 * default and stays out of the URL.
 */

/** `?schedule=class`; anything else — absent included — means `OWN`. */
export const CLASS_SEARCH_VALUE = "class";

/** What Next hands a page for one search parameter: `?a=1&a=2` is an array. */
export type SearchParamValue = string | string[] | undefined;

/**
 * The first value wins on a repeated parameter (`?schedule=class&schedule=own`).
 * Comparing the array itself would quietly answer `OWN` for a URL that says
 * `class` — the switch of specification §6.2 would be off while the address bar
 * claimed it was on.
 */
export function scheduleViewOf(value: SearchParamValue): ScheduleView {
  const first = Array.isArray(value) ? value[0] : value;
  return first === CLASS_SEARCH_VALUE ? "CLASS" : "OWN";
}

export function calendarHref(
  view: CalendarViewName,
  date: IsoDate,
  schedule: ScheduleView,
): string {
  const suffix = schedule === "CLASS" ? `?schedule=${CLASS_SEARCH_VALUE}` : "";
  return `/calendar/${view}/${date}${suffix}`;
}
