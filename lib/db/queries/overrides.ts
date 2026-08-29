import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { dayOverride } from "@/lib/db/schema";
import type { DateRange, DayOverrideInput } from "@/lib/domain/schedule/types";
import { parseSlotPayload } from "@/lib/validation/slotPayload";

/**
 * `DayOverride` rows in the window — schema §4.9.
 *
 * **Both views, always.** `expand()` resolves `isTaughtByMe` on a `CLASS` day
 * against the resolved `OWN` day for the same date, overrides included
 * (fixtures §8.6), so narrowing this read to the requested view would silently
 * change the `CLASS` answer. `day_override_slot_uq` (`user_id`, `date`, `view`,
 * `lesson_number`) covers the read.
 *
 * A `CLEARED` row carries no payload — the key is absent from the result rather
 * than `null`, which is what `expand()` and the fixtures expect (§8.8).
 */
export async function getDayOverrides(
  userId: string,
  range: DateRange,
): Promise<DayOverrideInput[]> {
  const rows = await getDb()
    .select({
      date: dayOverride.date,
      view: dayOverride.view,
      lessonNumber: dayOverride.lessonNumber,
      kind: dayOverride.kind,
      payload: dayOverride.payload,
    })
    .from(dayOverride)
    .where(
      and(
        eq(dayOverride.userId, userId),
        gte(dayOverride.date, range.from),
        lte(dayOverride.date, range.to),
      ),
    )
    .orderBy(
      asc(dayOverride.date),
      asc(dayOverride.view),
      asc(dayOverride.lessonNumber),
    );

  return rows.map((row) => {
    const { payload, ...rest } = row;
    if (row.kind === "CLEARED") return rest;
    return {
      ...rest,
      payload: parseSlotPayload(
        row.view,
        payload,
        `day_override ${row.date} ${row.view} #${row.lessonNumber}`,
      ),
    };
  });
}
