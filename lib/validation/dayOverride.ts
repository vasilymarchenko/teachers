import { z } from "zod";
import type { DayOverrideKind, ScheduleView } from "@/lib/db/schema/enums";
import { LESSON_NUMBERS } from "./enums";
import {
  checkSlotFields,
  isBlankSlot,
  rawSlotFields,
  toSlotPayload,
  type SlotFieldName,
} from "./slotFields";
import type { SlotPayload } from "./slotPayload";

/**
 * The day-override form — specification §5.3 and §5.4, `day_override` in schema
 * §4.9, and the Zod boundary overview §3.3 asks a payload to be validated at.
 *
 * One submission is one `date` × one `lessonNumber` × one `view`, which is
 * exactly the unique slot the database holds (`day_override_slot_uq`). The
 * fields are the lesson's own — `slotFields.ts`, shared with the template
 * editor — plus the one thing only an override has: which `kind` it is.
 *
 * **`CLEARED` is not a value this form can submit.** A tombstone carries no
 * payload at all (schema §4.9), so it is written by its own action from its own
 * button and never by parsing a payload that is meant to be absent. What this
 * schema accepts is therefore the two kinds that *are* a lesson: «правка» and
 * «заміна» (glossary §3).
 *
 * **An all-blank submission is refused**, and this is where the override differs
 * from the template day: there, an empty row is the teacher saying the lesson
 * does not exist and the slot is deleted (schema §4.8); here, deleting is
 * «Прибрати правку» and cancelling is «Скасувати урок», both of which have
 * their own button. Writing an empty payload would be a third thing the model
 * has no room for.
 */

/** The kinds a lesson-carrying override may be — everything but the tombstone. */
export const EDITABLE_OVERRIDE_KINDS = [
  "EDIT",
  "SUBSTITUTION",
] as const satisfies readonly DayOverrideKind[];

export type EditableOverrideKind = (typeof EDITABLE_OVERRIDE_KINDS)[number];

/**
 * The `name=` of every input of the form, as the component spells it. One
 * lesson per form, so the names need no prefix — unlike the template's grid of
 * rows (`templateSlotField()`).
 */
export const DAY_OVERRIDE_FIELD = {
  kind: "kind",
  subject: "subject",
  className: "className",
  teacherName: "teacherName",
  zoomLink: "zoomLink",
  note: "note",
} as const satisfies Record<"kind" | SlotFieldName, string>;

const MISSING_LESSON =
  "Заповніть урок. Щоб прибрати урок із цього дня, скористайтеся кнопкою «Скасувати урок»";

/** One override as the form submits it, before the payload is checked. */
const rawOverride = rawSlotFields.extend({
  kind: z.enum(EDITABLE_OVERRIDE_KINDS, {
    error: "Виберіть, це правка чи заміна",
  }),
});

export type RawDayOverride = z.infer<typeof rawOverride>;

/** One override after parsing — what the Server Action writes. */
export type DayOverrideFormInput = {
  kind: EditableOverrideKind;
  payload: SlotPayload;
};

export function dayOverrideInputFor(view: ScheduleView) {
  return rawOverride
    .superRefine((entry, ctx) => {
      // The refusal goes on `subject`: it is the first field of both views and
      // the one input the teacher will fill in either way, so the message is
      // rendered where she is already looking.
      if (isBlankSlot(view, entry)) {
        ctx.addIssue({
          code: "custom",
          path: [DAY_OVERRIDE_FIELD.subject],
          message: MISSING_LESSON,
        });
        return;
      }
      checkSlotFields(view, entry, ctx);
    })
    .transform(
      (entry): DayOverrideFormInput => ({
        kind: entry.kind,
        payload: toSlotPayload(view, entry),
      }),
    );
}

/** The submitted form as plain strings — every field of both views, as always. */
export function readDayOverride(formData: FormData): Record<string, string> {
  const field = (name: string): string =>
    String(formData.get(name) ?? "");

  return {
    kind: field(DAY_OVERRIDE_FIELD.kind),
    subject: field(DAY_OVERRIDE_FIELD.subject),
    className: field(DAY_OVERRIDE_FIELD.className),
    teacherName: field(DAY_OVERRIDE_FIELD.teacherName),
    zoomLink: field(DAY_OVERRIDE_FIELD.zoomLink),
    note: field(DAY_OVERRIDE_FIELD.note),
  };
}

/**
 * A `lessonNumber` taken from the URL — `/calendar/<view>/<date>/lesson/<n>`.
 *
 * `undefined` for anything the column would not hold: the screen answers that
 * with `notFound()` rather than with a guessed lesson, the same way it answers
 * a date that does not exist (T-007 §2). `'01'`, `'1.0'` and `'1e0'` are not
 * lesson numbers either — the canonical spelling is the only one, so one lesson
 * has one URL.
 */
export function parseLessonNumber(segment: string): number | undefined {
  const numbers: readonly number[] = LESSON_NUMBERS;
  const value = Number(segment);
  return /^[0-9]$/.test(segment) && numbers.includes(value) ? value : undefined;
}
