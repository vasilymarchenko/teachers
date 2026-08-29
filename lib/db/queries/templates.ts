import { and, asc, eq, gt, lte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { scheduleTemplate, templateSlot } from "@/lib/db/schema";
import type {
  DateRange,
  TemplateSlotInput,
  TemplateVersionInput,
} from "@/lib/domain/schedule/types";
import { parseSlotPayload } from "@/lib/validation/slotPayload";

/**
 * The `ScheduleTemplate` versions covering the window, each with its slots —
 * overview §3.2, schema §4.7 and §4.8.
 *
 * **Both views, always**, for the reason `getDayOverrides()` states: a `CLASS`
 * day's `isTaughtByMe` is decided against the resolved `OWN` day (fixtures §8.6).
 *
 * A version is `[valid_from, valid_to)` — the upper bound is exclusive (schema
 * §6) — so it covers part of `[from, to]` when `valid_from <= to AND
 * valid_to > from`. A window may be covered by two versions, by one, or by
 * none: a gap is legal and renders as an empty calendar, not an error (§3.2,
 * and the fixture's CLASS gap `[2026-10-21, 2026-11-02)`).
 *
 * Two round trips, not one per version and not a join: a join would repeat
 * every version row once per slot, and the number of versions covering a window
 * is one or two. The slots are fetched in a single second query keyed by the
 * versions just read, so this stays two queries whatever the range — the N+1
 * this shape exists to avoid.
 */
export async function getTemplateVersions(
  userId: string,
  range: DateRange,
): Promise<TemplateVersionInput[]> {
  const db = getDb();

  const versions = await db
    .select({
      id: scheduleTemplate.id,
      view: scheduleTemplate.view,
      validFrom: scheduleTemplate.validFrom,
      validTo: scheduleTemplate.validTo,
    })
    .from(scheduleTemplate)
    .where(
      and(
        eq(scheduleTemplate.userId, userId),
        lte(scheduleTemplate.validFrom, range.to),
        gt(scheduleTemplate.validTo, range.from),
      ),
    )
    .orderBy(asc(scheduleTemplate.view), asc(scheduleTemplate.validFrom));

  if (versions.length === 0) return [];

  const slotRows = await db
    .select({
      templateId: templateSlot.templateId,
      weekday: templateSlot.weekday,
      lessonNumber: templateSlot.lessonNumber,
      parity: templateSlot.parity,
      payload: templateSlot.payload,
    })
    .from(templateSlot)
    .innerJoin(
      scheduleTemplate,
      and(
        eq(templateSlot.templateId, scheduleTemplate.id),
        eq(templateSlot.userId, scheduleTemplate.userId),
      ),
    )
    .where(
      and(
        eq(templateSlot.userId, userId),
        lte(scheduleTemplate.validFrom, range.to),
        gt(scheduleTemplate.validTo, range.from),
      ),
    )
    .orderBy(
      asc(templateSlot.weekday),
      asc(templateSlot.lessonNumber),
      asc(templateSlot.parity),
    );

  // The slots are re-selected through the same predicate rather than by an
  // `inArray` of the ids just read: one predicate, defined once, so the two
  // queries cannot drift apart into a version whose slots are missing.
  const byId = new Map(versions.map((version) => [version.id, version]));
  const slotsByVersion = new Map<string, TemplateSlotInput[]>(
    versions.map((version) => [version.id, []]),
  );

  for (const row of slotRows) {
    const version = byId.get(row.templateId);
    if (version === undefined) continue;
    slotsByVersion.get(row.templateId)?.push({
      weekday: row.weekday,
      lessonNumber: row.lessonNumber,
      parity: row.parity,
      payload: parseSlotPayload(
        version.view,
        row.payload,
        `template_slot ${version.view} ${version.validFrom} ${row.weekday}/${row.lessonNumber}`,
      ),
    });
  }

  return versions.map(({ id, ...version }) => ({
    ...version,
    slots: slotsByVersion.get(id) ?? [],
  }));
}
