import type { EventEditRow } from "@/lib/db/queries/events";
import { Empty, Section } from "@/components/year/section";
import { DeadlineForm, InfoEventForm } from "./event-form";
import {
  DEADLINES_SECTION,
  DONE_LABELS,
  eventSchedule,
  INFO_SECTION,
} from "./labels";

/**
 * The events screen — specification §6.3, one section per kind.
 *
 * Two sections and not one list, because the two kinds are edited differently:
 * a deadline asks for a date and carries «виконано», an information event may
 * span days or repeat. Sorting them into one list would put a form beside a
 * different form and make the screen explain, row by row, which fields apply.
 *
 * The sections reuse the year setup's frame (`components/year/section.tsx`) so
 * that the screens a teacher fills in read as one thing — the same reason the
 * weekly template editor reuses it.
 */
export function EventsList({ events }: { events: EventEditRow[] }) {
  const deadlines = events.filter((event) => event.kind === "DEADLINE");
  const infoEvents = events.filter((event) => event.kind === "INFO");

  return (
    <>
      <Section
        description={DEADLINES_SECTION.description}
        title={DEADLINES_SECTION.title}
      >
        {deadlines.length === 0 ? (
          <Empty>{DEADLINES_SECTION.empty}</Empty>
        ) : (
          <div className="space-y-3">
            {deadlines.map((event) => (
              <div className="space-y-1" key={event.id}>
                <EventCaption event={event} />
                <DeadlineForm event={event} />
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{DEADLINES_SECTION.addTitle}</h3>
          <DeadlineForm />
        </div>
      </Section>

      <Section description={INFO_SECTION.description} title={INFO_SECTION.title}>
        {infoEvents.length === 0 ? (
          <Empty>{INFO_SECTION.empty}</Empty>
        ) : (
          <div className="space-y-3">
            {infoEvents.map((event) => (
              <div className="space-y-1" key={event.id}>
                <EventCaption event={event} />
                <InfoEventForm event={event} />
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{INFO_SECTION.addTitle}</h3>
          <InfoEventForm />
        </div>
      </Section>
    </>
  );
}

/**
 * What the row says about itself above its form: when it happens, and — for a
 * deadline — whether it is done.
 *
 * The done state is shown and not edited here: it is toggled from the calendar,
 * where the teacher meets the deadline on its date (specification §6.3).
 */
function EventCaption({ event }: { event: EventEditRow }) {
  return (
    <p className="text-muted-foreground text-xs">
      {eventSchedule(event)}
      {event.kind === "DEADLINE" &&
        ` · ${event.done === true ? DONE_LABELS.done : DONE_LABELS.notDone}`}
    </p>
  );
}
