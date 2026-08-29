import { date, pgTable, unique } from "drizzle-orm/pg-core";
import { ownerId, primaryId, timestamps } from "./columns";
import { parityEnum } from "./enums";

/**
 * `docs/architecture/design/schema.md` §4.6.
 *
 * The year's initial parity is a row here and nowhere else — `academic_year` has
 * no parity column (§4.1, finding F-1). An anchor need not fall on a Monday.
 */
export const parityAnchor = pgTable(
  "parity_anchor",
  {
    id: primaryId(),
    userId: ownerId(),
    /** Inclusive: the anchor is in force from this date onwards. */
    date: date("date").notNull(),
    parity: parityEnum("parity").notNull(),
    ...timestamps(),
  },
  // The unique constraint's index serves the only query there is: the last
  // anchor with `date <= d`.
  (t) => [unique("parity_anchor_user_date_uq").on(t.userId, t.date)],
);
