import { EventsList } from "@/components/events/events-list";
import { PAGE_LABELS } from "@/components/events/labels";
import { requireUser } from "@/lib/auth/session";
import { listEvents } from "@/lib/db/queries/events";

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
  // The boundary first, before anything reads (overview §8.3).
  const { id: userId } = await requireUser();
  const events = await listEvents(userId);

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{PAGE_LABELS.title}</h1>
        <p className="text-muted-foreground text-sm">{PAGE_LABELS.intro}</p>
      </div>

      <EventsList events={events} />
    </div>
  );
}
