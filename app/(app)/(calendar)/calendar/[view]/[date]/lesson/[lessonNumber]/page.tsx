import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fullDate,
  OVERRIDE_LABELS,
  PARITY_LABELS,
  weekdayName,
  capitalise,
} from "@/components/calendar/labels";
import { LessonRow } from "@/components/calendar/lesson-row";
import {
  calendarHref,
  scheduleViewOf,
  type SearchParamValue,
} from "@/components/calendar/links";
import {
  ClearLessonForm,
  RemoveOverrideForm,
} from "@/components/calendar/override-actions";
import { OverrideForm } from "@/components/calendar/override-form";
import { Section } from "@/components/year/section";
import { requireUser } from "@/lib/auth/session";
import { getNonTeachingPeriods } from "@/lib/db/queries/calendarRules";
import { getDayOverride } from "@/lib/db/queries/overrides";
import { getScheduleInput } from "@/lib/db/queries/scheduleInput";
import {
  buildCalendarDays,
  buildPlannedDays,
} from "@/lib/domain/calendar/days";
import { isCalendarViewName } from "@/lib/domain/calendar/views";
import { isIsoDate } from "@/lib/domain/schedule/dates";
import type { ResolvedLesson } from "@/lib/domain/schedule/types";
import { parseLessonNumber } from "@/lib/validation/dayOverride";

// One teacher's data for one date, read per request; nothing may be frozen
// into the build.
export const dynamic = "force-dynamic";

/**
 * Editing one lesson of one date — specification §5.3 and §5.4, overview §3.4,
 * `decisions/ADR-008-calendar-edits-have-their-own-route.md`.
 *
 * The screen is the slot: `/calendar/<view>/<date>/lesson/<n>` names exactly the
 * row `day_override_slot_uq` holds, and the `<view>` segment is the calendar
 * view the teacher came from, so «Повернутися» goes back to it. `?schedule=`
 * carries the `OWN` / `CLASS` switch of §6.2 as everywhere else — an override
 * belongs to one of the two schedules.
 *
 * It shows three things before it shows a form, because all three are needed to
 * understand what a save will do:
 *
 *  - what the calendar shows on this slot now;
 *  - what the weekly template gives underneath it (`buildPlannedDays()`) —
 *    which is what a `SUBSTITUTION` will display beside itself and what
 *    «Прибрати правку» restores;
 *  - whether an override is in force, and of which kind. That last one cannot
 *    be read off the expansion: a `CLEARED` row over an empty slot and no row
 *    at all resolve to the same empty day (fixtures §8.8), so the row itself is
 *    read by `getDayOverride()`.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ view: string; date: string; lessonNumber: string }>;
  searchParams: Promise<{ schedule?: SearchParamValue }>;
}) {
  // The boundary first, before anything reads or answers (overview §8.3).
  const { id: userId } = await requireUser();

  const { view, date, lessonNumber: lessonSegment } = await params;
  const { schedule: scheduleParam } = await searchParams;

  const lessonNumber = parseLessonNumber(lessonSegment);
  // A hand-typed URL is the only way here with any of the three wrong, and
  // guessing a slot would edit a day the teacher did not ask for.
  if (!isCalendarViewName(view) || !isIsoDate(date) || lessonNumber === undefined) {
    notFound();
  }

  const schedule = scheduleViewOf(scheduleParam);
  const range = { from: date, to: date };
  const request = { ...range, view: schedule };

  const [input, periods, override] = await Promise.all([
    getScheduleInput(userId, range),
    getNonTeachingPeriods(userId, range),
    getDayOverride(userId, date, schedule, lessonNumber),
  ]);

  const [day] = buildCalendarDays(input, request, periods);
  const [planned] = buildPlannedDays(input, request);

  const current = lessonOn(day.lessons, lessonNumber);
  const cancelled = lessonOn(day.cancelled, lessonNumber);
  const plannedLesson = lessonOn(planned.lessons, lessonNumber);

  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {OVERRIDE_LABELS.title(lessonNumber, date)}
        </h1>
        <p className="text-muted-foreground text-sm">
          {PARITY_LABELS[day.parity]}
          {day.isNonTeaching && day.nonTeachingName !== undefined &&
            ` · ${day.nonTeachingName}`}
        </p>
        <p className="text-muted-foreground text-sm">{OVERRIDE_LABELS.intro}</p>
      </div>

      <Section
        title={OVERRIDE_LABELS.currentTitle}
        description={`${capitalise(weekdayName(date))}, ${fullDate(date)}`}
      >
        {current === undefined && cancelled === undefined ? (
          <p className="text-muted-foreground text-sm">
            {OVERRIDE_LABELS.currentNone}
          </p>
        ) : (
          <ul className="border-border bg-card rounded-lg border px-4">
            {/* The same row the calendar draws, cancellation and badges
                included — the teacher is looking at the lesson she just came
                from, not at a second rendering of it. */}
            {current !== undefined && <LessonRow lesson={current} />}
            {cancelled !== undefined && (
              <LessonRow cancelled lesson={cancelled} />
            )}
          </ul>
        )}
      </Section>

      <Section
        title={OVERRIDE_LABELS.plannedTitle}
        description={OVERRIDE_LABELS.plannedDescription}
      >
        {plannedLesson === undefined ? (
          <p className="text-muted-foreground text-sm">
            {OVERRIDE_LABELS.plannedNone}
          </p>
        ) : (
          <ul className="border-border bg-card rounded-lg border px-4">
            <LessonRow lesson={plannedLesson} />
          </ul>
        )}
      </Section>

      <Section
        title={OVERRIDE_LABELS.formTitle}
        description={OVERRIDE_LABELS.formDescription}
      >
        <OverrideForm
          date={date}
          kind={override?.kind}
          lessonNumber={lessonNumber}
          planned={plannedLesson?.payload}
          stored={override?.payload}
          view={schedule}
        />
      </Section>

      <div className="flex flex-wrap gap-6">
        {/* Cancelling needs **both**: a lesson on the screen to cancel, and a
            template lesson under it to be left struck through. Over an `EDIT`
            with no slot beneath, a tombstone resolves to nothing at all
            (fixtures §8.8) — the lesson would vanish, which is the opposite of
            what `clearHint` and specification §5.3 promise. That case is what
            «Прибрати правку» is for, and it is already on the screen. */}
        {current !== undefined && plannedLesson !== undefined && (
          <ClearLessonForm
            slot={{ date, view: schedule, lessonNumber }}
          />
        )}
        {override !== null && (
          <RemoveOverrideForm
            kind={override.kind}
            slot={{ date, view: schedule, lessonNumber }}
          />
        )}
      </div>

      <p>
        <Link
          className="text-sm underline underline-offset-2"
          href={calendarHref(view, date, schedule)}
        >
          {OVERRIDE_LABELS.back}
        </Link>
      </p>
    </div>
  );
}

/** The lesson with this number, if the list holds one. */
function lessonOn(
  lessons: readonly ResolvedLesson[],
  lessonNumber: number,
): ResolvedLesson | undefined {
  return lessons.find((lesson) => lesson.lessonNumber === lessonNumber);
}
