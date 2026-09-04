import { and, asc, eq, gt, gte, lte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  academicYear,
  nonTeachingPeriod,
  nonTeachingWeekdayRule,
  parityAnchor,
  semester,
} from "@/lib/db/schema";
import type {
  BoundaryKind,
  NonTeachingKind,
  Parity,
  Weekday,
} from "@/lib/db/schema/enums";
import type { DateRange } from "@/lib/domain/schedule/types";
import type { IsoDate } from "@/lib/time/today";

/**
 * The reads behind the year-setup screens — T-009, schema §4.1–§4.6.
 *
 * They are separate from the calendar's reads of T-008 rather than shared with
 * them, because the two want different rows of the same tables. The calendar
 * reads what `expand()` consumes and nothing else; a setup screen has to render
 * a row the teacher can edit or delete, so it needs the `id` the calendar has
 * no use for, and the `boundaryKind` that overview §8.1 keeps *only* for
 * display. Widening the calendar's reads to carry both would put columns into
 * the domain's input that the domain must not look at.
 *
 * Every function takes `userId` first and is read-only (overview §8.4); the
 * writes are in `lib/actions`, going to Drizzle directly as overview §2
 * prescribes for CRUD forms.
 */

export type AcademicYearRow = {
  id: string;
  /** Both inclusive — an entity range (schema §6). */
  dateFrom: IsoDate;
  dateTo: IsoDate;
};

/**
 * Every year the teacher has set up, oldest first.
 *
 * All of them, not the current one: a teacher may prepare next September while
 * this year is still running. Years may not overlap
 * (`academic_year_no_overlap_ex`), so ordering by `date_from` is a total order
 * and the list reads like a timeline.
 */
export async function listAcademicYears(
  userId: string,
): Promise<AcademicYearRow[]> {
  return getDb()
    .select({
      id: academicYear.id,
      dateFrom: academicYear.dateFrom,
      dateTo: academicYear.dateTo,
    })
    .from(academicYear)
    .where(eq(academicYear.userId, userId))
    .orderBy(asc(academicYear.dateFrom));
}

/** One year of this teacher's, or `null` — an id from a URL is not a claim. */
export async function getAcademicYear(
  userId: string,
  academicYearId: string,
): Promise<AcademicYearRow | null> {
  const [row] = await getDb()
    .select({
      id: academicYear.id,
      dateFrom: academicYear.dateFrom,
      dateTo: academicYear.dateTo,
    })
    .from(academicYear)
    .where(
      and(eq(academicYear.userId, userId), eq(academicYear.id, academicYearId)),
    )
    .limit(1);

  return row ?? null;
}

export type SemesterRow = {
  id: string;
  /** 1 or 2 (glossary §1). */
  index: number;
  dateFrom: IsoDate;
  dateTo: IsoDate;
};

/** The year's semesters in `index` order — specification §3.2. */
export async function listSemesters(
  userId: string,
  academicYearId: string,
): Promise<SemesterRow[]> {
  return getDb()
    .select({
      id: semester.id,
      index: semester.index,
      dateFrom: semester.dateFrom,
      dateTo: semester.dateTo,
    })
    .from(semester)
    .where(
      and(
        eq(semester.userId, userId),
        eq(semester.academicYearId, academicYearId),
      ),
    )
    .orderBy(asc(semester.index));
}

export type NonTeachingPeriodEditRow = {
  id: string;
  kind: NonTeachingKind;
  /** Ukrainian — the teacher reads it. */
  name: string;
  dateFrom: IsoDate;
  dateTo: IsoDate;
};

/**
 * The year's non-teaching periods, in date order.
 *
 * By `academic_year_id` and not by date range, unlike the calendar's
 * `getNonTeachingPeriods()`: a period whose dates ended up outside its year —
 * because the year's dates were edited afterwards — still belongs to that year
 * and must stay editable. Filtering it out would leave a row nothing can reach.
 */
