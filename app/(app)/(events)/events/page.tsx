import { EventsList } from "@/components/events/events-list";
import { PAGE_LABELS } from "@/components/events/labels";
import { requireCompleteSetup } from "@/lib/auth/setupGate";
import { getBoundaryFrame } from "@/lib/db/queries/boundaryFrame";
import { listEvents, type EventEditRow } from "@/lib/db/queries/events";
import { restatedBoundary } from "@/lib/domain/schedule/boundaries";
import type { IsoDate } from "@/lib/time/today";

// The teacher's own data, read per request; nothing may be frozen into the
// build.
export const dynamic = "force-dynamic";

/**
 * Events — specification §6.3, the screen both kinds are entered on.
 *
 * One read and one component: an event belongs to no `AcademicYear` (schema
 * §4.10), so unlike the year setup there is nothing to select and no `?year=`
 * to carry. What the calendar then does with these rows is
 * `lib/domain/events` — the recurrence is expanded on the calendar's side, not
 * stored per occurrence.
 */
export default async function Page() {
  // The boundary first, before anything reads (overview §8.3), and the
  // year-setup gate with it (§8.6).
  const { id: userId } = await requireCompleteSetup();
  const events = await listEvents(userId);
  const restated = await restatedBoundaries(userId, events);

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{PAGE_LABELS.title}</h1>
        <p className="text-muted-foreground text-sm">{PAGE_LABELS.intro}</p>
      </div>

      <EventsList events={events} restated={restated} />
    </div>
  );
}

/**
 * The repeating events whose symbolic boundary a save would now move — T-047,
 * overview §8.1. Each is resolved the way `lib/actions/events.ts` resolves it:
 * against the year of the event's own first date, from that date.
 *
 * One frame read per such event. They are the few events that repeat «до
 * канікул» or «до кінця семестру», not the whole list.
 */
async function restatedBoundaries(
  userId: string,
  events: readonly EventEditRow[],
): Promise<Map<string, IsoDate>> {
  const restated = new Map<string, IsoDate>();

  await Promise.all(
    events.map(async (event) => {
      const { boundaryKind, boundaryDate } = event;
      if (boundaryKind === null || boundaryKind === "DATE") return;
      if (boundaryDate === null) return;

      const frame = await getBoundaryFrame(userId, event.dateFrom);
      if (frame === null) return;

      const date = restatedBoundary(
        { boundaryKind, boundaryDate },
        {
          referenceDate: event.dateFrom,
          breaks: frame.breaks,
          semesters: frame.semesters,
        },
      );
      if (date !== undefined) restated.set(event.id, date);
    }),
  );

  return restated;
}
