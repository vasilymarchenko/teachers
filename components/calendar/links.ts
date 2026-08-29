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

export function scheduleViewOf(value: string | undefined): ScheduleView {
  return value === CLASS_SEARCH_VALUE ? "CLASS" : "OWN";
}

export function calendarHref(
  view: CalendarViewName,
  date: IsoDate,
  schedule: ScheduleView,
): string {
  const suffix = schedule === "CLASS" ? `?schedule=${CLASS_SEARCH_VALUE}` : "";
  return `/calendar/${view}/${date}${suffix}`;
}
