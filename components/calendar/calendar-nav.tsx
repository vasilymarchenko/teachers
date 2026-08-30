import Link from "next/link";
import type { ScheduleView } from "@/lib/db/schema/enums";
import {
  CALENDAR_VIEWS,
  stepBy,
  type CalendarViewName,
} from "@/lib/domain/calendar/views";
import type { DateRange } from "@/lib/domain/schedule/types";
import type { IsoDate } from "@/lib/time/today";
import { cn } from "@/lib/utils";
import {
  NAV_LABELS,
  NEXT_LABELS,
  PREVIOUS_LABELS,
  SCHEDULE_LABELS,
  VIEW_LABELS,
} from "./labels";
import { calendarHref } from "./links";

/**
 * The calendar's controls — specification §6.1 and §6.2.
 *
 * Everything here is a link: the view switch, the ← → steps, the quick jumps
 * and the «Мої уроки» / «Уроки класу» switch all just point at another
 * `/calendar/<view>/<date>` URL. No client component, no state, and every
 * position of the calendar can be bookmarked or sent to someone.
 *
 * The quick jumps of §6.1 need the teacher's `AcademicYear`: without one
 * (before the year setup of T-009 has run) they are simply absent rather than
 * pointing at a guessed date.
 */
export function CalendarNav({
  view,
  date,
  schedule,
  today,
  yearRange,
}: {
  view: CalendarViewName;
  date: IsoDate;
  schedule: ScheduleView;
  today: IsoDate;
  yearRange?: DateRange;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <NavLink href={calendarHref(view, stepBy(view, date, -1), schedule)}>
          <span aria-hidden>←</span>
          <span className="sr-only">{PREVIOUS_LABELS[view]}</span>
        </NavLink>
        <NavLink href={calendarHref(view, today, schedule)}>
          {NAV_LABELS.today}
        </NavLink>
        <NavLink href={calendarHref(view, stepBy(view, date, 1), schedule)}>
          <span aria-hidden>→</span>
          <span className="sr-only">{NEXT_LABELS[view]}</span>
        </NavLink>

        <nav aria-label={NAV_LABELS.viewSwitch} className="ml-auto flex gap-1">
          {CALENDAR_VIEWS.map((name) => (
            <NavLink
              current={name === view}
              href={calendarHref(name, date, schedule)}
              key={name}
            >
              {VIEW_LABELS[name]}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label={NAV_LABELS.scheduleSwitch} className="flex gap-1">
          {(["OWN", "CLASS"] as const).map((name) => (
            <NavLink
              current={name === schedule}
              href={calendarHref(view, date, name)}
              key={name}
            >
              {SCHEDULE_LABELS[name]}
            </NavLink>
          ))}
        </nav>

        {yearRange !== undefined && (
          <nav aria-label={NAV_LABELS.quickJumps} className="flex flex-wrap gap-1">
            <NavLink href={calendarHref("year", yearRange.from, schedule)}>
              {NAV_LABELS.wholeYear}
            </NavLink>
            <NavLink href={calendarHref("month", yearRange.from, schedule)}>
              {yearRange.from.slice(5, 7) === "09"
                ? NAV_LABELS.toSeptember
                : NAV_LABELS.toYearStart}
            </NavLink>
            <NavLink href={calendarHref("month", yearRange.to, schedule)}>
              {NAV_LABELS.yearEnd}
            </NavLink>
          </nav>
        )}
      </div>
    </div>
  );
}

function NavLink({
  href,
  children,
  current = false,
}: {
  href: string;
  children: React.ReactNode;
  current?: boolean;
}) {
  return (
    <Link
      aria-current={current ? "page" : undefined}
      className={cn(
        "border-border rounded-md border px-3 py-1.5 text-sm",
        current
          ? "bg-primary text-primary-foreground border-transparent"
          : "bg-card hover:bg-accent hover:text-accent-foreground",
      )}
      href={href}
    >
      {children}
    </Link>
  );
}
