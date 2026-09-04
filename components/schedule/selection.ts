import type { Parity, ScheduleView, Weekday } from "@/lib/db/schema/enums";
import {
  PARITY_VALUES,
  SCHEDULE_VIEW_VALUES,
  WEEKDAY_VALUES,
} from "@/lib/validation/enums";

/**
 * What the template editor is showing, read off the URL.
 *
 * Three independent switches — the view of specification §6.2, the parity week
 * of §4 and, below the tablet breakpoint, the weekday (overview §10.2). They
 * live in the query string so that every position of the editor is a link: the
 * switches are `<a>`s and the screen keeps working with JavaScript off, the
 * same property the calendar's navigation has.
 *
 * A value that is not one of the enum's is not an error to report but a URL to
 * ignore — the default is used and the screen renders. Nothing is written from
 * these, so a wrong one costs a rendered day, not a row.
 */

export type TemplateSelection = {
  view: ScheduleView;
  parity: Parity;
  /** Which day the narrow screen shows; the wide one shows all seven. */
  weekday: Weekday;
};

/** What the query string carries, as `searchParams` hands it over. */
export type TemplateSearchParams = {
  view?: string | string[];
  parity?: string | string[];
  day?: string | string[];
};

const pick = <Value extends string>(
  values: readonly Value[],
  requested: string | string[] | undefined,
  fallback: Value,
): Value => {
  const value = typeof requested === "string" ? requested : undefined;
  return values.find((candidate) => candidate === value) ?? fallback;
};

/**
 * `todayWeekday` is the day the teacher most likely wants to look at first, and
 * it is a parameter rather than a call: this module has no clock, and the page
 * takes the date from `lib/time/today.ts` (overview §8.5).
 */
export function pickTemplateSelection(
  params: TemplateSearchParams,
  todayWeekday: Weekday,
): TemplateSelection {
  return {
    view: pick(SCHEDULE_VIEW_VALUES, params.view, "OWN"),
    // The numerator is the week the year starts on by default (§3.5), so it is
    // the one the editor opens on. It is a switch, not a state: the editor
    // edits both weeks and neither is "current".
    parity: pick(PARITY_VALUES, params.parity, "NUMERATOR"),
    weekday: pick(WEEKDAY_VALUES, params.day, todayWeekday),
  };
}

/** The editor's own URL for a selection — the switches point at each other. */
export function templateHref(selection: TemplateSelection): string {
  const query = new URLSearchParams({
    view: selection.view,
    parity: selection.parity,
    day: selection.weekday,
  });
  return `/schedule?${query.toString()}`;
}
