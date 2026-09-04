"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { constraintMessage } from "@/lib/db/constraintViolation";
import { getAcademicYear } from "@/lib/db/queries/yearSetup";
import { parityAnchor } from "@/lib/db/schema";
import {
  invalidInput,
  rejected,
  rejectedField,
  type FormState,
} from "@/lib/validation/formState";
import {
  PARITY_ANCHOR_FIELD,
  parityAnchorInput,
} from "@/lib/validation/parityAnchor";
import { SAVE_REFUSED, YEAR_NOT_FOUND, YEAR_SETUP_PATH } from "./yearSetup";

/**
 * Parity resets — specification §4, `parity_anchor` in schema §4.6.
 *
 * «Скидання після канікул» is not an entity of its own: the year's initial
 * value and every reset are the same `ParityAnchor` (overview §3.5). This
 * module owns the resets and `academicYear.ts` owns the anchor on the year's
 * first day, which is the initial value; the two are kept apart by the date and
 * not by a column, so this action refuses a reset dated on the year's first day
 * rather than quietly overwriting what the year form set.
 */

const CONSTRAINT_MESSAGES = {
  parity_anchor_user_date_uq: "Точка відліку на цю дату вже є",
};

export async function createParityAnchorAction(
  academicYearId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = parityAnchorInput.safeParse({
    date: formData.get("date"),
    parity: formData.get("parity"),
  });
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const year = await getAcademicYear(userId, academicYearId);
  if (year === null) return rejected(YEAR_NOT_FOUND, formData);

  const { date, parity } = parsed.data;

  if (date === year.dateFrom) {
    return rejectedField(
      PARITY_ANCHOR_FIELD.date,
      "Парність на перший день року задають у налаштуваннях року",
      formData,
    );
  }

  if (date < year.dateFrom || date > year.dateTo) {
    return rejectedField(
      PARITY_ANCHOR_FIELD.date,
      "Дата має бути в межах навчального року",
      formData,
    );
  }

  try {
    await getDb().insert(parityAnchor).values({ userId, date, parity });
  } catch (error) {
    const message = constraintMessage(error, CONSTRAINT_MESSAGES, SAVE_REFUSED);
    if (message === undefined) throw error;
    return rejected(message, formData);
  }

  revalidatePath(YEAR_SETUP_PATH);
  return {};
}

export async function deleteParityAnchorAction(
  parityAnchorId: string,
): Promise<void> {
  const { id: userId } = await requireUser();

  await getDb()
    .delete(parityAnchor)
    .where(
      and(eq(parityAnchor.userId, userId), eq(parityAnchor.id, parityAnchorId)),
    );

  revalidatePath(YEAR_SETUP_PATH);
}
