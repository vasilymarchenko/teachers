import { and, asc, eq, gt, lte } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { scheduleTemplate, templateSlot } from "@/lib/db/schema";
import type { BoundaryKind, ScheduleView } from "@/lib/db/schema/enums";
import type { TemplateSlotInput } from "@/lib/domain/schedule/types";
import type { IsoDate } from "@/lib/time/today";
import { parseSlotPayload } from "@/lib/validation/slotPayload";

/**
 * The reads behind the weekly template editor — T-010, schema §4.7 and §4.8.
 *
 * Separate from `getTemplateVersions()` of T-008 for the reason `yearSetup.ts`
 * gives: the calendar reads what `expand()` consumes, an editing screen has to
 * render a row it can then write back, so it needs the version's `id` and the
 * `boundaryKind` that overview §8.1 keeps only for display. Widening the
 * calendar's read to carry both would put columns the domain must not look at
 * into the domain's own input.
 *
 * Every function takes `userId` first and is read-only (overview §8.4); the
 * writes are in `lib/actions/scheduleTemplate.ts`.
 */

/** One `schedule_template` row as the editor works with it. */
export type TemplateVersionRow = {
  id: string;
  view: ScheduleView;
  /** Inclusive. */
  validFrom: IsoDate;
  /** Exclusive (schema §6). */
  validTo: IsoDate;
  boundaryKind: BoundaryKind;
};

/** A version together with every cell it holds — what an edit copies forward. */
export type TemplateVersionWithSlots = TemplateVersionRow & {
  slots: TemplateSlotInput[];
};

/**
 * The version of one view in force on `date`, with its slots, or `null`.
 *
 * `null` is not an error: it is a gap between versions or a view that has never
 * been filled in (overview §3.2), and the editor renders an empty grid for it.
 * The caller passes `today()` — the edit is planned against the version in
 * force on the cut date and against no other (`planTemplateEdit()`).
 */
export async function getTemplateVersionInForce(
  userId: string,
  view: ScheduleView,
  date: IsoDate,
): Promise<TemplateVersionWithSlots | null> {
  const db = getDb();

  const [version] = await db
    .select({
      id: scheduleTemplate.id,
      view: scheduleTemplate.view,
      validFrom: scheduleTemplate.validFrom,
      validTo: scheduleTemplate.validTo,
      boundaryKind: scheduleTemplate.boundaryKind,
    })
    .from(scheduleTemplate)
    .where(
      and(
        eq(scheduleTemplate.userId, userId),
        eq(scheduleTemplate.view, view),
        lte(scheduleTemplate.validFrom, date),
        gt(scheduleTemplate.validTo, date),
      ),
    )
    // At most one row: `schedule_template_no_overlap_ex` is what makes that
    // true, and `limit(1)` says so rather than trusting the caller to notice.
    .limit(1);

  if (version === undefined) return null;

  const rows = await db
    .select({
      weekday: templateSlot.weekday,
      lessonNumber: templateSlot.lessonNumber,
      parity: templateSlot.parity,
      payload: templateSlot.payload,
    })
    .from(templateSlot)
    .where(
      and(
        eq(templateSlot.userId, userId),
        eq(templateSlot.templateId, version.id),
      ),
    )
    .orderBy(
      asc(templateSlot.weekday),
      asc(templateSlot.lessonNumber),
      asc(templateSlot.parity),
    );

  return {
    ...version,
    slots: rows.map((row) => ({
      weekday: row.weekday,
      lessonNumber: row.lessonNumber,
      parity: row.parity,
      // `jsonb` is `unknown` at the type level and a cast is not a check
      // (schema §7). A slot that silently vanished here would be copied out of
      // the next version by the very edit that was meant to keep it.
      payload: parseSlotPayload(
        version.view,
        row.payload,
        `template_slot ${version.view} ${version.validFrom} ${row.weekday}/${row.lessonNumber}`,
      ),
    })),
  };
}

/**
 * When the next version of this view starts, if there is one after `date`.
 *
 * The editor caps a new version's `validTo` at this (`capToNextVersion()`):
 * `planTemplateEdit()` plans against the version in force and leaves the later
 * one to the caller, and this is what the caller needs to honour it.
 */
export async function getNextTemplateVersionStart(
  userId: string,
  view: ScheduleView,
  date: IsoDate,
): Promise<IsoDate | undefined> {
  const [row] = await getDb()
    .select({ validFrom: scheduleTemplate.validFrom })
    .from(scheduleTemplate)
    .where(
      and(
        eq(scheduleTemplate.userId, userId),
        eq(scheduleTemplate.view, view),
        gt(scheduleTemplate.validFrom, date),
      ),
    )
    .orderBy(asc(scheduleTemplate.validFrom))
    .limit(1);

  return row?.validFrom;
}

/**
 * Every version of one view, oldest first — the strip that shows the teacher
 * what has been in force and until when.
 *
 * All of them and not just the future ones: the frozen past is the visible
 * consequence of I1, and «попередній розклад діяв до 19 жовтня» is only
 * readable if the row that ended then is still on the screen. There is one row
 * per edit day at most, so the list stays short.
 */
export async function listTemplateVersions(
  userId: string,
  view: ScheduleView,
): Promise<TemplateVersionRow[]> {
  return getDb()
    .select({
      id: scheduleTemplate.id,
      view: scheduleTemplate.view,
      validFrom: scheduleTemplate.validFrom,
      validTo: scheduleTemplate.validTo,
      boundaryKind: scheduleTemplate.boundaryKind,
    })
    .from(scheduleTemplate)
    .where(
      and(eq(scheduleTemplate.userId, userId), eq(scheduleTemplate.view, view)),
    )
    .orderBy(asc(scheduleTemplate.validFrom));
}
