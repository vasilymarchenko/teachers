import { sql } from "drizzle-orm";
import { boolean, check, date, index, pgTable, text } from "drizzle-orm/pg-core";
import { ownerId, primaryId, timestamps } from "./columns";
import { boundaryKindEnum, eventKindEnum, recurrenceKindEnum } from "./enums";

/**
 * `docs/architecture/design/schema.md` §4.10.
 *
 * Two shapes in one table, held apart by check constraints rather than by a
 * comment: a `DEADLINE` is one-off and has `done`; an `INFO` may span days or
 * recur, but never both. Expanding a recurrence into dates is T-012's
 * `recurrence.ts`, not a stored row.
 */
export const event = pgTable(
  "event",
  {
    id: primaryId(),
    userId: ownerId(),
    kind: eventKindEnum("kind").notNull(),
    /** Ukrainian — the teacher reads it. */
    title: text("title").notNull(),
    note: text("note"),
    /** `DEADLINE`: the due date. `INFO`: the first day. */
    dateFrom: date("date_from").notNull(),
    /** `INFO` only, inclusive; `NULL` means a one-day event. */
    dateTo: date("date_to"),
    /** `DEADLINE` only (glossary §5). */
    done: boolean("done"),
    /** `INFO` only. */
    recurrenceKind: recurrenceKindEnum("recurrence_kind")
      .notNull()
      .default("NONE"),
    /** Exclusive (§6); required exactly when the event recurs. */
    boundaryDate: date("boundary_date"),
    /** Display only; required exactly when the event recurs. */
    boundaryKind: boundaryKindEnum("boundary_kind"),
    ...timestamps(),
  },
  (t) => [
    check(
      "event_range_ck",
      sql`${t.dateTo} is null or ${t.dateFrom} <= ${t.dateTo}`,
    ),
    check(
      "event_done_ck",
      sql`(${t.kind} = 'DEADLINE') = (${t.done} is not null)`,
    ),
    // A DEADLINE is one-off: `done` is one field per event, so a repeating
    // deadline would close a whole series at once.
    check(
      "event_deadline_shape_ck",
      sql`${t.kind} <> 'DEADLINE' or (${t.dateTo} is null and ${t.recurrenceKind} = 'NONE')`,
    ),
    check(
      "event_recurrence_ck",
      sql`(${t.recurrenceKind} = 'NONE') = (${t.boundaryDate} is null and ${t.boundaryKind} is null)`,
    ),
    check(
      "event_boundary_ck",
      sql`${t.boundaryDate} is null or ${t.dateFrom} < ${t.boundaryDate}`,
    ),
    // A recurring event is one day per occurrence: "щотижня, по три дні" has no
    // expansion rule, so the shape is closed until one is written.
    check(
      "event_recurring_span_ck",
      sql`${t.recurrenceKind} = 'NONE' or ${t.dateTo} is null`,
    ),
    index("event_user_date_idx").on(t.userId, t.dateFrom),
    // A recurring event has to be read for windows its `date_from` is not
    // inside, so the date index cannot find it. The partial index is the whole
    // set of them and is read without a date filter; `recurrence_kind` is not a
    // column of it because the predicate has already selected on it.
    index("event_user_recurring_idx")
      .on(t.userId, t.dateFrom)
      .where(sql`${t.recurrenceKind} <> 'NONE'`),
  ],
);
