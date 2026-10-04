import type { SemesterRange } from "@/lib/domain/schedule/boundaries";
import type { NonTeachingPeriodInput } from "@/lib/domain/schedule/types";
import type { IsoDate } from "@/lib/time/today";
import { getUpcomingYearFrame, getYearFrame } from "./yearFrame";
import { listNonTeachingPeriods } from "./yearSetup";

/**
 * What a symbolic boundary written on `date` resolves against — the breaks and
 * the semesters of the year that date falls in (overview §8.1).
 *
 * One read for the two sides that must agree: the action that resolves the
 * symbol when it is saved, and the page that asks whether saving it again now
 * would resolve it elsewhere (`restatedBoundary()`, T-047). Were they to build
 * it separately, a page could announce a new date the action would not write,
 * and the form would open as changed after every save.
 *
 * `orUpcoming` is the weekly template's rule: before the year begins the
 * symbol means the year about to start (ADR-004, `getUpcomingYearFrame()`).
 * An event's boundary belongs to the year of the event's own date, and to no
 * other.
 *
 * The breaks are the `BREAK` periods only — «найближчі канікули» means a
 * break, not a public holiday (schema §4.3).
 */
export type BoundaryFrame = {
  /** The first day of the year — `ruleValidFrom()`'s other argument. */
  yearStart: IsoDate;
  breaks: NonTeachingPeriodInput[];
  semesters: SemesterRange[];
};

export async function getBoundaryFrame(
  userId: string,
  date: IsoDate,
  { orUpcoming = false }: { orUpcoming?: boolean } = {},
): Promise<BoundaryFrame | null> {
  const frame =
    (await getYearFrame(userId, date)) ??
    (orUpcoming ? await getUpcomingYearFrame(userId, date) : null);
  if (frame === null) return null;

  const periods = await listNonTeachingPeriods(userId, frame.id);
  return {
    yearStart: frame.dateFrom,
    breaks: periods.filter((period) => period.kind === "BREAK"),
    semesters: frame.semesters,
  };
}
