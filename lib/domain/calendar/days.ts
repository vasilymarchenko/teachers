import { isoDaysBetween } from "@/lib/domain/schedule/dates";
import { expand, type ExpandRequest } from "@/lib/domain/schedule/expand";
import type {
  NonTeachingPeriodInput,
  ResolvedDay,
  ResolvedLesson,
  ScheduleInput,
} from "@/lib/domain/schedule/types";
import type { IsoDate } from "@/lib/time/today";

/**
 * What a calendar screen renders: `ResolvedDay` plus the two things the screen
 * needs and the domain's expansion deliberately does not carry.
 *
 * `cancelled` — the lessons a `CLEARED` override took off this date. `expand()`
 * removes them, and `docs/architecture/design/expand-fixtures.md` §8.8 pins
 * that: a tombstone must never come back as a lesson. But specification §5.3
 * and §5.4 want the teacher to *see* that the lesson was cancelled, struck
 * through, not to find a silently shorter day — so the cancelled lesson is a
 * separate list, never mixed into `lessons`.
 *
 * `nonTeachingName` — the `NonTeachingPeriod` that shades the day (§6). Absent
 * when the day is non-teaching because of a `NonTeachingWeekdayRule`: a rule is
 * a weekday, it has no name to give (schema §4.4).
 *
 * This merge is made once, here, for the same reason `ResolvedLesson` is
 * (overview §5): the day view, the week grid, the month grid, the year grid and
 * the printed page all need it, and four components computing it four ways is
 * exactly what §5 refuses.
 */
export type CalendarDay = ResolvedDay & {
  cancelled: ResolvedLesson[];
  /** Ukrainian — the teacher reads it. */
  nonTeachingName?: string;
};

/** A `NonTeachingPeriod` as the calendar names it — `getNonTeachingPeriods()`. */
export type NamedNonTeachingPeriod = NonTeachingPeriodInput & {
  /** Ukrainian — the teacher reads it. */
  name: string;
};

/**
 * The window a calendar screen renders.
 *
 * The cancelled lessons come from expanding the same window **twice**: once as
 * it stands, and once with the overrides removed. A `lessonNumber` the
 * override-free expansion holds and the real one does not is a lesson a
 * `CLEARED` override took away — `EDIT` and `SUBSTITUTION` keep their number,
 * and nothing else can remove one — and the second expansion carries its
 * planned payload and bell times, which is what §5.4 asks to be shown struck
 * through.
 *
 * Doing it as a diff rather than by reading the `CLEARED` rows directly is what
 * keeps the fixture's O8 right: a tombstone with no slot under it drops out of
 * both expansions, so it produces no phantom cancelled lesson (§8.8). It also
 * means the rule for «which slot was in force on this date» is written once, in
 * `expand()`, and not a second time here.
 *
 * The cost is a second expansion of the window — measured for the year view
 * against the ~300 ms trigger of overview §9, and recorded in T-007.
 */
export function buildCalendarDays(
  input: ScheduleInput,
  request: ExpandRequest,
  periods: readonly NamedNonTeachingPeriod[] = [],
): CalendarDay[] {
  const days = expand(input, request);
  const planned = new Map(
    expand({ ...input, overrides: [] }, request).map((day) => [
      day.date,
      day.lessons,
    ]),
  );

  return days.map((day) => {
    const kept = new Set(day.lessons.map((lesson) => lesson.lessonNumber));
    const cancelled = (planned.get(day.date) ?? []).filter(
      (lesson) => !kept.has(lesson.lessonNumber),
    );
    const name = day.isNonTeaching
      ? nameOfPeriodOn(day.date, periods)
      : undefined;

    return {
      ...day,
      cancelled,
      ...(name === undefined ? {} : { nonTeachingName: name }),
    };
  });
}

/**
 * The name of the period covering the date.
 *
 * Overlapping periods are normal — a `PUBLIC_HOLIDAY` inside a `BREAK`
 * (fixtures §6) — and the shorter one is the one worth naming: «День захисника»
 * says more than «Осінні канікули» on the day it falls on.
 */
function nameOfPeriodOn(
  date: IsoDate,
  periods: readonly NamedNonTeachingPeriod[],
): string | undefined {
  let shortest: NamedNonTeachingPeriod | undefined;
  for (const period of periods) {
    if (period.dateFrom > date || period.dateTo < date) continue;
    if (shortest === undefined || lengthOf(period) < lengthOf(shortest)) {
      shortest = period;
    }
  }
  return shortest?.name;
}

/** How many days a period covers; a one-day holiday is 1. */
function lengthOf(period: NamedNonTeachingPeriod): number {
  return isoDaysBetween(period.dateFrom, period.dateTo) + 1;
}
