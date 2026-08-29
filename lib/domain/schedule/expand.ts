import type { Parity, ScheduleView } from "@/lib/db/schema/enums";
import type { IsoDate } from "@/lib/time/today";
import { isNonTeachingOn, weekdayOf } from "./calendarRules";
import { eachIsoDateInRange } from "./dates";
import { parityOn } from "./parity";
import type {
  BellInput,
  DateRange,
  DayOverrideInput,
  ResolvedDay,
  ResolvedLesson,
  ScheduleInput,
  TemplateSlotInput,
  TemplateVersionInput,
} from "./types";

/**
 * The template expanded over a date range — overview §3.1, as corrected by
 * `docs/architecture/design/expand-fixtures.md` §8.7 and §8.8.
 *
 * Expansion is a **read**: nothing here is stored, and calling it twice on the
 * same input gives the same answer. For each date in the range, in this order:
 *
 * 1. `parity` — for every date, non-teaching ones included (§3.5).
 * 2. `isNonTeaching` — one predicate over periods and weekday rules (§3.1).
 * 3. the `ScheduleTemplate` version covering **this date** (never this week, and
 *    never this range: a version can change mid-week, fixtures §8.1), and its
 *    slots for `(weekday, parity)`. A non-teaching date contributes no slots; a
 *    date no version covers contributes none either, and a gap is not an error
 *    (§3.2).
 * 4. the `DayOverride` rows for this date and this view, applied **always** —
 *    a non-teaching date is not a short circuit, because `isNonTeaching`
 *    suppresses `origin = TEMPLATE` and nothing else (§3.4).
 *
 * Lessons come out ordered by `lessonNumber`, with the `BellSchedule` times of
 * that number attached where a bell row exists.
 */

export type ExpandRequest = DateRange & { view: ScheduleView };

export function expand(
  input: ScheduleInput,
  request: ExpandRequest,
): ResolvedDay[] {
  const days = expandView(input, request, request.view);
  if (request.view !== "CLASS") return days;

  // `isTaughtByMe` compares a CLASS lesson against the **resolved** OWN day for
  // the same date, not against the OWN template: an override on the teacher's
  // own day changes the answer (fixtures §8.6, 2026-10-19).
  const ownDays = new Map(
    expandView(input, request, "OWN").map((day) => [day.date, day]),
  );
  return days.map((day) => ({
    ...day,
    lessons: day.lessons.map((lesson) => ({
      ...lesson,
      isTaughtByMe: isTaughtByMe(lesson, ownDays.get(day.date)),
    })),
  }));
}

/**
 * A `CLASS` lesson is one the teacher gives when the resolved `OWN` day holds a
 * lesson with the same `lessonNumber` **and** the same `subject`. The number
 * alone is not enough — the class's second lesson and the teacher's second
 * lesson can be two different subjects at the same hour (fixtures §8.6, F-2).
 *
 * Comparing free-text subjects is the accepted weakness recorded as Q-006.
 */
function isTaughtByMe(
  lesson: ResolvedLesson,
  ownDay: ResolvedDay | undefined,
): boolean {
  return (ownDay?.lessons ?? []).some(
    (own) =>
      own.lessonNumber === lesson.lessonNumber &&
      own.payload.subject === lesson.payload.subject,
  );
}

function expandView(
  input: ScheduleInput,
  range: DateRange,
  view: ScheduleView,
): ResolvedDay[] {
  const versions = input.templates.filter((version) => version.view === view);
  const overridesByDate = groupOverridesByDate(input.overrides, view);
  const bells = new Map(input.bells.map((bell) => [bell.lessonNumber, bell]));
  const rules = {
    periods: input.nonTeachingPeriods,
    weekdayRules: input.weekdayRules,
  };

  return eachIsoDateInRange(range.from, range.to).map((date) => {
    const parity = parityOn(date, input.anchors);
    const isNonTeaching = isNonTeachingOn(date, rules);

    const slots = isNonTeaching
      ? []
      : slotsOn(versionCovering(versions, date), date, parity);

    return {
      date,
      parity,
      isNonTeaching,
      lessons: mergeLessons(slots, overridesByDate.get(date) ?? [], bells),
    };
  });
}

