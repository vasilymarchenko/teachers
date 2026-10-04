import { and, eq, isNotNull, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db/client";
import { dayOverride, scheduleTemplate, templateSlot } from "@/lib/db/schema";
import {
  collectSuggestions,
  type LessonSuggestions,
} from "@/lib/domain/schedule/suggestions";

/**
 * What the lesson fields suggest — overview §4: the distinct `subject`,
 * `className` and `teacherName` the teacher has already typed, read from the
 * payloads of `template_slot` and `day_override`.
 *
 * **Every version and every date.** A class taught last semester, or a
 * substitute teacher entered once in October, is still a value the teacher may
 * type again; narrowing the read to the version in force would drop exactly
 * those.
 *
 * Two statements, one per table, each `DISTINCT` over the three fields and the
 * view, so a week of identical slots comes back as one row. A slot has no
 * `view` of its own — it is the parent version's — hence the join, on the
 * composite key the foreign key is declared on (schema §4.8). A `CLEARED`
 * override carries no payload and is skipped.
 *
 * The fields are read with `->>` rather than parsed with `parseSlotPayload()`:
 * a suggestion is a string offered to an input, not a payload anything
 * renders, and the trimming, the view each list reads and the order are
 * `collectSuggestions()`'s.
 */
export async function getLessonSuggestions(
  userId: string,
): Promise<LessonSuggestions> {
  const db = getDb();

  const slotRows = await db
    .selectDistinct({
      view: scheduleTemplate.view,
      ...payloadFields(templateSlot.payload),
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
      and(eq(templateSlot.userId, userId), eq(scheduleTemplate.userId, userId)),
    );

  const overrideRows = await db
    .selectDistinct({
      view: dayOverride.view,
      ...payloadFields(dayOverride.payload),
    })
    .from(dayOverride)
    .where(and(eq(dayOverride.userId, userId), isNotNull(dayOverride.payload)));

  return collectSuggestions([...slotRows, ...overrideRows]);
}

/** The three suggestible fields of a payload column; absent keys are `null`. */
function payloadFields(payload: AnyPgColumn): {
  subject: SQL<string | null>;
  className: SQL<string | null>;
  teacherName: SQL<string | null>;
} {
  return {
    subject: sql<string | null>`${payload} ->> 'subject'`,
    className: sql<string | null>`${payload} ->> 'className'`,
    teacherName: sql<string | null>`${payload} ->> 'teacherName'`,
  };
}
