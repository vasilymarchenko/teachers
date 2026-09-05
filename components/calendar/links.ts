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

/**
 * The override editor of one lesson — `/calendar/<view>/<date>/lesson/<n>`.
 *
 * It sits **under** the calendar view the teacher came from, so «Повернутися»
 * lands back on the day, week, month or year she was looking at, and the URL is
 * still the whole state of the screen. The `?schedule=class` of §6.2 rides
 * along exactly as it does on the views themselves — an override belongs to one
 * `view`, and losing that segment of the address would edit the other one.
 */
export function lessonHref(
  view: CalendarViewName,
  date: IsoDate,
  lessonNumber: number,
  schedule: ScheduleView,
): string {
  const suffix = schedule === "CLASS" ? `?schedule=${CLASS_SEARCH_VALUE}` : "";
  return `/calendar/${view}/${date}/lesson/${lessonNumber}${suffix}`;
}
