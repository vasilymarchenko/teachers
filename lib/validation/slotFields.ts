import { z } from "zod";
import type { ScheduleView } from "@/lib/db/schema/enums";
import type { SlotPayload } from "./slotPayload";

/**
 * The fields a lesson is written with, and the rules that hold wherever it is
 * written — specification §5.1, the payload of `slotPayloadFor()`.
 *
 * Two screens write a lesson: the weekly template editor writes a
 * `TemplateSlot` (T-010, `templateDay.ts`) and the calendar writes a
 * `DayOverride` (T-011, `dayOverride.ts`). Overview §3.4 is the reason they
 * share this file rather than each having their own copy: an `EDIT` or a
 * `SUBSTITUTION` *is* a lesson, so it carries a lesson's fields, and «Вкажіть
 * предмет» reworded in one of the two places would be two products.
 *
 * What is **not** here is what the two do not share: the template's «порожній
 * рядок означає, що уроку немає» (a day of rows saves several slots at once)
 * and the override's `kind`. Each of those lives with the form that has it.
 */

const MISSING_SUBJECT = "Вкажіть предмет";
const MISSING_CLASS = "Вкажіть клас";
const MISSING_TEACHER = "Вкажіть ПІБ учителя";
const BAD_ZOOM_LINK = "Посилання має починатися з http:// або https://";

/** The fields one lesson shows, per view — specification §5.1, in its order. */
export const SLOT_FIELDS = {
  OWN: ["subject", "className"],
  CLASS: ["subject", "teacherName", "zoomLink", "note"],
} as const satisfies Record<ScheduleView, readonly string[]>;

export type SlotFieldName = (typeof SLOT_FIELDS)[ScheduleView][number];

/**
 * How long each field may be. A subject, a class and a teacher's name are short
 * by nature — the same 120 characters a `NonTeachingPeriod` name gets — while a
 * Zoom link carries a meeting id and a password token, and «додаткова
 * інформація» is deliberately free text (specification §5.1).
 */
export const MAX_SLOT_LENGTH = {
  subject: 120,
  className: 120,
  teacherName: 120,
  zoomLink: 500,
  note: 500,
} as const satisfies Record<SlotFieldName, number>;

const tooLong = (limit: number) => `Задовгий текст — до ${limit} символів`;

/** The fields a filled-in lesson may not leave blank. */
const REQUIRED_FIELDS = {
  OWN: { subject: MISSING_SUBJECT, className: MISSING_CLASS },
  CLASS: { subject: MISSING_SUBJECT, teacherName: MISSING_TEACHER },
} as const satisfies Record<ScheduleView, Partial<Record<SlotFieldName, string>>>;

/**
 * Every field of both views as the form submits it: trimmed, with the empty
 * string for the ones the teacher left blank.
 *
 * All five are read whichever view is being written, so a blank input and an
 * input the form never rendered are the same empty string — which is what makes
 * "the lesson is empty" a decision about the teacher's input and not about the
 * `FormData` keys that happen to exist.
 */
export const rawSlotFields = z.object({
  subject: z.string().trim(),
  className: z.string().trim(),
  teacherName: z.string().trim(),
  zoomLink: z.string().trim(),
  note: z.string().trim(),
});

export type RawSlotFields = z.infer<typeof rawSlotFields>;

/** Every field of the view is blank — the teacher entered no lesson at all. */
export function isBlankSlot(view: ScheduleView, fields: RawSlotFields): boolean {
  return SLOT_FIELDS[view].every((field) => fields[field] === "");
}

/**
 * The per-field rules — presence, length, and that a Zoom link is a URL —
 * reported on the field they belong to, so `FormState.fieldErrors` can put each
 * message under its own input.
 *
 * The caller decides what an all-blank input means and checks `isBlankSlot()`
 * first: for the template editor it is the absence of a slot, for the override
 * editor it is a refusal.
 */
export function checkSlotFields(
  view: ScheduleView,
  fields: RawSlotFields,
  ctx: z.RefinementCtx,
): void {
  const required: Partial<Record<string, string>> = REQUIRED_FIELDS[view];

  for (const field of SLOT_FIELDS[view]) {
    const value = fields[field];
    const missing = required[field];

    if (value === "") {
      if (missing !== undefined) {
        ctx.addIssue({ code: "custom", path: [field], message: missing });
      }
      continue;
    }

    const limit = MAX_SLOT_LENGTH[field];
    if (value.length > limit) {
      ctx.addIssue({ code: "custom", path: [field], message: tooLong(limit) });
    }

    // `z.url()` alone accepts `mailto:`, `data:` and `javascript:`, so the
    // message would promise a rule nothing enforced and the teacher would save
    // a link the calendar then refuses to make clickable — `LessonRow` renders
    // anything but `http(s)` as plain text, and that guard stays for rows
    // written before this check existed.
    if (
      field === "zoomLink" &&
      !(z.url().safeParse(value).success && /^https?:\/\//i.test(value))
    ) {
      ctx.addIssue({ code: "custom", path: [field], message: BAD_ZOOM_LINK });
    }
  }
}

/**
 * An optional free-text field, as a fragment of the payload: the **key itself**
 * is absent when the teacher left the input blank, never present with an empty
 * string or a `null` (`design/expand-fixtures.md` §8.8).
 */
const optional = (key: "zoomLink" | "note", value: string) =>
  value === "" ? {} : { [key]: value };

/** The checked fields as the payload of the view — `slotPayloadFor(view)`. */
export function toSlotPayload(
  view: ScheduleView,
  fields: RawSlotFields,
): SlotPayload {
  return view === "OWN"
    ? { subject: fields.subject, className: fields.className }
    : {
        subject: fields.subject,
        teacherName: fields.teacherName,
        ...optional("zoomLink", fields.zoomLink),
        ...optional("note", fields.note),
      };
}
