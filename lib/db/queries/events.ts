import { and, asc, desc, eq, gt, gte, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { event } from "@/lib/db/schema";
import type {
  BoundaryKind,
  EventKind,
  RecurrenceKind,
} from "@/lib/db/schema/enums";
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

/**
 * An `Event` as the `/events` screen edits it — every column a form writes.
 *
 * It is `EventRow` plus `boundaryKind`, which the calendar has no use for and
 * the editor cannot do without: the symbol is what the teacher chose («до
 * найближчих канікул»), and the resolved date alone could not put the form back
 * the way she left it (overview §8.1).
 */
export type EventEditRow = EventRow & {
  /** Display only; present exactly when the event recurs. */
  boundaryKind: BoundaryKind | null;
};

/**
 * Every event of the teacher, newest date first — the `/events` screen
 * (specification §6.3).
 *
 * Not scoped to a range or to an `AcademicYear`: an event belongs to no year
 * (schema §4.10 has no `academic_year_id`), and the screen is the one place
 * where an event dated outside the year in view must still be findable. The
 * order puts what is coming up and what has just passed at the top, which is
 * where a teacher looks first; `title` breaks the tie so the list is stable.
 */
export async function listEvents(userId: string): Promise<EventEditRow[]> {
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
      boundaryKind: event.boundaryKind,
    })
    .from(event)
    .where(eq(event.userId, userId))
    .orderBy(desc(event.dateFrom), asc(event.title));
}
