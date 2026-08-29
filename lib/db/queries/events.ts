import { and, asc, eq, gt, gte, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { event } from "@/lib/db/schema";
import type { EventKind, RecurrenceKind } from "@/lib/db/schema/enums";
import type { DateRange } from "@/lib/domain/schedule/types";
import type { IsoDate } from "@/lib/time/today";

/**
 * An `Event` row as the calendar and T-012's `recurrence.ts` read it.
 *
 * The enum unions come from `lib/db/schema/enums.ts` rather than being spelled
 * again here: a value added by a migration must not leave a second, narrower
 * copy of the set behind (schema §2).
 */
export type EventRow = {
  id: string;
  kind: EventKind;
  /** Ukrainian — the teacher reads it. */
  title: string;
  note: string | null;
  dateFrom: IsoDate;
  /** `INFO` only, inclusive; `null` is a one-day event. */
  dateTo: IsoDate | null;
  /** `DEADLINE` only (glossary §5). */
  done: boolean | null;
  recurrenceKind: RecurrenceKind;
  /** Exclusive; present exactly when the event recurs. */
  boundaryDate: IsoDate | null;
};

/**
 * The `Event` rows a window has to render — overview §5, schema §4.10.
 *
 * Two shapes in one read, because they are found by two different indexes:
 *
 *  - a **one-off** event occupies `[date_from, coalesce(date_to, date_from)]`
 *    and overlaps the window the ordinary way (`event_user_date_idx`);
 *  - a **recurring** event has to be returned for windows its `date_from` is
 *    not inside at all — a `YEARLY` event from September is due in November —
 *    so it is selected by its validity `[date_from, boundary_date)` instead
 *    (`event_user_recurring_idx`, the partial index schema §4.10 describes).
 *
 * Expanding a recurrence into dates is T-012's `recurrence.ts`; this returns the
 * rows it expands, which is why `boundary_date` and `recurrence_kind` are
 * selected. A recurring row returned here may well produce no occurrence inside
 * the window — that is T-012's answer to give, not this query's.
 */
export async function getEventsInRange(
  userId: string,
  range: DateRange,
): Promise<EventRow[]> {
  return getDb()
    .select({
      id: event.id,
      kind: event.kind,
      title: event.title,
      note: event.note,
      dateFrom: event.dateFrom,
      dateTo: event.dateTo,
      done: event.done,
      recurrenceKind: event.recurrenceKind,
      boundaryDate: event.boundaryDate,
    })
    .from(event)
    .where(
      and(
        eq(event.userId, userId),
        or(
          and(
            eq(event.recurrenceKind, "NONE"),
            lte(event.dateFrom, range.to),
            gte(sql`coalesce(${event.dateTo}, ${event.dateFrom})`, range.from),
          ),
          and(
            ne(event.recurrenceKind, "NONE"),
            lte(event.dateFrom, range.to),
            gt(event.boundaryDate, range.from),
          ),
        ),
      ),
    )
    .orderBy(asc(event.dateFrom), asc(event.title));
}
