"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { constraintMessage } from "@/lib/db/constraintViolation";
import {
  getAcademicYear,
  getWeekdayRule,
  listNonTeachingPeriods,
  listSemesters,
} from "@/lib/db/queries/yearSetup";
import type { BoundaryKind } from "@/lib/db/schema/enums";
import { nonTeachingWeekdayRule } from "@/lib/db/schema";
import { resolveBoundary, ruleValidFrom } from "@/lib/domain/schedule/boundaries";
import { today, type IsoDate } from "@/lib/time/today";
import {
  invalidInput,
  rejected,
  rejectedField,
  type FormState,
} from "@/lib/validation/formState";
import {
  WEEKDAY_RULE_FIELD,
  weekdayRuleInput,
} from "@/lib/validation/weekdayRule";
import { SAVE_REFUSED, YEAR_NOT_FOUND, YEAR_SETUP_PATH } from "./yearSetup";

/**
 * Weekdays excluded from the schedule — specification §3.4,
 * `non_teaching_weekday_rule` in schema §4.4.
 *
 * This is where overview §8.1 happens: the teacher chooses «до дати Х» / «до
 * найближчих канікул» / «до кінця семестру», and what gets stored is the
 * resolved `boundaryDate` together with the `boundaryKind` that says how it was
 * chosen. `expand()` never resolves anything afterwards, which is what keeps a
 * break moved in January from rewriting October.
 *
 * `validFrom` is not the teacher's to choose — ADR-004.
 */

const CONSTRAINT_MESSAGES = {
  ntwr_range_ck: "Правило має діяти хоча б один день",
};

/**
 * A symbol that resolves to nothing usable is not an error but a question the
 * teacher has to answer: there are no breaks entered yet, no semester still
 * running, or the chosen last day has already passed. The message says which,
 * and lands on the field that has to change.
 */
function unresolvableBoundary(
  kind: BoundaryKind,
  formData: FormData,
): FormState {
  switch (kind) {
    case "NEXT_BREAK":
      return rejectedField(
        WEEKDAY_RULE_FIELD.boundaryKind,
        "Після початку дії правила немає канікул. Додайте канікули або виберіть дату",
        formData,
      );
    case "END_OF_SEMESTER":
      return rejectedField(
        WEEKDAY_RULE_FIELD.boundaryKind,
        "Немає семестру, який ще триває. Додайте семестри або виберіть дату",
        formData,
      );
    case "DATE":
      return rejectedField(
        WEEKDAY_RULE_FIELD.lastDay,
        "Останній день має бути пізніше за день, з якого діє правило",
        formData,
      );
  }
}

/**
 * The resolved boundary for a rule that starts on `validFrom`, or `undefined`.
 *
 * The breaks are the `BREAK` periods only — «найближчі канікули» means a break,
 * not a public holiday (schema §4.3).
 */
async function resolveFor(
  userId: string,
  academicYearId: string,
  validFrom: IsoDate,
  kind: BoundaryKind,
  lastDay: IsoDate | undefined,
): Promise<IsoDate | undefined> {
  const [semesters, periods] = await Promise.all([
    listSemesters(userId, academicYearId),
    listNonTeachingPeriods(userId, academicYearId),
  ]);

  return resolveBoundary({
    kind,
    referenceDate: validFrom,
    lastDay,
    breaks: periods.filter((period) => period.kind === "BREAK"),
    semesters,
  });
}

export async function createWeekdayRuleAction(
  academicYearId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = weekdayRuleInput.safeParse({
    weekday: formData.get("weekday"),
    boundaryKind: formData.get("boundaryKind"),
    lastDay: formData.get("lastDay") ?? "",
  });
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const year = await getAcademicYear(userId, academicYearId);
  if (year === null) return rejected(YEAR_NOT_FOUND, formData);

  const { weekday, boundaryKind, lastDay } = parsed.data;
  // ADR-004: the year's first day when the year has not started, today when it
  // has — so a rule entered in March does not reach back over March's Fridays.
  const validFrom = ruleValidFrom(year.dateFrom, today());
  const boundaryDate = await resolveFor(
    userId,
    academicYearId,
    validFrom,
    boundaryKind,
    lastDay,
  );
  if (boundaryDate === undefined) {
    return unresolvableBoundary(boundaryKind, formData);
  }

  try {
    await getDb()
      .insert(nonTeachingWeekdayRule)
      .values({ userId, weekday, validFrom, boundaryDate, boundaryKind });
  } catch (error) {
    const message = constraintMessage(error, CONSTRAINT_MESSAGES, SAVE_REFUSED);
    if (message === undefined) throw error;
    return rejected(message, formData);
  }

  revalidatePath(YEAR_SETUP_PATH);
  return {};
}

export async function updateWeekdayRuleAction(
  ruleId: string,
  academicYearId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = weekdayRuleInput.safeParse({
    weekday: formData.get("weekday"),
    boundaryKind: formData.get("boundaryKind"),
    lastDay: formData.get("lastDay") ?? "",
  });
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const existing = await getWeekdayRule(userId, ruleId);
  if (existing === null) {
    return rejected("Правило не знайдено. Оновіть сторінку", formData);
  }

  const { weekday, boundaryKind, lastDay } = parsed.data;
  // The rule keeps the day it started on: an edit changes where it ends, not
  // the weeks it already governed.
  const { validFrom } = existing;
  const boundaryDate = await resolveFor(
    userId,
    academicYearId,
    validFrom,
    boundaryKind,
    lastDay,
  );
  if (boundaryDate === undefined) {
    return unresolvableBoundary(boundaryKind, formData);
  }

  try {
    await getDb()
      .update(nonTeachingWeekdayRule)
      .set({ weekday, boundaryDate, boundaryKind })
      .where(
        and(
          eq(nonTeachingWeekdayRule.userId, userId),
          eq(nonTeachingWeekdayRule.id, ruleId),
        ),
      );
  } catch (error) {
    const message = constraintMessage(error, CONSTRAINT_MESSAGES, SAVE_REFUSED);
    if (message === undefined) throw error;
    return rejected(message, formData);
  }

  revalidatePath(YEAR_SETUP_PATH);
  return {};
}

export async function deleteWeekdayRuleAction(
  ruleId: string,
): Promise<void> {
  const { id: userId } = await requireUser();

  await getDb()
    .delete(nonTeachingWeekdayRule)
    .where(
      and(
        eq(nonTeachingWeekdayRule.userId, userId),
        eq(nonTeachingWeekdayRule.id, ruleId),
      ),
    );

  revalidatePath(YEAR_SETUP_PATH);
}
