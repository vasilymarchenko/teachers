import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  jsonb,
  pgTable,
  smallint,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { ownerId, primaryId, timestamps } from "./columns";
import {
  boundaryKindEnum,
  parityEnum,
  scheduleViewEnum,
  weekdayEnum,
} from "./enums";

/**
 * The version table and its cells: `docs/architecture/design/schema.md` §4.7,
 * §4.8. One `schedule_template` row is one version of the weekly template for
 * one `view`.
 *
 * Invariant I3 of overview §3.2 — two versions of the same `(user_id, view)` may
 * not overlap — is an `EXCLUDE USING gist` constraint that Drizzle cannot
 * express; it is in `drizzle/0002_exclusion_constraints.sql`, and the extension
 * it needs is created by `drizzle/0000_btree_gist.sql`.
 *
 * Copy-on-write (I1/I2) is application logic, not a constraint: the database
 * rejects an overlap, it does not perform the trim.
 */
export const scheduleTemplate = pgTable(
  "schedule_template",
  {
    id: primaryId(),
    userId: ownerId(),
    view: scheduleViewEnum("view").notNull(),
    /** Inclusive. */
    validFrom: date("valid_from").notNull(),
    /** Exclusive (§6, validity boundary). */
    validTo: date("valid_to").notNull(),
    /** Display only — how the teacher entered `valid_to`. */
    boundaryKind: boundaryKindEnum("boundary_kind").notNull(),
    ...timestamps(),
  },
  (t) => [
    // Not decoration: `daterange(d, d)` is the empty range, and an empty range
    // overlaps nothing — without this check any number of zero-length versions
    // would slip past the exclusion constraint.
    check("schedule_template_range_ck", sql`${t.validFrom} < ${t.validTo}`),
    // Composite FK target for `template_slot` (§8).
    unique("schedule_template_id_user_uq").on(t.id, t.userId),
  ],
);

export const templateSlot = pgTable(
  "template_slot",
  {
    id: primaryId(),
    userId: ownerId(),
    templateId: uuid("template_id").notNull(),
    weekday: weekdayEnum("weekday").notNull(),
    lessonNumber: smallint("lesson_number").notNull(),
    /** The slot belongs to exactly one parity week; there is no "both". */
    parity: parityEnum("parity").notNull(),
    /**
     * Shape depends on the parent's `view` and is enforced by
     * `lib/validation/slotPayload.ts`, never by the database (§7).
     */
    payload: jsonb("payload").notNull(),
    ...timestamps(),
  },
  (t) => [
    // Composite: a slot cannot be attached to another user's template, because
    // no such `(id, user_id)` pair exists (§8).
    foreignKey({
      name: "template_slot_template_fk",
      columns: [t.templateId, t.userId],
      foreignColumns: [scheduleTemplate.id, scheduleTemplate.userId],
    }).onDelete("cascade"),
    check("template_slot_number_ck", sql`${t.lessonNumber} between 0 and 9`),
    unique("template_slot_cell_uq").on(
      t.templateId,
      t.weekday,
      t.lessonNumber,
      t.parity,
    ),
    // The shape `expand()` reads: every slot of one version for one weekday and
    // one parity.
    index("template_slot_user_template_idx").on(
      t.userId,
      t.templateId,
      t.weekday,
      t.parity,
    ),
  ],
);
