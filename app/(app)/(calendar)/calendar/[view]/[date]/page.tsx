import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarNav } from "@/components/calendar/calendar-nav";
import {
  EDIT_LABELS,
  periodTitle,
  YEAR_NOT_SET_UP,
} from "@/components/calendar/labels";
import {
  scheduleViewOf,
  type SearchParamValue,
} from "@/components/calendar/links";
import {
  DayView,
  MonthView,
  WeekView,
  YearView,
} from "@/components/calendar/views";
import { requireUser } from "@/lib/auth/session";
import { getNonTeachingPeriods } from "@/lib/db/queries/calendarRules";
import { getEventsInRange } from "@/lib/db/queries/events";
import { getScheduleInput } from "@/lib/db/queries/scheduleInput";
import { getYearFrame, type YearFrame } from "@/lib/db/queries/yearFrame";
import { buildCalendarDays } from "@/lib/domain/calendar/days";
import { eventMarksByDate } from "@/lib/domain/events/marks";
import { isCalendarViewName, rangeFor } from "@/lib/domain/calendar/views";
import { isIsoDate } from "@/lib/domain/schedule/dates";
import type { DateRange } from "@/lib/domain/schedule/types";
import { today } from "@/lib/time/today";

// The calendar reads the teacher's data per request; nothing may be frozen
// into the build.
export const dynamic = "force-dynamic";

/**
 * The calendar — specification §6, overview §5.
 *
 * One page for all four views, because a view *is* a range: `rangeFor()` turns
 * the URL into `[from, to]`, `getScheduleInput()` reads that window and
 * `buildCalendarDays()` expands it. Day, week, month and year differ in the
 * range and in the component that arranges the result, in nothing else.
 *
 * Three reads, not one: `getScheduleInput()` is exactly what `expand()` takes,
 * naming a shaded day needs the `NonTeachingPeriod` rows themselves
 * (`docs/architecture/design/T-008-calendar-read-queries.md` §1 left that call
 * to this screen), and the events of §6.3 are a fourth source of their own.
 * They run concurrently, so it is one round trip's worth of latency, and
 * `ScheduleInput` stays the domain's input rather than growing a field for the
 * sake of a heading or a deadline.
 *
 * The events arrive as rows and are expanded here (`eventMarksByDate()`, T-012)
 * because a repeating event has no row per occurrence — the same decision the
 * schedule makes with `expand()`. `today()` is read once, on this side, and
 * handed to the domain, which has no clock (overview §8.5).
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ view: string; date: string }>;
  searchParams: Promise<{ schedule?: SearchParamValue }>;
}) {
  // The boundary first, before anything reads or answers (overview §8.3).
  const { id: userId } = await requireUser();

  const { view, date } = await params;
  const { schedule: scheduleParam } = await searchParams;

  // A hand-typed URL is the only way to get here with either of these wrong,
  // and answering it with a guessed date would show the teacher a day she did
  // not ask for.
  if (!isCalendarViewName(view) || !isIsoDate(date)) notFound();

  const schedule = scheduleViewOf(scheduleParam);

  // The year frame bounds the year view and feeds the quick jumps of §6.1;
  // `null` before the year setup of T-009 has run, which is a normal state and
  // not an error. Only the year view's range depends on it, so the other three
  // read it alongside their data instead of waiting for it first.
  const framePromise = getYearFrame(userId, date);
  const range =
    view === "year"
      ? rangeFor(view, date, rangeOfFrame(await framePromise))
      : rangeFor(view, date);

  const [frame, input, periods, events] = await Promise.all([
    framePromise,
    getScheduleInput(userId, range),
    getNonTeachingPeriods(userId, range),
    getEventsInRange(userId, range),
  ]);
  const yearRange = rangeOfFrame(frame);

  const now = today();
  const days = buildCalendarDays(
    input,
    { ...range, view: schedule },
    periods,
    eventMarksByDate(events, range, now),
  );
  const viewProps = { days, schedule, today: now };
  // Editing starts from the day and the week, the two views a lesson is
  // legible in (specification §5.3, ADR-008); the month and year cells open
  // the day instead. `bells` is where «додати урок» takes its lesson numbers
  // from, and it is already in the input `expand()` was given.
  const editing = { view, schedule, bells: input.bells };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">
        {periodTitle(view, date, range, frame !== null)}
      </h1>

      <CalendarNav
        date={date}
        schedule={schedule}
        today={viewProps.today}
        view={view}
        yearRange={yearRange}
      />

      {frame === null && (
        <p className="text-muted-foreground text-sm">
          {YEAR_NOT_SET_UP.before}
          <Link className="underline underline-offset-2" href="/year">
            {YEAR_NOT_SET_UP.link}
          </Link>
          {YEAR_NOT_SET_UP.after}
        </p>
      )}

      {/* The dead end «Додати урок» has without a `BellSchedule`, said once
          for the screen rather than once per day: the week view renders seven
          days, and seven copies of one notice with seven links to `/year` is
          what a freshly set-up account would meet. Only the two editable views
          can hit it — the month and year cells offer no «додати урок». */}
      {editing.bells.length === 0 && (view === "day" || view === "week") && (
        <p className="text-muted-foreground text-sm">
          {EDIT_LABELS.noBells} —{" "}
          <Link className="underline underline-offset-2" href="/year">
            {EDIT_LABELS.toBells}
          </Link>
        </p>
      )}

      {view === "day" && <DayView {...viewProps} editing={editing} />}
      {view === "week" && <WeekView {...viewProps} editing={editing} />}
      {view === "month" && <MonthView {...viewProps} anchor={date} />}
      {view === "year" && <YearView {...viewProps} />}
    </div>
  );
}

function rangeOfFrame(frame: YearFrame | null): DateRange | undefined {
  return frame === null
    ? undefined
    : { from: frame.dateFrom, to: frame.dateTo };
}
