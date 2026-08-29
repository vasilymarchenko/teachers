import { and, asc, eq, lte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { parityAnchor } from "@/lib/db/schema";
import type { DateRange, ParityAnchorInput } from "@/lib/domain/schedule/types";

/**
 * The `ParityAnchor` rows `parityOn()` needs for a window — overview §3.5.
 *
 * **Not an overlap read.** Parity on a date is computed from the last anchor
 * with `date <= d`, so an anchor set to the range would drop the year's initial
 * anchor and shift every week of the window. The read is therefore every anchor
 * up to and including `range.to`: an index range scan on
 * `parity_anchor_user_date_uq` (`user_id`, `date`), and a handful of rows a year.
 *
 * The fallback covers the one window that leaves nothing: a teacher paging back
 * before the first anchor of the first year. `parityOn()` extends the earliest
 * anchor backwards (`parity.ts`), so handing it that one anchor is what keeps
 * the calendar rendering instead of throwing.
 */
export async function getParityAnchors(
  userId: string,
  range: DateRange,
): Promise<ParityAnchorInput[]> {
  const db = getDb();
  const columns = { date: parityAnchor.date, parity: parityAnchor.parity };

  const anchors = await db
    .select(columns)
    .from(parityAnchor)
    .where(and(eq(parityAnchor.userId, userId), lte(parityAnchor.date, range.to)))
    .orderBy(asc(parityAnchor.date));

  if (anchors.length > 0) return anchors;

  return db
    .select(columns)
    .from(parityAnchor)
    .where(eq(parityAnchor.userId, userId))
    .orderBy(asc(parityAnchor.date))
    .limit(1);
}
