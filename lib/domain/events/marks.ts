import type { EventKind } from "@/lib/db/schema/enums";
import type { DateRange } from "@/lib/domain/schedule/types";
import type { IsoDate } from "@/lib/time/today";
import { occurrencesInRange, type RecurrenceInput } from "./recurrence";

/**
 * The events of a window, by the date they fall on — what a calendar screen
 * hangs on its days (specification §6.3).
 *
 * It sits beside `recurrence.ts` rather than inside it because it answers a
 * different question: `recurrence.ts` says *when* an event happens, this says
 * *what the calendar shows* on a date once it does. The overdue rule is the
 * whole of the difference, and it belongs here for the reason `CalendarDay`
 * exists at all (overview §5): the day view, the week grid, the month grid, the
 * year grid and the printed page all need the same answer, and five components
 * computing it five ways is what §5 refuses.
 */

/** An `Event` row as the calendar reads it — `EventRow` of `queries/events.ts`. */
export type EventInput = RecurrenceInput & {
  id: string;
  kind: EventKind;
  /** Ukrainian — the teacher reads it. */
  title: string;
  note: string | null;
  /** `DEADLINE` only (glossary §5). */
  done: boolean | null;
};

/**
 * One event on one date.
 *
 * It carries no date of its own: the date is the key it is filed under, and a
 * recurring event is the same row on many of them. `id` is what the «виконано»
 * toggle addresses, so a deadline is still one row with one state — overview §4,
 * which is also why a deadline never recurs.
 */
export type EventMark = {
  id: string;
  kind: EventKind;
  /** Ukrainian — the teacher reads it. */
  title: string;
  note: string | null;
  /** `DEADLINE` only; `null` for an `INFO` event, which has no such state. */
  done: boolean | null;
  /**
   * A deadline whose date has passed and that is not done — «виділення
   * прострочених», specification §6.3.
   *
   * Always `false` for an `INFO` event: it is something that happens, not
   * something to do, so there is nothing for it to be late for.
   */
  isOverdue: boolean;
};

/**
 * Every event of the window, filed under the dates it occurs on.
 *
 * `today` is a parameter and never `new Date()` — the domain has no clock
 * (overview §8.5), and the caller takes it from `lib/time/today.ts`.
 *
 * The order inside a date is the order the rows arrive in, which
 * `getEventsInRange()` fixes as `date_from`, then `title`: a stable order the
 * teacher can read down, and the same one in every view.
 */
export function eventMarksByDate(
  events: readonly EventInput[],
  range: DateRange,
  today: IsoDate,
): Map<IsoDate, EventMark[]> {
  const byDate = new Map<IsoDate, EventMark[]>();

  for (const event of events) {
    for (const date of occurrencesInRange(event, range)) {
      const marks = byDate.get(date);
      const mark = markOf(event, date, today);
      if (marks === undefined) byDate.set(date, [mark]);
      else marks.push(mark);
    }
  }

  return byDate;
}

/**
 * A deadline is overdue on a date **before** today: one due today is still due,
 * not late, which is the only reading that does not tell the teacher she has
 * missed something she has all day to do.
 */
function markOf(event: EventInput, date: IsoDate, today: IsoDate): EventMark {
  return {
    id: event.id,
    kind: event.kind,
    title: event.title,
    note: event.note,
    done: event.done,
    isOverdue: event.kind === "DEADLINE" && event.done !== true && date < today,
  };
}
