import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  pgTable,
  smallint,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { ownerId, primaryId, timestamps } from "./columns";
import { nonTeachingKindEnum } from "./enums";

/**
 * The year frame: `docs/architecture/design/schema.md` §4.1–§4.3.
 *
 * One file, three tables, because `semester` and `non_teaching_period` are
 * children of `academic_year` and are deleted with it.
 *
 * The `EXCLUDE USING gist` constraints on `academic_year` and `semester` cannot
 * be expressed in Drizzle; they are in the hand-written migration
 * `drizzle/0002_exclusion_constraints.sql` (§9).
 */

export const academicYear = pgTable(
  "academic_year",
  {
    id: primaryId(),
    userId: ownerId(),
    /** Inclusive. */
    dateFrom: date("date_from").notNull(),
    /** Inclusive — the last day of the year (§1, entity range). */
    dateTo: date("date_to").notNull(),
    ...timestamps(),
  },
  (t) => [
    check("academic_year_dates_ck", sql`${t.dateFrom} <= ${t.dateTo}`),
    // Composite FK target for the children below (§8).
    unique("academic_year_id_user_uq").on(t.id, t.userId),
  ],
);

export const semester = pgTable(
  "semester",
  {
    id: primaryId(),
    userId: ownerId(),
    academicYearId: uuid("academic_year_id").notNull(),
    /** 1 or 2 (glossary §1). */
    index: smallint("index").notNull(),
    dateFrom: date("date_from").notNull(),
    /** Inclusive. A semester is continuous; breaks inside it are periods. */
    dateTo: date("date_to").notNull(),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: "semester_year_fk",
      columns: [t.academicYearId, t.userId],
      foreignColumns: [academicYear.id, academicYear.userId],
    }).onDelete("cascade"),
    check("semester_index_ck", sql`${t.index} in (1, 2)`),
    check("semester_dates_ck", sql`${t.dateFrom} <= ${t.dateTo}`),
    unique("semester_year_index_uq").on(t.userId, t.academicYearId, t.index),
  ],
);

export const nonTeachingPeriod = pgTable(
  "non_teaching_period",
  {
    id: primaryId(),
    userId: ownerId(),
    academicYearId: uuid("academic_year_id").notNull(),
    kind: nonTeachingKindEnum("kind").notNull(),
    /** Ukrainian — the teacher reads it. */
    name: text("name").notNull(),
    dateFrom: date("date_from").notNull(),
    /** Inclusive — a one-day holiday has `date_from = date_to`. */
    dateTo: date("date_to").notNull(),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: "non_teaching_period_year_fk",
      columns: [t.academicYearId, t.userId],
      foreignColumns: [academicYear.id, academicYear.userId],
    }).onDelete("cascade"),
    check("non_teaching_period_dates_ck", sql`${t.dateFrom} <= ${t.dateTo}`),
    // Periods may overlap on purpose (a PUBLIC_HOLIDAY inside a BREAK), so this
    // is a plain index and not an exclusion constraint (§4.3).
    index("non_teaching_period_user_range_idx").on(
      t.userId,
      t.dateFrom,
      t.dateTo,
    ),
  ],
);
