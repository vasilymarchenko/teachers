import { z, type ZodError } from "zod";
import { LESSON_NUMBERS } from "./enums";
import { clockTimeField } from "./fields";

/**
 * The bell-schedule form — specification §3.3, `bell_schedule` in schema §4.5.
 *
 * One form for all ten lesson numbers, because that is how the teacher reads a
 * bell schedule: a column of times, not ten records to create one at a time.
 * A row left empty means **no row** — «використовуються не всі номери» — so the
 * same submission creates, updates and deletes, and the ten `lessonNumber`s are
 * always all present in the input even when most of them are blank.
 *
 * Unlike the other forms in this directory the field names are computed
 * (`bellField()`) rather than listed, so there is no `satisfies` pair to keep
 * them honest; `bellFieldErrors()` is the other half of the same mapping and
 * `bellSchedule.test.ts` pins both.
 */

const BOTH_OR_NEITHER =
  "Вкажіть початок і кінець уроку або залиште рядок порожнім";
const TIME_ORDER = "Кінець уроку має бути пізніше за його початок";

/**
 * One line of the grid. `timeFrom`/`timeTo` are plain strings here and are
 * checked by the refinement, not by `clockTimeField` directly, because the
 * empty string is a legal value for the pair and not for one half of it.
 */
const bellEntry = z
  .object({
    lessonNumber: z
      .number()
      .int()
      .min(0)
      .max(9),
    timeFrom: z.string().trim(),
    timeTo: z.string().trim(),
  })
  .superRefine((entry, ctx) => {
    if (entry.timeFrom === "" && entry.timeTo === "") return;

    let wellFormed = true;

    for (const key of ["timeFrom", "timeTo"] as const) {
      const value = entry[key];
      if (value === "") {
        ctx.addIssue({ code: "custom", path: [key], message: BOTH_OR_NEITHER });
        wellFormed = false;
        continue;
      }
      const time = clockTimeField.safeParse(value);
      if (!time.success) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          // The message belongs to `clockTimeField`; repeating it here would be
          // a second place to change it.
          message: time.error.issues[0].message,
        });
        wellFormed = false;
      }
    }

    // `HH:MM` is zero-padded, so a string comparison is a time comparison — the
    // same reasoning that lets the domain compare `IsoDate` with `<=`. It is
    // only a time comparison for well-formed values, though: `"8:30" >= "09:15"`
    // is true as a string, and reporting "ends before it starts" on top of "not
    // HH:MM" would name a second problem the teacher does not have.
    if (wellFormed && entry.timeFrom >= entry.timeTo) {
      ctx.addIssue({ code: "custom", path: ["timeTo"], message: TIME_ORDER });
    }
  });

/**
 * The whole grid. Exactly ten entries, in `LESSON_NUMBERS` order — which is
 * what lets `bellFieldErrors()` read a lesson number off an array index.
 */
export const bellScheduleInput = z.object({
  bells: z
    .array(bellEntry)
    .length(LESSON_NUMBERS.length, "Розклад дзвінків має містити уроки 0–9"),
});

export type BellScheduleInput = z.infer<typeof bellScheduleInput>;
export type BellEntry = BellScheduleInput["bells"][number];

/** The `name=` of one input of the grid. */
export function bellField(lessonNumber: number, edge: "from" | "to"): string {
  return `bell-${lessonNumber}-${edge}`;
}

/**
 * The grid's issues keyed by field name, for `FormState.fieldErrors`.
 *
 * `z.flattenError()` cannot do this: it flattens the top level, and every issue
 * here is nested under `bells.<index>.<key>`. The index is the lesson number
 * because `bellScheduleInput` requires all ten entries in order.
 *
 * The first message per field wins, like `invalidInput()` — the input shows one
 * line.
 */
export function bellFieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const [root, lessonNumber, key] = issue.path;
    if (root !== "bells" || typeof lessonNumber !== "number") continue;

    const edge = key === "timeFrom" ? "from" : key === "timeTo" ? "to" : undefined;
    if (edge === undefined) continue;

    const field = bellField(lessonNumber, edge);
    errors[field] ??= issue.message;
  }

  return errors;
}
