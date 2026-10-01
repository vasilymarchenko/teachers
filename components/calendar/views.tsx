import Link from "next/link";
import type { ScheduleView } from "@/lib/db/schema/enums";
import type { CalendarDay } from "@/lib/domain/calendar/days";
import { isInMonthOf } from "@/lib/domain/calendar/views";
import { isoDayNumber } from "@/lib/domain/schedule/dates";
import type { IsoDate } from "@/lib/time/today";
import { cn } from "@/lib/utils";
import { DayCard } from "./day-card";
import { DayLessons, type DayEditing } from "./day-lessons";
import {
  capitalise,
  dayAndMonth,
  dayLinkName,
  dayNumber,
  dayTooltip,
  LESSON_LABELS,
  monthName,
  shortWeekdayName,
  weekdayName,
} from "./labels";
import { calendarHref } from "./links";

/**
 * The four views — one file, because they are four arrangements of the same
 * `CalendarDay[]` and nothing else (overview §5).
 *
 * All four are day-centric on a phone and gain their grid from `md` up
 * (overview §10.2): the week is seven `DayCard`s that become seven columns, the
 * month is a list of days that becomes a seven-column grid, and the year is
 * twelve month blocks that become two, three and four columns. Nothing here
 * computes a date — the days arrive expanded — and nothing holds state, so the
 * whole calendar is server-rendered and works with JavaScript off.
 */

type ViewProps = {
  days: CalendarDay[];
  schedule: ScheduleView;
  today: IsoDate;
};

/**
 * The day and the week are the two views specification §5.3 edits from, so they
 * are the two that take `editing`; the month and the year pass it nowhere.
 */
type EditableViewProps = ViewProps & { editing: DayEditing };

export function DayView({ days, today, editing }: EditableViewProps) {
  const [day] = days;
  if (day === undefined) return null;

  return (
    <DayCard
      day={day}
      editing={editing}
      isToday={day.date === today}
      title={capitalise(weekdayName(day.date))}
    />
  );
}

export function WeekView({ days, today, editing }: EditableViewProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {days.map((day) => (
        <DayCard
          day={day}
          editing={editing}
          headingLevel="h3"
          isToday={day.date === today}
          key={day.date}
          title={`${capitalise(shortWeekdayName(day.date))}, ${dayAndMonth(day.date)}`}
        />
      ))}
    </div>
  );
}

