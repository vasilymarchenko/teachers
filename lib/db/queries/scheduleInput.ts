import type { DateRange, ScheduleInput } from "@/lib/domain/schedule/types";
import { getBellSchedule } from "./bells";
import {
  getNonTeachingPeriods,
  getNonTeachingWeekdayRules,
} from "./calendarRules";
import { getDayOverrides } from "./overrides";
import { getParityAnchors } from "./parityAnchors";
import { getTemplateVersions } from "./templates";

/**
 * Everything `expand()` takes for a window, in one call — the read half of
 * overview §5 ("the calendar is a derivation, not an entity").
 *
 * The point of this function is that T-007 renders a domain result instead of
 * assembling rows of its own: a screen calls this, hands the result to
 * `expand()` with a view, and never sees a Drizzle type. Nothing here is
 * view-specific — `ScheduleInput` carries both views whichever one is asked for,
 * because `isTaughtByMe` on a `CLASS` day is resolved against the `OWN` day
 * (fixtures §8.6) — so the four calendar views differ only in the range they
 * pass, and the same input serves both switch positions.
 *
 * The six reads are independent, so they run concurrently: six round trips in
 * the time of the slowest, rather than in sum. `getTemplateVersions()` is itself
 * two queries, making eight in all, and none of them grows with the length of
 * the range.
 *
 * No caching, deliberately — overview §9, "Без кешування на старті", whose
 * trigger is the ~300 ms year-view render. The reaction recorded there is to
 * wrap this result, which is why the assembly is one function and not six calls
 * spread through a page.
 */
export async function getScheduleInput(
  userId: string,
  range: DateRange,
): Promise<ScheduleInput> {
  const [anchors, nonTeachingPeriods, weekdayRules, bells, templates, overrides] =
    await Promise.all([
      getParityAnchors(userId, range),
      getNonTeachingPeriods(userId, range),
      getNonTeachingWeekdayRules(userId, range),
      getBellSchedule(userId),
      getTemplateVersions(userId, range),
      getDayOverrides(userId, range),
    ]);

  return {
    anchors,
    nonTeachingPeriods,
    weekdayRules,
    bells,
    templates,
    overrides,
  };
}