/**
 * The version whose `[validFrom, validTo)` covers the date — `validFrom`
 * inclusive, `validTo` exclusive. Invariant I3 (the `EXCLUDE USING gist`
 * constraint) guarantees at most one; `undefined` is a gap, which renders as an
 * empty calendar rather than falling back to a neighbour (§3.2, fixtures §8.5).
 */
function versionCovering(
  versions: readonly TemplateVersionInput[],
  date: IsoDate,
): TemplateVersionInput | undefined {
  return versions.find(
    (version) => version.validFrom <= date && date < version.validTo,
  );
}

function slotsOn(
  version: TemplateVersionInput | undefined,
  date: IsoDate,
  parity: Parity,
): readonly TemplateSlotInput[] {
  if (version === undefined) return [];
  const weekday = weekdayOf(date);
  return version.slots.filter(
    (slot) => slot.weekday === weekday && slot.parity === parity,
  );
}

function groupOverridesByDate(
  overrides: readonly DayOverrideInput[],
  view: ScheduleView,
): Map<IsoDate, DayOverrideInput[]> {
  const byDate = new Map<IsoDate, DayOverrideInput[]>();
  for (const override of overrides) {
    if (override.view !== view) continue;
    const forDate = byDate.get(override.date);
    if (forDate === undefined) {
      byDate.set(override.date, [override]);
    } else {
      forDate.push(override);
    }
  }
  return byDate;
}

/**
 * Slots and overrides merged into the day's lessons (§3.1):
 *
 * - `EDIT` replaces the slot's payload, or adds a lesson where there is none;
 * - `CLEARED` empties the slot, and is a no-op where there is none;
 * - `SUBSTITUTION` renders its own payload and, **only** when a slot is in force
 *   underneath, the `replacedOriginal` it displaces. With nothing underneath the
 *   field is absent — not `null`, not an empty string (§8.8).
 */
function mergeLessons(
  slots: readonly TemplateSlotInput[],
  overrides: readonly DayOverrideInput[],
  bells: ReadonlyMap<number, BellInput>,
): ResolvedLesson[] {
  const byNumber = new Map<number, ResolvedLesson>(
    slots.map((slot) => [
      slot.lessonNumber,
      { lessonNumber: slot.lessonNumber, payload: slot.payload, origin: "TEMPLATE" },
    ]),
  );

  for (const override of overrides) {
    const replaced = byNumber.get(override.lessonNumber);

    if (override.kind === "CLEARED") {
      byNumber.delete(override.lessonNumber);
      continue;
    }
    // The database guarantees a payload on everything but CLEARED
    // (`day_override_payload_ck`); this keeps the type honest all the same.
    if (override.payload === undefined) continue;

    byNumber.set(override.lessonNumber, {
      lessonNumber: override.lessonNumber,
      payload: override.payload,
      origin: override.kind,
      ...(override.kind === "SUBSTITUTION" && replaced !== undefined
        ? { replacedOriginal: replaced.payload }
        : {}),
    });
  }

  return [...byNumber.values()]
    .sort((a, b) => a.lessonNumber - b.lessonNumber)
    .map((lesson) => withBellTimes(lesson, bells));
}

/**
 * The times of the lesson's number. A number with no `BellSchedule` row keeps
 * neither key — the teacher can delete a bell row while an override on that
 * number still exists, and an absent value is an absent key here as everywhere.
 */
function withBellTimes(
  lesson: ResolvedLesson,
  bells: ReadonlyMap<number, BellInput>,
): ResolvedLesson {
  const bell = bells.get(lesson.lessonNumber);
  return bell === undefined
    ? lesson
    : { ...lesson, timeFrom: bell.timeFrom, timeTo: bell.timeTo };
}
