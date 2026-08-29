import { sql } from "drizzle-orm";
import {
  check,
  date,
  jsonb,
  pgTable,
  smallint,
  unique,
} from "drizzle-orm/pg-core";
import { ownerId, primaryId, timestamps } from "./columns";
import { dayOverrideKindEnum, scheduleViewEnum } from "./enums";

/**
 * `docs/architecture/design/schema.md` §4.9.
 *
 * An override is bound to a **date**, not to a template version: it survives a
 * template change and is legal with nothing underneath it at all. Hence no
 * `template_id`, no `academic_year_id`, and no stored `replaced_original` — the
 * replaced lesson is recomputed from the version and the parity in force on the
 * date being rendered (glossary §3).
 */
export const dayOverride = pgTable(
  "day_override",
  {
    id: primaryId(),
    userId: ownerId(),
    date: date("date").notNull(),
    /** Its own, because an override has no parent to inherit one from. */
    view: scheduleViewEnum("view").notNull(),
    lessonNumber: smallint("lesson_number").notNull(),
    kind: dayOverrideKindEnum("kind").notNull(),
    /** `NULL` exactly when `kind = 'CLEARED'` — see the check below. */
    payload: jsonb("payload"),
    ...timestamps(),
  },
  (t) => [
    check("day_override_number_ck", sql`${t.lessonNumber} between 0 and 9`),
    // The whole of "CLEARED is a tombstone": the row exists and the content is
    // empty, which is what separates "урок скасовано" from "no override".
    check(
      "day_override_payload_ck",
      sql`(${t.kind} = 'CLEARED') = (${t.payload} is null)`,
    ),
    // Its index is also the range read `expand()` does over a window
    // (`user_id`, a `date` range, `view`), so no second index is needed.
    unique("day_override_slot_uq").on(
      t.userId,
      t.date,
      t.view,
      t.lessonNumber,
    ),
  ],
);
