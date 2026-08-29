import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { BellInput } from "@/lib/domain/schedule/types";
import { bellSchedule } from "@/lib/db/schema";

/**
 * Every bell row the teacher has — `docs/architecture/design/schema.md` §4.5.
 *
 * Not a range query: `bell_schedule` is scoped to the user and not to a date or
 * an academic year, and there are at most ten rows, so there is nothing to
 * narrow. `bell_schedule_user_number_uq` covers the read.
 *
 * A lesson number with no row is normal — `expand()` leaves `timeFrom` and
 * `timeTo` off that lesson (fixtures §3.4).
 */
export async function getBellSchedule(userId: string): Promise<BellInput[]> {
  const rows = await getDb()
    .select({
      lessonNumber: bellSchedule.lessonNumber,
      timeFrom: bellSchedule.timeFrom,
      timeTo: bellSchedule.timeTo,
    })
    .from(bellSchedule)
    .where(eq(bellSchedule.userId, userId))
    .orderBy(asc(bellSchedule.lessonNumber));

  return rows.map((row) => ({
    lessonNumber: row.lessonNumber,
    timeFrom: clockTime(row.timeFrom),
    timeTo: clockTime(row.timeTo),
  }));
}

/**
 * `time` comes back from Postgres as `HH:MM:SS`; the domain and the fixture
 * both spell a bell time `HH:MM` (fixtures §3.4), and that string is passed
 * through `expand()` to the screen unchanged.
 *
 * Whole seconds are dropped, anything else is kept rather than rounded away: a
 * bell at `08:30:45` is a data-entry mistake worth seeing, not one worth hiding.
 *
 * The whole string is matched rather than its tail: a bare `HH:MM` also ends in
 * `:00` on the hour, and trimming three characters off `08:00` would leave `08`.
 * `time` never yields that shape today, and this function is not the place that
 * finds out when it does.
 */
const WHOLE_MINUTE = /^(\d{2}:\d{2}):00$/;

function clockTime(value: string): string {
  return WHOLE_MINUTE.exec(value)?.[1] ?? value;
}
