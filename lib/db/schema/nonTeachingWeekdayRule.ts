import { sql } from "drizzle-orm";
import { check, date, index, pgTable } from "drizzle-orm/pg-core";
import { ownerId, primaryId, timestamps } from "./columns";
import { boundaryKindEnum, weekdayEnum } from "./enums";

/**
 * `docs/architecture/design/schema.md` §4.4.
 *
 * The rule applies to a date `d` when `valid_from <= d < boundary_date`.
 * Overlapping rules for the same weekday are legal: `isNonTeaching` is an OR
 * over rows, so a redundant row changes no answer.
 */
export const nonTeachingWeekdayRule = pgTable(
  "non_teaching_weekday_rule",
  {
    id: primaryId(),
    userId: ownerId(),
    weekday: weekdayEnum("weekday").notNull(),
    /**
     * Inclusive, resolved at write time from `lib/time/today.ts` — never from
     * caller input. Year setup (T-009) is the one exception: the rules it
     * creates as part of the year frame start at `academic_year.date_from`.
     */
    validFrom: date("valid_from").notNull(),
    /** Exclusive (§6, validity boundary). */
    boundaryDate: date("boundary_date").notNull(),
    /** Display only — how the teacher entered `boundary_date`. */
    boundaryKind: boundaryKindEnum("boundary_kind").notNull(),
    ...timestamps(),
  },
  (t) => [
    check("ntwr_range_ck", sql`${t.validFrom} < ${t.boundaryDate}`),
    index("ntwr_user_weekday_idx").on(t.userId, t.weekday, t.validFrom),
  ],
);
