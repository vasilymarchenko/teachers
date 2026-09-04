import type { Parity, ScheduleView, Weekday } from "@/lib/db/schema/enums";
import type { TemplateSlotInput } from "@/lib/domain/schedule/types";
import { WEEKDAY_VALUES } from "@/lib/validation/enums";
import { cn } from "@/lib/utils";
import { DayForm } from "./day-form";
import type { LessonRow } from "./lessonRows";

/**
 * The week as seven days — overview §10.2, the day-centric flow Q-002 settled
 * on.
 *
 * The wrapper is the grid and the day is the component, never the other way
 * round. Below the tablet breakpoint only the selected day is on the screen and
 * the day switcher moves between them; from `md` up all seven are, in columns.
 *
 * All seven are rendered either way, and the narrow screen hides six with CSS
 * rather than the server sending one. That is what keeps the day switcher a set
 * of plain links — no round trip, nothing to re-fetch, and a phone with
 * JavaScript off still moves between days.
 *
 * How many columns depends on the view, because the cell does: «мої уроки» has
 * two fields and fits seven columns on a wide screen, «уроки класу» has four
 * and wraps instead of squeezing a Zoom link into a seventh of the width
 * (specification §5.1).
 */
export function WeekGrid({
  view,
  parity,
  selected,
  rows,
  slots,
}: {
  view: ScheduleView;
  parity: Parity;
  /** The day a narrow screen shows. */
  selected: Weekday;
  rows: readonly LessonRow[];
  /** Every slot of the version in force, both parity weeks. */
  slots: readonly TemplateSlotInput[];
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        view === "OWN"
          ? "md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
          : "md:grid-cols-2 xl:grid-cols-3",
      )}
    >
      {WEEKDAY_VALUES.map((weekday) => (
        <div
          className={cn("md:block", weekday === selected ? "block" : "hidden")}
          key={weekday}
        >
          <DayForm
            parity={parity}
            rows={rows}
            slots={slots.filter(
              (slot) => slot.weekday === weekday && slot.parity === parity,
            )}
            view={view}
            weekday={weekday}
          />
        </div>
      ))}
    </div>
  );
}
