import { z, type ZodError } from "zod";
import { lessonEnd } from "@/lib/domain/schedule/bells";
import { LESSON_NUMBERS } from "./enums";
import { clockTimeField, clockTimeInput } from "./fields";

/**
 * The bell-schedule form — specification §3.3, `bell_schedule` in schema §4.5.
 *
 * One form for all ten lesson numbers, because that is how the teacher reads a
 * bell schedule: a column of times, not ten records to create one at a time.
 * A start left empty means **no row** — «використовуються не всі номери» — so
 * the same submission creates, updates and deletes, and the ten `lessonNumber`s
 * are always all present in the input even when most of them are blank.
 *
 * The form carries no end of a lesson: the teacher enters each start and one
 * `lessonMinutes` for all of them, and the end is `lessonEnd()` of the two
 * (overview §9). This schema checks what the computed ends make of the grid —
 * past midnight, running into the next lesson — but hands back only starts and
 * the length; the action computes the ends it stores.
 *
 * Unlike the other forms in this directory the field names are computed
 * (`bellField()`) rather than listed, so there is no `satisfies` pair to keep
 * them honest; `bellFieldErrors()` is the other half of the same mapping and
 * `bellSchedule.test.ts` pins both.
 */

export const MIN_LESSON_MINUTES = 10;
export const MAX_LESSON_MINUTES = 90;

const LESSON_MINUTES_RULE = `Тривалість уроку — ціле число хвилин від ${MIN_LESSON_MINUTES} до ${MAX_LESSON_MINUTES}`;
const PAST_MIDNIGHT = "Урок має закінчуватися не пізніше 23:59";
const STARTS_GROW = "Урок має починатися пізніше за попередній";
const overlapsPrevious = (previousEnd: string) =>
  `Попередній урок закінчується о ${previousEnd} — цей не може початися раніше`;

/** The `name=` of the lesson-length input. */
export const LESSON_MINUTES_FIELD = "lessonMinutes";

/**
 * `lessonMinutes` as typed — a whole number of minutes within the allowed
 * range, or `undefined`. The form's preview reads the field through this as
 * well, so it shows an end exactly when a save would compute one.
 */
export function parseLessonMinutes(raw: string): number | undefined {
  const typed = raw.trim();
  if (!/^\d+$/.test(typed)) return undefined;

  const minutes = Number(typed);
  return minutes >= MIN_LESSON_MINUTES && minutes <= MAX_LESSON_MINUTES
    ? minutes
    : undefined;
}

/** The grid as submitted: every value still the string the teacher typed. */
const bellGrid = z.object({
  lessonMinutes: z.string(),
  // Exactly ten entries, in `LESSON_NUMBERS` order — which is what lets
  // `bellFieldErrors()` read a lesson number off an array index, and what makes
  // "the previous lesson" below the previous element.
  bells: z
    .array(
      z.object({
        lessonNumber: z
          .number()
          .int()
          .min(0)
          .max(9),
        timeFrom: z.string(),
      }),
    )
    .length(LESSON_NUMBERS.length, "Розклад дзвінків має містити уроки 0–9"),
});

export const bellScheduleInput = bellGrid
  .superRefine((grid, ctx) => {
    const lessonMinutes = parseLessonMinutes(grid.lessonMinutes);
    if (lessonMinutes === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["lessonMinutes"],
        message: LESSON_MINUTES_RULE,
      });
    }

    // The last filled, well-formed lesson above the one being looked at.
    let previous: { timeFrom: string; timeTo: string | undefined } | undefined;

    grid.bells.forEach((bell, index) => {
      const timeFrom = clockTimeInput(bell.timeFrom);
      if (timeFrom === "") return;

      const path = ["bells", index, "timeFrom"];

      const time = clockTimeField.safeParse(timeFrom);
      if (!time.success) {
        // The message belongs to `clockTimeField`; repeating it here would be
        // a second place to change it.
        ctx.addIssue({ code: "custom", path, message: time.error.issues[0].message });
        // Nothing is compared against a start that is not a time: reporting
        // "starts before the previous one" on top of "not HH:MM" would name a
        // problem the teacher does not have.
        previous = undefined;
        return;
      }

      // Every rule below is about an end, and there is none to compute until
      // the length is fixed; that field already carries its own message.
      if (lessonMinutes === undefined) return;

      const timeTo = lessonEnd(timeFrom, lessonMinutes);

      // `HH:MM` is zero-padded, so a string comparison is a time comparison —
      // the same reasoning that lets the domain compare `IsoDate` with `<=`.
      if (previous !== undefined && timeFrom <= previous.timeFrom) {
        ctx.addIssue({ code: "custom", path, message: STARTS_GROW });
      } else if (previous?.timeTo !== undefined && timeFrom < previous.timeTo) {
        ctx.addIssue({
          code: "custom",
          path,
          message: overlapsPrevious(previous.timeTo),
        });
      }

      if (timeTo === undefined) {
        ctx.addIssue({ code: "custom", path, message: PAST_MIDNIGHT });
      }

      previous = { timeFrom, timeTo };
    });
  })
  .transform((grid, ctx) => {
    const lessonMinutes = parseLessonMinutes(grid.lessonMinutes);
    if (lessonMinutes === undefined) {
      // Unreachable after the refinement above; it is here so the output type
      // is a number without an assertion.
      ctx.issues.push({
        code: "custom",
        path: ["lessonMinutes"],
        message: LESSON_MINUTES_RULE,
        input: grid.lessonMinutes,
      });
      return z.NEVER;
    }

    return {
      lessonMinutes,
      bells: grid.bells.map((bell) => ({
        lessonNumber: bell.lessonNumber,
        // `""` for a lesson number the teacher does not use.
        timeFrom: clockTimeInput(bell.timeFrom),
      })),
    };
  });

export type BellScheduleInput = z.infer<typeof bellScheduleInput>;
export type BellEntry = BellScheduleInput["bells"][number];

/** The `name=` of one lesson's start input. */
export function bellField(lessonNumber: number): string {
  return `bell-${lessonNumber}-from`;
}

/**
 * The form's issues keyed by field name, for `FormState.fieldErrors`.
 *
 * `z.flattenError()` cannot do this: it flattens the top level, and every issue
 * of the grid is nested under `bells.<index>.timeFrom`. The index is the lesson
 * number because `bellScheduleInput` requires all ten entries in order.
 *
 * The first message per field wins, like `invalidInput()` — the input shows one
 * line.
 */
export function bellFieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const [root, lessonNumber, key] = issue.path;

    if (root === "lessonMinutes") {
      errors[LESSON_MINUTES_FIELD] ??= issue.message;
      continue;
    }

    if (root !== "bells" || typeof lessonNumber !== "number") continue;
    if (key !== "timeFrom") continue;

    errors[bellField(lessonNumber)] ??= issue.message;
  }

  return errors;
}
