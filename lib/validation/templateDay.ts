import { z, type ZodError } from "zod";
import type { ScheduleView } from "@/lib/db/schema/enums";
import {
  checkSlotFields,
  isBlankSlot,
  rawSlotFields,
  SLOT_FIELDS,
  toSlotPayload,
  type SlotFieldName,
} from "./slotFields";
import type { SlotPayload } from "./slotPayload";

/**
 * The weekly template's day form — specification §5.1, `template_slot` in
 * schema §4.8. One submission is one `weekday` × one `parity` × one `view`, the
 * unit of saving fixed by `decisions/ADR-006-template-day-is-the-save-unit.md`.
 *
 * The form's fields depend on the `view`, exactly as the payload does: three
 * fields for «мої уроки», five for «уроки класу» (specification §5.1). Which
 * fields those are, how long they may be and what each one may not be left as
 * is `slotFields.ts` — shared with the day-override form, because an override
 * is a lesson too (overview §3.4). What is written here is what belongs to a
 * *day of rows*.
 *
 * **An empty row means no slot**, not a slot with empty fields: «a slot is
 * present only when the cell is filled» (schema §4.8). That is what makes one
 * submission create, update and delete at once — the same shape the bell grid
 * has, and for the same reason.
 *
 * Field names are computed (`templateSlotField()`) because the rows are the
 * lesson numbers the school actually uses, not a fixed ten;
 * `templateDayFieldErrors()` is the other half of the mapping and needs the
 * same lesson numbers to read one back off an array index.
 */

/** The fields one row shows, per view — `SLOT_FIELDS`, under this screen's name. */
export const TEMPLATE_SLOT_FIELDS = SLOT_FIELDS;

export type TemplateSlotFieldName = SlotFieldName;

/** The `name=` of one input of the day form. */
export function templateSlotField(
  lessonNumber: number,
  field: TemplateSlotFieldName,
): string {
  return `slot-${lessonNumber}-${field}`;
}

/** One row as the form submits it: every field of the view, plus its number. */
const rawEntry = rawSlotFields.extend({
  lessonNumber: z.number().int().min(0).max(9),
});

export type TemplateDayRawEntry = z.infer<typeof rawEntry>;

/** One row after parsing. `payload` absent means the cell is empty. */
export type TemplateDayEntry = {
  lessonNumber: number;
  payload?: SlotPayload;
};

function entrySchemaFor(view: ScheduleView) {
  return rawEntry
    .superRefine((entry, ctx) => {
      // An untouched row is not an incomplete row: it is the teacher saying
      // there is no lesson at that number.
      if (isBlankSlot(view, entry)) return;
      checkSlotFields(view, entry, ctx);
    })
    .transform((entry): TemplateDayEntry => {
      if (isBlankSlot(view, entry)) {
        return { lessonNumber: entry.lessonNumber };
      }
      return {
        lessonNumber: entry.lessonNumber,
        payload: toSlotPayload(view, entry),
      };
    });
}

/**
 * The whole day. The rows are whichever lesson numbers the screen showed, in
 * order — `templateDayFieldErrors()` reads a lesson number off the index, so
 * the caller passes the same list to both.
 */
export function templateDayInputFor(view: ScheduleView) {
  return z.object({ entries: z.array(entrySchemaFor(view)) });
}

export type TemplateDayInput = {
  entries: TemplateDayEntry[];
};

/**
 * The day's issues keyed by field name, for `FormState.fieldErrors` — the same
 * job `bellFieldErrors()` does, and it cannot be `z.flattenError()` either:
 * every issue is nested under `entries.<index>.<field>`.
 */
export function templateDayFieldErrors(
  error: ZodError,
  lessonNumbers: readonly number[],
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const [root, index, field] = issue.path;
    if (root !== "entries" || typeof index !== "number") continue;
    if (typeof field !== "string") continue;

    const lessonNumber = lessonNumbers[index];
    if (lessonNumber === undefined) continue;

    const name = templateSlotField(
      lessonNumber,
      field as TemplateSlotFieldName,
    );
    errors[name] ??= issue.message;
  }

  return errors;
}

/**
 * The rows of one day as the form submitted them.
 *
 * Every field of the view is read for every row shown, so a blank input and an
 * input the form never rendered are the same empty string — which is what makes
 * "the row is empty" a decision about the teacher's input and not about the
 * `FormData` keys that happen to exist.
 */
export function readTemplateDay(
  formData: FormData,
  lessonNumbers: readonly number[],
): { entries: TemplateDayRawEntry[] } {
  const field = (lessonNumber: number, name: TemplateSlotFieldName): string =>
    String(formData.get(templateSlotField(lessonNumber, name)) ?? "");

  return {
    entries: lessonNumbers.map((lessonNumber) => ({
      lessonNumber,
      subject: field(lessonNumber, "subject"),
      className: field(lessonNumber, "className"),
      teacherName: field(lessonNumber, "teacherName"),
      zoomLink: field(lessonNumber, "zoomLink"),
      note: field(lessonNumber, "note"),
    })),
  };
}
