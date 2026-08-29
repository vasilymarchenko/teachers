import { and, asc, eq, gt, gte, lte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { nonTeachingPeriod, nonTeachingWeekdayRule } from "@/lib/db/schema";
import type { NonTeachingKind } from "@/lib/db/schema/enums";
import type {
  DateRange,
  NonTeachingPeriodInput,
  NonTeachingWeekdayRuleInput,
} from "@/lib/domain/schedule/types";

/**
 * The two sources `isNonTeachingOn()` reads —
 * `lib/domain/schedule/calendarRules.ts`, overview §3.1.
 *
 * Both select by overlap with the window, in SQL. Loading the year and
 * filtering in JS would give the same answer for one teacher and the wrong
 * shape for the year view, which asks for ~250 days at a time.
 */

/**
 * A period as the calendar shows it: `isNonTeaching` needs only the two dates,
 * but T-007 names the period on a shaded day, so the read returns the whole row
 * and `getScheduleInput()` narrows it to `NonTeachingPeriodInput`.
 */
export type NonTeachingPeriodRow = NonTeachingPeriodInput & {
  id: string;
  /** Ukrainian — the teacher reads it. */
  name: string;
  kind: NonTeachingKind;
};

/**
 * `NonTeachingPeriod` rows overlapping the window.
 *
 * Both ends of a period are inclusive, so it overlaps `[from, to]` when
 * `date_from <= to AND date_to >= from`. `non_teaching_period_user_range_idx`
 * (`user_id`, `date_from`, `date_to`) covers it.
 */
export async function getNonTeachingPeriods(
  userId: string,
  range: DateRange,
): Promise<NonTeachingPeriodRow[]> {
  return getDb()
    .select({
      id: nonTeachingPeriod.id,
      name: nonTeachingPeriod.name,
      kind: nonTeachingPeriod.kind,
      dateFrom: nonTeachingPeriod.dateFrom,
      dateTo: nonTeachingPeriod.dateTo,
    })
    .from(nonTeachingPeriod)
    .where(
      and(
        eq(nonTeachingPeriod.userId, userId),
        lte(nonTeachingPeriod.dateFrom, range.to),
        gte(nonTeachingPeriod.dateTo, range.from),
      ),
    )
    .orderBy(asc(nonTeachingPeriod.dateFrom), asc(nonTeachingPeriod.dateTo));
}

/**
 * `NonTeachingWeekdayRule` rows in force anywhere in the window.
 *
 * A rule applies while `valid_from <= d < boundary_date` — the bound is
 * exclusive (schema §4.4, §6) — so it touches `[from, to]` when
 * `valid_from <= to AND boundary_date > from`. Getting that `>` wrong by one is
 * a rule that ends a day late; the fixture's R1 ends exactly where the break
 * starts (fixtures §3.3).
 */
export async function getNonTeachingWeekdayRules(
  userId: string,
  range: DateRange,
): Promise<NonTeachingWeekdayRuleInput[]> {
  return getDb()
    .select({
      weekday: nonTeachingWeekdayRule.weekday,
      validFrom: nonTeachingWeekdayRule.validFrom,
      boundaryDate: nonTeachingWeekdayRule.boundaryDate,
    })
    .from(nonTeachingWeekdayRule)
    .where(
      and(
        eq(nonTeachingWeekdayRule.userId, userId),
        lte(nonTeachingWeekdayRule.validFrom, range.to),
        gt(nonTeachingWeekdayRule.boundaryDate, range.from),
      ),
    )
    .orderBy(
      asc(nonTeachingWeekdayRule.weekday),
      asc(nonTeachingWeekdayRule.validFrom),
    );
}
