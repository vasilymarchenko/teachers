"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { constraintMessage } from "@/lib/db/constraintViolation";
import { getAcademicYear } from "@/lib/db/queries/yearSetup";
import { semester } from "@/lib/db/schema";
import {
  invalidInput,
  rejected,
  type FormState,
} from "@/lib/validation/formState";
import { semesterInput } from "@/lib/validation/semester";
import {
  OUTSIDE_THE_YEAR,
  SAVE_REFUSED,
  YEAR_NOT_FOUND,
  YEAR_SETUP_PATH,
} from "./yearSetup";

/**
 * The two semesters of a year — specification §3.2, `semester` in schema §4.2.
 *
 * Two rules are checked in two different places on purpose. That a semester
 * lies inside its year is checked here, because it needs the year row and no
 * database constraint expresses it. That two semesters do not overlap is left
 * to `semester_no_overlap_ex`: checking it here would be a race between two
 * submissions that both read "no overlap" before either wrote.
 */

const SEMESTER_NOT_FOUND = "Семестр не знайдено. Оновіть сторінку";

const CONSTRAINT_MESSAGES = {
  semester_year_index_uq: "Такий семестр у цьому році вже є",
  semester_no_overlap_ex: "Ці дати перетинаються з іншим семестром",
  semester_dates_ck: "Семестр не може завершуватися раніше, ніж починається",
};

export async function createSemesterAction(
  academicYearId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = semesterInput.safeParse({
    index: formData.get("index"),
    dateFrom: formData.get("dateFrom"),
    dateTo: formData.get("dateTo"),
  });
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const year = await getAcademicYear(userId, academicYearId);
  if (year === null) return rejected(YEAR_NOT_FOUND, formData);

  const { index, dateFrom, dateTo } = parsed.data;
  if (dateFrom < year.dateFrom || dateTo > year.dateTo) {
    return rejected(OUTSIDE_THE_YEAR, formData);
  }

  try {
    await getDb()
      .insert(semester)
      .values({ userId, academicYearId, index, dateFrom, dateTo });
  } catch (error) {
    const message = constraintMessage(error, CONSTRAINT_MESSAGES, SAVE_REFUSED);
    if (message === undefined) throw error;
    return rejected(message, formData);
  }

  revalidatePath(YEAR_SETUP_PATH);
  return {};
}

export async function updateSemesterAction(
  semesterId: string,
  academicYearId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = semesterInput.safeParse({
    index: formData.get("index"),
    dateFrom: formData.get("dateFrom"),
    dateTo: formData.get("dateTo"),
  });
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const year = await getAcademicYear(userId, academicYearId);
  if (year === null) return rejected(YEAR_NOT_FOUND, formData);

  const { index, dateFrom, dateTo } = parsed.data;
  if (dateFrom < year.dateFrom || dateTo > year.dateTo) {
    return rejected(OUTSIDE_THE_YEAR, formData);
  }

  try {
    const updated = await getDb()
      .update(semester)
      .set({ index, dateFrom, dateTo })
      .where(and(eq(semester.userId, userId), eq(semester.id, semesterId)))
      // A row deleted in another tab must not come back as a clean save: the
      // UPDATE matches nothing and Drizzle reports success either way.
      .returning({ id: semester.id });

    if (updated.length === 0) return rejected(SEMESTER_NOT_FOUND, formData);
  } catch (error) {
    const message = constraintMessage(error, CONSTRAINT_MESSAGES, SAVE_REFUSED);
    if (message === undefined) throw error;
    return rejected(message, formData);
  }

  revalidatePath(YEAR_SETUP_PATH);
  return {};
}

export async function deleteSemesterAction(
  semesterId: string,
): Promise<void> {
  const { id: userId } = await requireUser();

  await getDb()
    .delete(semester)
    .where(and(eq(semester.userId, userId), eq(semester.id, semesterId)));

  revalidatePath(YEAR_SETUP_PATH);
}
