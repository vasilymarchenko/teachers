import type { BoundaryKind } from "@/lib/db/schema/enums";
import type { IsoDate } from "@/lib/time/today";
import { nextIsoDate } from "./dates";
import type { NonTeachingPeriodInput } from "./types";

/**
 * Resolving «до дати Х» / «до найближчих канікул» / «до кінця семестру» to a
 * date — overview §8.1. This runs **at write time**, once, and the resolved
 * date is what every reader afterwards works with; `expand()` never calls it.
 *
 * The result is always an **exclusive** upper bound: the rule applies to a date
 * `d` while `d < boundaryDate`. The two conversions that follow from that:
 *
 *  - `NEXT_BREAK` resolves to the **first day** of the break, so the rule stops
 *    where the break starts (fixtures §3.3, R1 → `2026-10-26`);
 *  - `END_OF_SEMESTER` resolves to the day **after** `Semester.dateTo`, because
 *    an entity range is inclusive and a validity boundary is not (fixtures §3.6,
 *    OWN-V1 → `2026-12-25` against S1 ending `2026-12-24`).
 *
 * `DATE` follows the same rule: `lastDay` is the last day the teacher wants the
 * rule to apply, as they picked it in the form, and the stored bound is the day
 * after it (fixtures §3.3, R2 → `2027-06-01` for a year ending `2027-05-31`).
 * Every date a teacher sees is inclusive; only the stored bound is not.
 */

export type SemesterRange = { dateFrom: IsoDate; dateTo: IsoDate };

export type BoundaryRequest = {
  kind: BoundaryKind;
  /**
   * The first day of the thing being bounded — a `ScheduleTemplate.validFrom` or
   * a `NonTeachingWeekdayRule.validFrom`, not necessarily `today()`: year setup
   * writes rules that start on the year's first day (fixtures §3.8).
   */
  referenceDate: IsoDate;
  /** The teacher's chosen last day. Required for `kind = 'DATE'`. */
  lastDay?: IsoDate;
  /** `NonTeachingPeriod` rows with `kind = 'BREAK'`. Required for `NEXT_BREAK`. */
  breaks?: readonly NonTeachingPeriodInput[];
  /** Required for `END_OF_SEMESTER`. */
  semesters?: readonly SemesterRange[];
};

/**
 * The exclusive boundary date, or `undefined` when the symbol resolves to
 * nothing usable — no break after `referenceDate`, no semester covering it, or a
 * `lastDay` that has already passed. `undefined` is not an error: it is the
 * signal that the form must ask for an explicit date instead, and it keeps the
 * caller from writing a row that the `validFrom < boundaryDate` check would
 * reject anyway.
 */
export function resolveBoundary(request: BoundaryRequest): IsoDate | undefined {
  const resolved = resolveKind(request);
  return resolved !== undefined && resolved > request.referenceDate
    ? resolved
    : undefined;
}

function resolveKind({
  kind,
  referenceDate,
  lastDay,
  breaks = [],
  semesters = [],
}: BoundaryRequest): IsoDate | undefined {
  switch (kind) {
    case "DATE":
      return lastDay === undefined ? undefined : nextIsoDate(lastDay);

    case "NEXT_BREAK": {
      const starts = breaks
        .map((period) => period.dateFrom)
        .filter((start) => start > referenceDate);
      return starts.length === 0 ? undefined : starts.reduce(earlier);
    }

    case "END_OF_SEMESTER": {
      // The semester in force on `referenceDate`, or — when the reference date
      // falls before the year starts, as it does during year setup — the first
      // one that has not ended yet.
      const candidates = semesters
        .filter((semester) => semester.dateTo >= referenceDate)
        .map((semester) => semester.dateTo);
      return candidates.length === 0
        ? undefined
        : nextIsoDate(candidates.reduce(earlier));
    }
  }
}

const earlier = (a: IsoDate, b: IsoDate): IsoDate => (a <= b ? a : b);

/**
 * Where a rule written by the year-setup screens starts applying — ADR-004.
 *
 * The later of the year's first day and today. Setting a year up before it
 * begins, which is the ordinary case, gives the year's first day, so a
 * methodical day entered in August covers the year from its start (schema §4.4,
 * fixtures §3.3 R1–R3 at `2026-09-01`). Adding one in March gives today
 * instead, so the rule does not reach back over Fridays that have already
 * happened — specification §5.2, «історія не переписується», and the reason
 * `valid_from` exists at all (fixtures §9, finding F-3).
 *
 * It is also the `referenceDate` the rule's boundary resolves against, which is
 * what keeps «до найближчих канікул» from resolving to a break in the past.
 *
 * `today` is a parameter and never `new Date()`: the domain has no clock
 * (overview §8.5), and the caller takes it from `lib/time/today.ts`.
 */
export function ruleValidFrom(yearStart: IsoDate, today: IsoDate): IsoDate {
  return today > yearStart ? today : yearStart;
}

/**
 * Whether a resolved boundary keeps its rule inside the year it was entered
 * under — the other end of the ADR-004 check that `ruleValidFrom()` serves.
 *
 * `boundaryDate` is **exclusive** and `yearEnd` is **inclusive** (schema §4.4,
 * §4.1), so the comparison is against the day *after* the year's last day: a
 * rule that stops exactly where the year does is inside it, and one that stops
 * a day later is not.
 *
 * It matters because `listWeekdayRules()` selects by overlap rather than by a
 * foreign key — the table has no `academic_year_id`. A rule reaching past the
 * year's last day is therefore listed under two years at once, and deleting
 * either one takes it with them, un-blanking a weekday in a year the teacher
 * never touched.
 */
export function boundaryWithinYear(
  boundaryDate: IsoDate,
  yearEnd: IsoDate,
): boolean {
  return boundaryDate <= nextIsoDate(yearEnd);
}
