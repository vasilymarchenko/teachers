import type { CalendarDay } from "@/lib/domain/calendar/days";
import { cn } from "@/lib/utils";
import { PARITY_LABELS } from "./labels";
import { DayLessons } from "./day-lessons";

/**
 * One day with its own heading — the block the day view shows alone and the
 * week view stacks seven of at phone width (overview §10.2).
 *
 * A non-teaching day is shaded and says why (`nonTeachingName`), which is what
 * separates it from a teaching day that simply has no lessons — the pair the
 * fixture pins on 2026-10-16 and 2026-10-19.
 */
export function DayCard({
  day,
  title,
  isToday = false,
  headingLevel = "h2",
}: {
  day: CalendarDay;
  title: string;
  isToday?: boolean;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;

  return (
    <section
      className={cn(
        "rounded-lg border p-4",
        day.isNonTeaching
          ? "border-border bg-muted/60"
          : "border-border bg-card",
        isToday && "ring-primary ring-2",
      )}
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Heading className="text-base font-semibold">{title}</Heading>
        <p className="text-muted-foreground text-xs">
          {PARITY_LABELS[day.parity]}
          {isToday && " · сьогодні"}
        </p>
      </div>
      <DayLessons day={day} />
    </section>
  );
}