export async function listNonTeachingPeriods(
  userId: string,
  academicYearId: string,
): Promise<NonTeachingPeriodEditRow[]> {
  return getDb()
    .select({
      id: nonTeachingPeriod.id,
      kind: nonTeachingPeriod.kind,
      name: nonTeachingPeriod.name,
      dateFrom: nonTeachingPeriod.dateFrom,
      dateTo: nonTeachingPeriod.dateTo,
    })
    .from(nonTeachingPeriod)
    .where(
      and(
        eq(nonTeachingPeriod.userId, userId),
        eq(nonTeachingPeriod.academicYearId, academicYearId),
      ),
    )
    .orderBy(asc(nonTeachingPeriod.dateFrom), asc(nonTeachingPeriod.dateTo));
}

export type WeekdayRuleRow = {
  id: string;
  weekday: Weekday;
  /** Inclusive. */
  validFrom: IsoDate;
  /** Exclusive (schema §4.4, §6). */
  boundaryDate: IsoDate;
  /** How the teacher entered `boundaryDate` — display only (overview §8.1). */
  boundaryKind: BoundaryKind;
};

/**
 * The weekday rules in force anywhere in the year — specification §3.4.
 *
 * `non_teaching_weekday_rule` has no `academic_year_id`: a rule is a weekday
 * plus a half-open interval, and nothing ties it to a year. So the window is
 * the year's own dates, with the same predicate the calendar uses — a rule
 * touches `[from, to]` when `valid_from <= to AND boundary_date > from`, the
 * `>` being what stops a rule ending on the year's first day from showing up in
 * it.
 */
export async function listWeekdayRules(
  userId: string,
  range: DateRange,
): Promise<WeekdayRuleRow[]> {
  return getDb()
    .select({
      id: nonTeachingWeekdayRule.id,
      weekday: nonTeachingWeekdayRule.weekday,
      validFrom: nonTeachingWeekdayRule.validFrom,
      boundaryDate: nonTeachingWeekdayRule.boundaryDate,
      boundaryKind: nonTeachingWeekdayRule.boundaryKind,
    })
    .from(nonTeachingWeekdayRule)
    .where(
      and(
        eq(nonTeachingWeekdayRule.userId, userId),
        lte(nonTeachingWeekdayRule.validFrom, range.to),
        gt(nonTeachingWeekdayRule.boundaryDate, range.from),
      ),
    )
    .orderBy(
      asc(nonTeachingWeekdayRule.weekday),
      asc(nonTeachingWeekdayRule.validFrom),
    );
}

export type ParityAnchorRow = {
  id: string;
  /** Inclusive: the anchor is in force from this date onwards. */
  date: IsoDate;
  parity: Parity;
};

/**
 * The parity anchors inside the year — specification §4, overview §3.5.
 *
 * A plain containment read, unlike `getParityAnchors()`, which has to reach
 * back before its window to find the anchor in force. This one is a list to
 * edit, not an input to `parityOn()`: an anchor from a previous year is that
 * year's row and is edited there.
 */
export async function listParityAnchors(
  userId: string,
  range: DateRange,
): Promise<ParityAnchorRow[]> {
  return getDb()
    .select({
      id: parityAnchor.id,
      date: parityAnchor.date,
      parity: parityAnchor.parity,
    })
    .from(parityAnchor)
    .where(
      and(
        eq(parityAnchor.userId, userId),
        gte(parityAnchor.date, range.from),
        lte(parityAnchor.date, range.to),
      ),
    )
    .orderBy(asc(parityAnchor.date));
}

/**
 * One weekday rule of this teacher's, or `null`.
 *
 * Editing a rule needs its `validFrom`: the new boundary resolves against the
 * day the rule started, not against today. Recomputing that day on every edit
 * would move it forward and quietly stop the rule from having applied to the
 * weeks it did apply to (specification §5.2, ADR-004).
 */
export async function getWeekdayRule(
  userId: string,
  ruleId: string,
): Promise<WeekdayRuleRow | null> {
  const [row] = await getDb()
    .select({
      id: nonTeachingWeekdayRule.id,
      weekday: nonTeachingWeekdayRule.weekday,
      validFrom: nonTeachingWeekdayRule.validFrom,
      boundaryDate: nonTeachingWeekdayRule.boundaryDate,
      boundaryKind: nonTeachingWeekdayRule.boundaryKind,
    })
    .from(nonTeachingWeekdayRule)
    .where(
      and(
        eq(nonTeachingWeekdayRule.userId, userId),
        eq(nonTeachingWeekdayRule.id, ruleId),
      ),
    )
    .limit(1);

  return row ?? null;
}
