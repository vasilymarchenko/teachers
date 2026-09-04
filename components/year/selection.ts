import type { AcademicYearRow } from "@/lib/db/queries/yearSetup";
import type { IsoDate } from "@/lib/time/today";

/**
 * Which academic year the setup screen is editing.
 *
 * The screen edits one year at a time and says which in the URL (`?year=…`), so
 * that a link to a year is a link to a year. This is the rule for the case
 * where the URL says nothing, or says something the teacher does not own:
 *
 *  1. the requested year, when it is one of theirs — an id from a URL is not a
 *     claim, so it is looked up rather than trusted;
 *  2. the year covering today, which is the one being taught;
 *  3. the next year to start, so that in August the teacher lands on the year
 *     they are about to prepare rather than on the one that just ended;
 *  4. the last year there is.
 *
 * `years` comes from `listAcademicYears()`, oldest first, and years may not
 * overlap — so "the year covering today" is at most one row and "the next to
 * start" is the first row after today.
 */
export function pickYear(
  years: readonly AcademicYearRow[],
  requestedId: string | undefined,
  today: IsoDate,
): AcademicYearRow | null {
  if (years.length === 0) return null;

  const requested = years.find((year) => year.id === requestedId);
  if (requested !== undefined) return requested;

  const current = years.find(
    (year) => year.dateFrom <= today && today <= year.dateTo,
  );
  if (current !== undefined) return current;

  const upcoming = years.find((year) => year.dateFrom > today);
  return upcoming ?? years[years.length - 1];
}
