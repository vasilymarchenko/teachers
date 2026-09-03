"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { constraintMessage } from "@/lib/db/constraintViolation";
import { getAcademicYear } from "@/lib/db/queries/yearSetup";
import { nonTeachingPeriod } from "@/lib/db/schema";
import {
  invalidInput,
  rejected,
  type FormState,
} from "@/lib/validation/formState";
import { nonTeachingPeriodInput } from "@/lib/validation/nonTeachingPeriod";
import {
  OUTSIDE_THE_YEAR,
  SAVE_REFUSED,
  YEAR_NOT_FOUND,
  YEAR_SETUP_PATH,
} from "./yearSetup";

/**
 * Breaks, public holidays and unplanned days off — specification §3.1,
 * `non_teaching_period` in schema §4.3. One table, three `kind`s, one action
 * module.
 *
 * **Editing dates does not move a boundary that was already resolved against
 * them.** `NonTeachingWeekdayRule.boundaryDate` and
 * `ScheduleTemplate.validTo` were computed at write time, on purpose (overview
 * §8.1): resolving on read would let a break moved in January silently rewrite
 * what happened in October. The accepted cost is that the teacher has to check
 * the rules that ended on this break, which is what the warning on the edit
 * form is for — this action does not chase them.
 */

const PERIOD_NOT_FOUND = "Неробочий період не знайдено. Оновіть сторінку";

const CONSTRAINT_MESSAGES = {
  non_teaching_period_dates_ck:
    "Період не може завершуватися раніше, ніж починається",
};

export async function createNonTeachingPeriodAction(
  academicYearId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = nonTeachingPeriodInput.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    dateFrom: formData.get("dateFrom"),
    dateTo: formData.get("dateTo"),
  });
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const year = await getAcademicYear(userId, academicYearId);
  if (year === null) return rejected(YEAR_NOT_FOUND, formData);

  const { kind, name, dateFrom, dateTo } = parsed.data;
  if (dateFrom < year.dateFrom || dateTo > year.dateTo) {
    return rejected(OUTSIDE_THE_YEAR, formData);
  }

  try {
    await getDb()
      .insert(nonTeachingPeriod)
      .values({ userId, academicYearId, kind, name, dateFrom, dateTo });
  } catch (error) {
    const message = constraintMessage(error, CONSTRAINT_MESSAGES, SAVE_REFUSED);
    if (message === undefined) throw error;
    return rejected(message, formData);
  }

  revalidatePath(YEAR_SETUP_PATH);
  return {};
}

export async function updateNonTeachingPeriodAction(
  periodId: string,
  academicYearId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = nonTeachingPeriodInput.safeParse({
    kind: formData.get("kind"),
    name: formData.get("name"),
    dateFrom: formData.get("dateFrom"),
    dateTo: formData.get("dateTo"),
  });
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const year = await getAcademicYear(userId, academicYearId);
  if (year === null) return rejected(YEAR_NOT_FOUND, formData);

  const { kind, name, dateFrom, dateTo } = parsed.data;
  if (dateFrom < year.dateFrom || dateTo > year.dateTo) {
    return rejected(OUTSIDE_THE_YEAR, formData);
  }

  try {
    const updated = await getDb()
      .update(nonTeachingPeriod)
      .set({ kind, name, dateFrom, dateTo })
      .where(
        and(
          eq(nonTeachingPeriod.userId, userId),
          eq(nonTeachingPeriod.id, periodId),
        ),
      )
      // A row deleted in another tab must not come back as a clean save: the
      // UPDATE matches nothing and Drizzle reports success either way.
      .returning({ id: nonTeachingPeriod.id });

    if (updated.length === 0) return rejected(PERIOD_NOT_FOUND, formData);
  } catch (error) {
    const message = constraintMessage(error, CONSTRAINT_MESSAGES, SAVE_REFUSED);
    if (message === undefined) throw error;
    return rejected(message, formData);
  }

  revalidatePath(YEAR_SETUP_PATH);
  return {};
}

export async function deleteNonTeachingPeriodAction(
  periodId: string,
): Promise<void> {
  const { id: userId } = await requireUser();

  await getDb()
    .delete(nonTeachingPeriod)
    .where(
      and(
        eq(nonTeachingPeriod.userId, userId),
        eq(nonTeachingPeriod.id, periodId),
      ),
    );

  revalidatePath(YEAR_SETUP_PATH);
}
