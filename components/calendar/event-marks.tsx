import type { EventMark } from "@/lib/domain/events/marks";
import { cn } from "@/lib/utils";
import { DONE_LABELS, EVENT_KIND_LABELS } from "@/components/events/labels";
import { EventDoneToggle } from "./event-done-toggle";

/**
 * The events of one day — specification §6.3, «події… позначкою на даті (і
 * виділенням прострочених)».
 *
 * A deadline that is done is struck through and a deadline that is overdue is
 * marked in the destructive colour; an information event is neither, because it
 * has no state to be in. The overdue answer is not computed here — it arrives on
 * the mark (`lib/domain/events/marks.ts`), so that the day, the week, the month
 * and the year say the same thing about the same date.
 *
 * `editable` is the day and week views, where the «виконано» toggle is offered
 * (ADR-008: the month and year cells open the day instead).
 */
export function EventMarks({
  events,
  editable = false,
}: {
  events: EventMark[];
  editable?: boolean;
}) {
  if (events.length === 0) return null;

  return (
    <ul className="space-y-1 text-sm">
      {events.map((event) => (
        <li key={event.id}>
          <span
            className={cn(
              "flex flex-wrap items-baseline gap-x-2",
              event.isOverdue && "text-destructive",
              event.done === true && "text-muted-foreground line-through",
            )}
          >
            <span aria-hidden>{event.kind === "DEADLINE" ? "◷" : "•"}</span>
            <span className="sr-only">{EVENT_KIND_LABELS[event.kind]}</span>
            <span>{event.title}</span>
            {event.isOverdue && (
              <span className="text-xs">{DONE_LABELS.overdue}</span>
            )}
          </span>
          {event.note !== null && (
            <p className="text-muted-foreground text-xs">{event.note}</p>
          )}
          {editable && event.kind === "DEADLINE" && (
            <EventDoneToggle done={event.done === true} eventId={event.id} />
          )}
        </li>
      ))}
    </ul>
  );
}
