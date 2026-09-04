import { z, type ZodError } from "zod";
import type { ScheduleView } from "@/lib/db/schema/enums";
import type { SlotPayload } from "./slotPayload";

/**
 * The weekly template's day form — specification §5.1, `template_slot` in
 * schema §4.8. One submission is one `weekday` × one `parity` × one `view`, the
 * unit of saving fixed by `decisions/ADR-006-template-day-is-the-save-unit.md`.
 *
 * The form's fields depend on the `view`, exactly as the payload does: three
 * fields for «мої уроки», five for «уроки класу» (specification §5.1). So the
 * schema is built per view rather than written twice, and the same `view` picks
 * the payload the transform produces — the shape `slotPayloadFor()` defines,
 * which `templateDay.test.ts` pins by parsing every payload this schema
 * produces through it.
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

const MISSING_SUBJECT = "Вкажіть предмет";
const MISSING_CLASS = "Вкажіть клас";
const MISSING_TEACHER = "Вкажіть ПІБ учителя";
const BAD_ZOOM_LINK = "Посилання має починатися з http:// або https://";

/**
 * How long each cell may be. A subject, a class and a teacher's name are short
 * by nature — the same 120 characters a `NonTeachingPeriod` name gets — while a
 * Zoom link carries a meeting id and a password token, and «додаткова
 * інформація» is deliberately free text (specification §5.1).
 */
const MAX_LENGTH = {
  subject: 120,
  className: 120,
  teacherName: 120,
  zoomLink: 500,
  note: 500,
} as const satisfies Record<TemplateSlotFieldName, number>;

const tooLong = (limit: number) => `Задовгий текст — до ${limit} символів`;

/** The fields one row shows, per view — specification §5.1, in its order. */
export const TEMPLATE_SLOT_FIELDS = {
  OWN: ["subject", "className"],
  CLASS: ["subject", "teacherName", "zoomLink", "note"],
} as const satisfies Record<ScheduleView, readonly string[]>;

export type TemplateSlotFieldName =
  (typeof TEMPLATE_SLOT_FIELDS)[ScheduleView][number];

/** The fields a filled row may not leave blank. */
const REQUIRED_FIELDS = {
  OWN: { subject: MISSING_SUBJECT, className: MISSING_CLASS },
  CLASS: { subject: MISSING_SUBJECT, teacherName: MISSING_TEACHER },
} as const satisfies Record<ScheduleView, Partial<Record<TemplateSlotFieldName, string>>>;

/** The `name=` of one input of the day form. */
export function templateSlotField(
  lessonNumber: number,
  field: TemplateSlotFieldName,
): string {
  return `slot-${lessonNumber}-${field}`;
}

/**
 * One row as the form submits it: every field of the view, trimmed, with the
 * empty string for the ones the teacher left blank.
 */
const rawEntry = z.object({
  lessonNumber: z.number().int().min(0).max(9),
  subject: z.string().trim(),
  className: z.string().trim(),
  teacherName: z.string().trim(),
  zoomLink: z.string().trim(),
  note: z.string().trim(),
});

export type TemplateDayRawEntry = z.infer<typeof rawEntry>;

/** One row after parsing. `payload` absent means the cell is empty. */
export type TemplateDayEntry = {
  lessonNumber: number;
  payload?: SlotPayload;
};

/**
 * An optional free-text field, as a fragment of the payload: the **key itself**
 * is absent when the teacher left the input blank, never present with an empty
 * string or a `null` (fixtures §8.8).
 */
const optional = (key: "zoomLink" | "note", value: string) =>
  value === "" ? {} : { [key]: value };

function toPayload(
  view: ScheduleView,
  entry: TemplateDayRawEntry,
): SlotPayload {
  return view === "OWN"
    ? { subject: entry.subject, className: entry.className }
    : {
        subject: entry.subject,
        teacherName: entry.teacherName,
        ...optional("zoomLink", entry.zoomLink),
        ...optional("note", entry.note),
      };
}

function entrySchemaFor(view: ScheduleView) {
  const fields = TEMPLATE_SLOT_FIELDS[view];
  const required: Partial<Record<string, string>> = REQUIRED_FIELDS[view];

  return rawEntry
    .superRefine((entry, ctx) => {
      // An untouched row is not an incomplete row: it is the teacher saying
      // there is no lesson at that number.
      if (fields.every((field) => entry[field] === "")) return;

      for (const field of fields) {
        const value = entry[field];
        const missing = required[field];

        if (value === "") {
          if (missing !== undefined) {
            ctx.addIssue({ code: "custom", path: [field], message: missing });
          }
          continue;
        }

        const limit = MAX_LENGTH[field];
        if (value.length > limit) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: tooLong(limit),
          });
        }

        if (field === "zoomLink" && !z.url().safeParse(value).success) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: BAD_ZOOM_LINK,
          });
        }
      }
    })
    .transform((entry): TemplateDayEntry => {
      if (fields.every((field) => entry[field] === "")) {
        return { lessonNumber: entry.lessonNumber };
      }
      return {
        lessonNumber: entry.lessonNumber,
        payload: toPayload(view, entry),
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