export function MonthView({
  days,
  schedule,
  today,
  anchor,
}: ViewProps & { anchor: IsoDate }) {
  return (
    <>
      {/* Phone: the day-centric list of overview §10.2, this month's days only
          — the padding days belong to the grid, which needs whole weeks; a
          list does not. */}
      <ul className="space-y-2 md:hidden">
        {days
          .filter((day) => isInMonthOf(day.date, anchor))
          .map((day) => (
            <li key={day.date}>
              <MonthDayRow day={day} schedule={schedule} today={today} />
            </li>
          ))}
      </ul>

      {/* Tablet and up: the grid, padded to whole weeks so every row has seven
          cells (`rangeFor("month", …)`). */}
      <div className="hidden md:block">
        <WeekdayHeadings dates={days.slice(0, 7).map((day) => day.date)} />
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => (
            <MonthCell
              day={day}
              inMonth={isInMonthOf(day.date, anchor)}
              key={day.date}
              schedule={schedule}
              today={today}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export function YearView({ days, schedule, today }: ViewProps) {
  const months = groupByMonth(days);

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {months.map(({ month, days: monthDays }) => (
        <section key={month}>
          <h3 className="mb-2 text-sm font-semibold">
            <Link
              className="hover:underline"
              href={calendarHref("month", monthDays[0].date, schedule)}
            >
              {monthName(monthDays[0].date)}
            </Link>
          </h3>
          <ul className="grid grid-cols-7 gap-0.5">
            {leadingBlanks(monthDays[0].date).map((index) => (
              <li aria-hidden key={`blank-${index}`} />
            ))}
            {monthDays.map((day) => (
              <li key={day.date}>
                <Link
                  className={cn(
                    "flex aspect-square items-center justify-center rounded text-xs",
                    day.isNonTeaching
                      ? "bg-muted text-muted-foreground"
                      : "bg-card border-border border",
                    // A day whose only lesson a `CLEARED` override removed is
                    // still a day with something on it: counting `lessons`
                    // alone would render it as a free day, which is the very
                    // thing specification §5.3 refuses.
                    day.lessons.length + day.cancelled.length > 0 &&
                      "font-semibold",
                    day.cancelled.length > 0 &&
                      "decoration-destructive underline decoration-2",
                    // An event is a mark on the date (specification §6.3); the
                    // cell has no room for its title, so the tooltip carries
                    // it and an overdue deadline colours the cell.
                    day.events.length > 0 && "font-semibold",
                    day.events.some((event) => event.isOverdue) &&
                      "text-destructive",
                    day.date === today && "ring-primary ring-2",
                  )}
                  href={calendarHref("day", day.date, schedule)}
                  title={dayTooltip(day)}
                >
                  {dayNumber(day.date)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * One day of the phone's month list. The whole card opens the day (T-042), and
 * it does so with a **stretched** link, not a wrapping one: `DayLessons` can
 * carry a link of its own — the Zoom address of a `CLASS` lesson — and a link
 * may not sit inside a link. So the heading's link is the day's one link, its
 * `::after` covers the card, and the lessons lie above it letting every click
 * through except the ones on their own links.
 *
 * Exported for `views.test.ts`, which pins the one link per day.
 */
export function MonthDayRow({
  day,
  schedule,
  today,
}: {
  day: CalendarDay;
  schedule: ScheduleView;
  today: IsoDate;
}) {
  return (
    <div
      className={cn(
        "hover:border-ring relative rounded-lg border p-3 hover:shadow-sm",
        day.isNonTeaching ? "border-border bg-muted/60" : "border-border bg-card",
        day.date === today && "ring-primary ring-2",
      )}
    >
      <h3 className="mb-1 text-sm font-semibold">
        <Link
          className="focus-visible:after:outline-ring outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-offset-2"
          href={calendarHref("day", day.date, schedule)}
        >
          <span aria-hidden>
            {capitalise(shortWeekdayName(day.date))}, {dayAndMonth(day.date)}
          </span>
          <span className="sr-only">{dayLinkName(day.date)}</span>
        </Link>
      </h3>
      <div className="pointer-events-none relative z-10 [&_a]:pointer-events-auto">
        <DayLessons day={day} />
      </div>
    </div>
  );
}

/**
 * One day of the month grid — the cell **is** the link to the day (T-042), so
 * a click on a lesson, an event or the empty part of it lands where a click on
 * the number does. Nothing interactive is rendered inside it; the day that
 * ever needs something interactive here switches to the stretched link of
 * `MonthDayRow` rather than nesting.
 *
 * The focus mark is an outline and not a ring: the ring is how today is shown.
 *
 * Exported for `views.test.ts`, which pins the one link per day.
 */
export function MonthCell({
  day,
  inMonth,
  schedule,
  today,
}: {
  day: CalendarDay;
  inMonth: boolean;
  schedule: ScheduleView;
  today: IsoDate;
}) {
  return (
    <Link
      className={cn(
        "block min-h-24 rounded border p-1 text-xs",
        "hover:border-ring focus-visible:outline-ring hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2",
        day.isNonTeaching ? "border-border bg-muted/60" : "border-border bg-card",
        // The days spilling in from the neighbouring months are real days, and
        // clickable, but they must not read as part of this month.
        !inMonth && "opacity-50",
        day.date === today && "ring-primary ring-2",
      )}
      href={calendarHref("day", day.date, schedule)}
    >
      {/* The link is named by its date, not by a bare «19»: the name a screen
          reader announces starts with «понеділок, 19 жовтня» and goes on to
          what the day holds. */}
      <span aria-hidden className="font-semibold">
        {dayNumber(day.date)}
      </span>
      <span className="sr-only">{dayLinkName(day.date)}</span>
      {day.isNonTeaching && day.nonTeachingName !== undefined && (
        <span className="text-muted-foreground block truncate">
          {day.nonTeachingName}
        </span>
      )}
      <ul className="mt-1 space-y-0.5">
        {day.lessons.map((lesson) => (
          <li className="truncate" key={`lesson-${lesson.lessonNumber}`}>
            {lesson.lessonNumber} · {lesson.payload.subject}
            {lesson.origin === "SUBSTITUTION" &&
              ` (${LESSON_LABELS.substitution})`}
          </li>
        ))}
        {day.cancelled.map((lesson) => (
          <li
            className="text-muted-foreground truncate line-through"
            key={`cancelled-${lesson.lessonNumber}`}
          >
            {lesson.lessonNumber} · {lesson.payload.subject}
          </li>
        ))}
        {day.events.map((event) => (
          <li
            className={cn(
              "truncate",
              event.isOverdue && "text-destructive",
              event.done === true && "text-muted-foreground line-through",
            )}
            key={`event-${event.id}`}
          >
            {event.kind === "DEADLINE" ? "◷" : "•"} {event.title}
          </li>
        ))}
      </ul>
    </Link>
  );
}

/** «пн вт ср …» over the grid — taken from the grid's own first week. */
function WeekdayHeadings({ dates }: { dates: IsoDate[] }) {
  return (
    <div className="text-muted-foreground mb-1 grid grid-cols-7 gap-1 text-xs">
      {dates.map((date) => (
        <p key={date}>{shortWeekdayName(date)}</p>
      ))}
    </div>
  );
}

function groupByMonth(
  days: CalendarDay[],
): { month: string; days: CalendarDay[] }[] {
  const months = new Map<string, CalendarDay[]>();
  for (const day of days) {
    const month = day.date.slice(0, 7);
    const existing = months.get(month);
    if (existing === undefined) months.set(month, [day]);
    else existing.push(day);
  }
  return [...months].map(([month, monthDays]) => ({ month, days: monthDays }));
}

/**
 * The empty cells before the first day of a month block, so its columns line up
 * Monday-first (overview §8.5). A year view starts mid-month — the academic
 * year begins on 1 September, but the first block of a calendar-year fallback
 * need not — so the offset is taken from the first day actually present.
 */
function leadingBlanks(firstDate: IsoDate): number[] {
  // `isoDayNumber` is 1 on Monday, so Monday needs no blank and Sunday needs
  // six.
  return Array.from({ length: isoDayNumber(firstDate) - 1 }, (_, i) => i);
}
