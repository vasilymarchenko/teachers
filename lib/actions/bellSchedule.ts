"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { constraintMessage } from "@/lib/db/constraintViolation";
import { bellSchedule } from "@/lib/db/schema";
import {
  bellField,
  bellFieldErrors,
  bellScheduleInput,
} from "@/lib/validation/bellSchedule";
import { LESSON_NUMBERS } from "@/lib/validation/enums";
import {
  rejected,
  submittedValues,
  type FormState,
} from "@/lib/validation/formState";
import { SAVE_REFUSED, YEAR_SETUP_PATH } from "./yearSetup";

/**
 * The bell schedule — specification §3.3, `bell_schedule` in schema §4.5.
 *
 * One action for the whole grid, and therefore one action that creates, updates
 * and deletes: a row the teacher cleared is a row that must go, because «не всі
 * номери використовуються» and a lesson number with no row is what makes
 * `expand()` leave the times off (fixtures §3.4).
 *
 * It is not scoped to the academic year — `bell_schedule` is keyed by
 * `(user_id, lesson_number)` and by nothing else, which is overview §4 read
 * literally (schema §4.5, finding F-2). Changing the bells changes them for
 * every year the teacher has.
 */

const CONSTRAINT_MESSAGES = {
  bell_schedule_times_ck: "Урок не може завершуватися раніше, ніж починається",
  bell_schedule_number_ck: "Уроки нумеруються від 0 до 9",
};

export async function saveBellScheduleAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  // All ten rows, in order, whether or not the teacher filled them in:
  // `bellFieldErrors()` reads a lesson number off the array index.
  const bells = LESSON_NUMBERS.map((lessonNumber) => ({
    lessonNumber,
    timeFrom: String(formData.get(bellField(lessonNumber, "from")) ?? ""),
    timeTo: String(formData.get(bellField(lessonNumber, "to")) ?? ""),
  }));

  const parsed = bellScheduleInput.safeParse({ bells });
  if (!parsed.success) {
    return {
      fieldErrors: bellFieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  const filled = parsed.data.bells.filter((bell) => bell.timeFrom !== "");
  const cleared = parsed.data.bells
    .filter((bell) => bell.timeFrom === "")
    .map((bell) => bell.lessonNumber);

  try {
    await getDb().transaction(async (tx) => {
      if (cleared.length > 0) {
        await tx
          .delete(bellSchedule)
          .where(
            and(
              eq(bellSchedule.userId, userId),
              inArray(bellSchedule.lessonNumber, cleared),
            ),
          );
      }

      if (filled.length > 0) {
        await tx
          .insert(bellSchedule)
          .values(
            filled.map((bell) => ({
              userId,
              lessonNumber: bell.lessonNumber,
              timeFrom: bell.timeFrom,
              timeTo: bell.timeTo,
            })),
          )
          // `bell_schedule_user_number_uq` makes this the update path too: the
          // teacher edits a grid, not ten records with identities of their own.
          .onConflictDoUpdate({
            target: [bellSchedule.userId, bellSchedule.lessonNumber],
            set: {
              timeFrom: sql`excluded.time_from`,
              timeTo: sql`excluded.time_to`,
            },
          });
      }
    });
  } catch (error) {
    const message = constraintMessage(error, CONSTRAINT_MESSAGES, SAVE_REFUSED);
    if (message === undefined) throw error;
    return rejected(message, formData);
  }

  revalidatePath(YEAR_SETUP_PATH);
  return {};
}
