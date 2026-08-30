import Link from "next/link";
import type { ScheduleView } from "@/lib/db/schema/enums";
import type { CalendarDay } from "@/lib/domain/calendar/days";
import { isInMonthOf } from "@/lib/domain/calendar/views";
import { isoDayNumber } from "@/lib/domain/schedule/dates";
import type { IsoDate } from "@/lib/time/today";
import { cn } from "@/lib/utils";
import { DayCard } from "./day-card";
import { DayLessons } from "./day-lessons";
import {
  capitalise,
  dayAndMonth,
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

export function DayView({ days, today }: ViewProps) {
  const [day] = days;
  if (day === undefined) return null;

  return (
    <DayCard
      day={day}
      isToday={day.date === today}
      title={capitalise(weekdayName(day.date))}
    />
  );
}

export function WeekView({ days, today }: ViewProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {days.map((day) => (
        <DayCard
          day={day}
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

function MonthDayRow({
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
        "rounded-lg border p-3",
        day.isNonTeaching ? "border-border bg-muted/60" : "border-border bg-card",
        day.date === today && "ring-primary ring-2",
      )}
    >
      <h3 className="mb-1 text-sm font-semibold">
        <Link
          className="hover:underline"
          href={calendarHref("day", day.date, schedule)}
        >
          {capitalise(shortWeekdayName(day.date))}, {dayAndMonth(day.date)}
        </Link>
      </h3>
      <DayLessons day={day} />
    </div>
  );
}

function MonthCell({
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
    <div
      className={cn(
        "min-h-24 rounded border p-1 text-xs",
        day.isNonTeaching ? "border-border bg-muted/60" : "border-border bg-card",
        // The days spilling in from the neighbouring months are real days, and
        // clickable, but they must not read as part of this month.
        !inMonth && "opacity-50",
        day.date === today && "ring-primary ring-2",
      )}
    >
      <Link
        className="font-semibold hover:underline"
        href={calendarHref("day", day.date, schedule)}
      >
        {dayNumber(day.date)}
      </Link>
      {day.isNonTeaching && day.nonTeachingName !== undefined && (
        <p className="text-muted-foreground truncate">{day.nonTeachingName}</p>
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
      </ul>
    </div>
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
