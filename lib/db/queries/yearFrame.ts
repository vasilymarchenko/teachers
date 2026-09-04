import { and, asc, eq, gt, gte, lte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { academicYear, semester } from "@/lib/db/schema";
import type { SemesterRange } from "@/lib/domain/schedule/boundaries";
import type { IsoDate } from "@/lib/time/today";

/**
 * The year frame — schema §4.1 and §4.2.
 *
 * `SemesterRange` is what `resolveBoundary()` takes for `END_OF_SEMESTER`
 * (`lib/domain/schedule/boundaries.ts`), and the year's own dates are what the
 * calendar clamps navigation to. Both come from one read because a semester
 * without its year is not a frame.
 *
 * `null` for a date outside every year the teacher has set up: an August day
 * before year setup has run is a normal thing to navigate to, not an error.
 */
export type YearFrame = {
  id: string;
  /** Both inclusive — an entity range (schema §6). */
  dateFrom: IsoDate;
  dateTo: IsoDate;
  /** Ordered by `index`: semester 1, then semester 2. */
  semesters: SemesterRange[];
};

export async function getYearFrame(
  userId: string,
  date: IsoDate,
): Promise<YearFrame | null> {
  const [year] = await getDb()
    .select({
      id: academicYear.id,
      dateFrom: academicYear.dateFrom,
      dateTo: academicYear.dateTo,
    })
    .from(academicYear)
    .where(
      and(
        eq(academicYear.userId, userId),
        lte(academicYear.dateFrom, date),
        gte(academicYear.dateTo, date),
      ),
    )
    .limit(1);

  return year === undefined ? null : withSemesters(userId, year);
}

/**
 * The earliest year that begins **after** `date` — the frame a symbolic
 * boundary resolves against when `date` falls in no year at all.
 *
 * That is the setup order ADR-004 calls the ordinary case: the teacher enters
 * next September in August, so on the day she writes «до кінця семестру» there
 * is no year around her and the symbol has nothing to point at. The year about
 * to begin is what she means, and `ruleValidFrom()` at the call site is what
 * turns it into a reference date — the same expression ADR-004 settled on.
 *
 * `null` when there is no such year either: nothing has been set up yet, which
 * is the one case that really is «спершу задайте навчальний рік».
 */
export async function getUpcomingYearFrame(
  userId: string,
  date: IsoDate,
): Promise<YearFrame | null> {
  const [year] = await getDb()
    .select({
      id: academicYear.id,
      dateFrom: academicYear.dateFrom,
      dateTo: academicYear.dateTo,
    })
    .from(academicYear)
    .where(
      and(eq(academicYear.userId, userId), gt(academicYear.dateFrom, date)),
    )
    .orderBy(asc(academicYear.dateFrom))
    .limit(1);

  return year === undefined ? null : withSemesters(userId, year);
}

/** The second half of both reads: a year without its semesters is not a frame. */
async function withSemesters(
  userId: string,
  year: Omit<YearFrame, "semesters">,
): Promise<YearFrame> {
  const semesters = await getDb()
    .select({ dateFrom: semester.dateFrom, dateTo: semester.dateTo })
    .from(semester)
    .where(
      and(eq(semester.userId, userId), eq(semester.academicYearId, year.id)),
    )
    .orderBy(asc(semester.index));

  return { ...year, semesters };
}
