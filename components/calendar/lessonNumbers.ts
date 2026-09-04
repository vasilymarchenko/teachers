import type { CalendarDay } from "@/lib/domain/calendar/days";
import type { BellInput } from "@/lib/domain/schedule/types";

/**
 * The lesson numbers a day offers to **add** an override at —
 * specification §5.3, «додати урок».
 *
 * The `BellSchedule` decides which numbers a school day has, exactly as it does
 * in the template editor (`components/schedule/lessonRows.ts`): it is where the
 * teacher said how many lessons there are and when they start. Numbers the day
 * already shows are not offered — a lesson that is on the screen is edited from
 * its own row, and offering «+ 3» beside the third lesson would be two controls
 * for one slot.
 *
 * The cancelled lessons count as shown: a `CLEARED` override is still a row on
 * the date, struck through (T-007 §4.2), and it is reached — and undone — from
 * that row.
 *
 * A number with no bell row is not offered, but one that already carries a
 * lesson is never hidden: `lessonRows()` keeps that promise on the template
 * side and the day's own rows keep it here, so deleting a bell row cannot strand
 * an override at a number the screen can no longer reach.
 */
export function addableLessonNumbers(
  day: CalendarDay,
  bells: readonly BellInput[],
): number[] {
  const shown = new Set([
    ...day.lessons.map((lesson) => lesson.lessonNumber),
    ...day.cancelled.map((lesson) => lesson.lessonNumber),
  ]);

  return bells
    .map((bell) => bell.lessonNumber)
    .filter((lessonNumber) => !shown.has(lessonNumber))
    .sort((a, b) => a - b);
}
