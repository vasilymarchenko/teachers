import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  academicYear,
  bellSchedule,
  parityAnchor,
  semester,
} from "@/lib/db/schema";

/**
 * Whether the teacher's year setup is complete — overview §8.6, T-038.
 *
 * **The one place the four conditions are spelled.** Every screen but year
 * setup reads a frame that does not exist until they hold — `parityOn()` throws
 * on an empty `ParityAnchor` list — so `requireCompleteSetup()` and the shell
 * both ask this function and nothing else restates what "complete" means.
 *
 * The three conditions that belong to a year are reported per year, and setup
 * is complete when **any one** year meets all three: a year being prepared for
 * next September must not close the calendar of the one being taught
 * (`ADR-018`). The `BellSchedule` belongs to the teacher and is required once.
 */
export type YearSetupStatus = {
  academicYearId: string;
  /** The `ParityAnchor` on the year's first day — overview §3.5. */
  hasInitialAnchor: boolean;
  /** `Semester` 1 and `Semester` 2 — specification §3.2. */
  hasBothSemesters: boolean;
};

export type SetupStatus = {
  complete: boolean;
  /** At least one lesson number has its bell times. */
  hasBellSchedule: boolean;
  /** One entry per `AcademicYear`, oldest first; empty when there is none. */
  years: YearSetupStatus[];
};

export async function getSetupStatus(userId: string): Promise<SetupStatus> {
  const db = getDb();

  // Four reads of a handful of rows each, every one restricted to the owner
  // (overview §8.4). The conditions are composed below rather than in SQL so
  // that each stays a line that can be read against the ticket.
  const [years, anchors, semesters, bells] = await Promise.all([
    db
      .select({ id: academicYear.id, dateFrom: academicYear.dateFrom })
      .from(academicYear)
      .where(eq(academicYear.userId, userId))
      .orderBy(asc(academicYear.dateFrom)),
    db
      .select({ date: parityAnchor.date })
      .from(parityAnchor)
      .where(eq(parityAnchor.userId, userId)),
    db
      .select({
        academicYearId: semester.academicYearId,
        index: semester.index,
      })
      .from(semester)
      .where(eq(semester.userId, userId)),
    db
      .select({ lessonNumber: bellSchedule.lessonNumber })
      .from(bellSchedule)
      .where(eq(bellSchedule.userId, userId))
      .limit(1),
  ]);

  const anchorDates = new Set(anchors.map((anchor) => anchor.date));
  const hasSemester = (academicYearId: string, index: number) =>
    semesters.some(
      (row) => row.academicYearId === academicYearId && row.index === index,
    );

  const yearStatuses = years.map((year) => ({
    academicYearId: year.id,
    hasInitialAnchor: anchorDates.has(year.dateFrom),
    hasBothSemesters: hasSemester(year.id, 1) && hasSemester(year.id, 2),
  }));

  const hasBellSchedule = bells.length > 0;

  return {
    complete:
      hasBellSchedule &&
      yearStatuses.some(
        (year) => year.hasInitialAnchor && year.hasBothSemesters,
      ),
    hasBellSchedule,
    years: yearStatuses,
  };
}
