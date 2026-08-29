import { sql } from "drizzle-orm";
import { check, pgTable, smallint, time, unique } from "drizzle-orm/pg-core";
import { ownerId, primaryId, timestamps } from "./columns";

/**
 * `docs/architecture/design/schema.md` §4.5.
 *
 * Only the lesson numbers actually in use have rows. Scoped to the user and not
 * to the academic year — that is overview §4 read literally; finding F-2 records
 * what it costs.
 */
export const bellSchedule = pgTable(
  "bell_schedule",
  {
    id: primaryId(),
    userId: ownerId(),
    lessonNumber: smallint("lesson_number").notNull(),
    /** Clock time — no date, no time zone (overview §8.5). */
    timeFrom: time("time_from").notNull(),
    timeTo: time("time_to").notNull(),
    ...timestamps(),
  },
  (t) => [
    check("bell_schedule_number_ck", sql`${t.lessonNumber} between 0 and 9`),
    check("bell_schedule_times_ck", sql`${t.timeFrom} < ${t.timeTo}`),
    unique("bell_schedule_user_number_uq").on(t.userId, t.lessonNumber),
  ],
);
