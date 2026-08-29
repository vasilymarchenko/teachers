import { and, asc, eq, gte, lte } from "drizzle-orm";
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
  const db = getDb();

  const [year] = await db
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

  if (year === undefined) return null;

  const semesters = await db
    .select({ dateFrom: semester.dateFrom, dateTo: semester.dateTo })
    .from(semester)
    .where(
      and(
        eq(semester.userId, userId),
        eq(semester.academicYearId, year.id),
      ),
    )
    .orderBy(asc(semester.index));

  return { ...year, semesters };
}
