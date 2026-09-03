"use server";

import { and, eq, gt, gte, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { constraintMessage } from "@/lib/db/constraintViolation";
import {
  getAcademicYear,
  listParityAnchors,
  listWeekdayRules,
  type AcademicYearRow,
} from "@/lib/db/queries/yearSetup";
import {
  academicYear,
  nonTeachingWeekdayRule,
  parityAnchor,
} from "@/lib/db/schema";
import { academicYearInput } from "@/lib/validation/academicYear";
import {
  invalidInput,
  rejected,
  type FormState,
} from "@/lib/validation/formState";
import { SAVE_REFUSED, YEAR_NOT_FOUND, YEAR_SETUP_PATH } from "./yearSetup";

/**
 * The academic year — specification §3.1, `academic_year` in schema §4.1.
 *
 * Every action here is the shape of overview §2: `requireUser()` → Zod →
 * Drizzle → revalidate. The write goes straight to Drizzle because that is what
 * overview §2 prescribes for CRUD forms — `lib/db/queries` stays read-only.
 *
 * **The year and its initial `ParityAnchor` are written together.** «Рік
 * починається з чисельника» is not a column: it is the anchor on the year's
 * first day and nothing else (schema §4.1, finding F-1). One transaction is
 * what stops a year from existing with no parity at all.
 */

const CONSTRAINT_MESSAGES = {
  academic_year_no_overlap_ex:
    "Ці дати перетинаються з іншим навчальним роком",
  academic_year_dates_ck: "Рік не може завершуватися раніше, ніж починається",
};

export async function createAcademicYearAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = academicYearInput.safeParse({
    dateFrom: formData.get("dateFrom"),
    dateTo: formData.get("dateTo"),
    initialParity: formData.get("initialParity"),
  });
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const { dateFrom, dateTo, initialParity } = parsed.data;
  let createdId: string;

  try {
    createdId = await getDb().transaction(async (tx) => {
      const [year] = await tx
        .insert(academicYear)
        .values({ userId, dateFrom, dateTo })
        .returning({ id: academicYear.id });

      await tx
        .insert(parityAnchor)
        .values({ userId, date: dateFrom, parity: initialParity })
        // A reset the teacher already entered on that date becomes the year's
        // initial value rather than a duplicate-key error: they are the same
        // row, and the year form is the one that owns the year's first day.
        .onConflictDoUpdate({
          target: [parityAnchor.userId, parityAnchor.date],
          set: { parity: initialParity },
        });

      return year.id;
    });
  } catch (error) {
    const message = constraintMessage(error, CONSTRAINT_MESSAGES, SAVE_REFUSED);
    if (message === undefined) throw error;
    return rejected(message, formData);
  }

  revalidatePath(YEAR_SETUP_PATH);
  // Outside the `try`: `redirect()` signals by throwing, and the catch above
  // would swallow the navigation. The new year becomes the selected one, so the
  // teacher lands on the sections that were not there a moment ago.
  redirect(`${YEAR_SETUP_PATH}?year=${createdId}`);
}

/**
 * What narrowing the year's dates would leave behind, or `undefined`.
 *
 * The screen shows a parity anchor or a weekday rule under the year whose dates
 * reach it (`listParityAnchors()`, `listWeekdayRules()`). Shrinking the year can
 * therefore push a row out of every screen while it goes on being read by the
 * calendar — an anchor still flipping parity in April, a weekday still blank —
 * which is the "row nothing can reach" the delete action goes out of its way to
 * avoid. So the edit is refused and the teacher removes the row first: shrinking
 * a year must not silently delete what was entered under it.
 *
 * The anchor on the old first day is exempt — the caller moves that one.
 */
async function strandedByNarrowing(
  userId: string,
  previous: AcademicYearRow,
  next: { dateFrom: string; dateTo: string },
): Promise<string | undefined> {
  const window = { from: previous.dateFrom, to: previous.dateTo };
  const [anchors, rules] = await Promise.all([
    listParityAnchors(userId, window),
    listWeekdayRules(userId, window),
  ]);

  const strandedAnchors = anchors.filter(
    (anchor) =>
      anchor.date !== previous.dateFrom &&
      (anchor.date < next.dateFrom || anchor.date > next.dateTo),
  );
  if (strandedAnchors.length > 0) {
    return "Спершу приберіть точки відліку парності, які опиняться поза новими межами року";
  }

  // The list predicate, negated: a rule is shown under a year when it starts no
  // later than the year ends and ends after the year begins.
  const strandedRules = rules.filter(
    (rule) =>
      !(rule.validFrom <= next.dateTo && rule.boundaryDate > next.dateFrom),
  );
  if (strandedRules.length > 0) {
    return "Спершу приберіть правила днів тижня, які опиняться поза новими межами року";
  }

  return undefined;
}

export async function updateAcademicYearAction(
  academicYearId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = academicYearInput.safeParse({
    dateFrom: formData.get("dateFrom"),
    dateTo: formData.get("dateTo"),
    initialParity: formData.get("initialParity"),
  });
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const existing = await getAcademicYear(userId, academicYearId);
  if (existing === null) return rejected(YEAR_NOT_FOUND, formData);

  const { dateFrom, dateTo, initialParity } = parsed.data;

  const stranded = await strandedByNarrowing(userId, existing, {
    dateFrom,
    dateTo,
  });
  if (stranded !== undefined) return rejected(stranded, formData);

  try {
    await getDb().transaction(async (tx) => {
      await tx
        .update(academicYear)
        .set({ dateFrom, dateTo })
        .where(
          and(
            eq(academicYear.userId, userId),
            eq(academicYear.id, academicYearId),
          ),
        );

      // Moving the year's first day moves its initial anchor with it: the
      // initial value *is* the anchor on that day (overview §3.5), so leaving
      // the old one behind would turn it into a reset the teacher never entered
      // and leave the new first day with no anchor at all. Resets on other
      // dates are untouched.
      if (existing.dateFrom !== dateFrom) {
        await tx
          .delete(parityAnchor)
          .where(
            and(
              eq(parityAnchor.userId, userId),
              eq(parityAnchor.date, existing.dateFrom),
            ),
          );
      }

      await tx
        .insert(parityAnchor)
        .values({ userId, date: dateFrom, parity: initialParity })
        .onConflictDoUpdate({
          target: [parityAnchor.userId, parityAnchor.date],
          set: { parity: initialParity },
        });
    });
  } catch (error) {
    const message = constraintMessage(error, CONSTRAINT_MESSAGES, SAVE_REFUSED);
    if (message === undefined) throw error;
    return rejected(message, formData);
  }

  revalidatePath(YEAR_SETUP_PATH);
  return {};
}

/**
 * Deletes the year and the whole frame that hangs off it.
 *
 * `semester` and `non_teaching_period` go with it through
 * `ON DELETE CASCADE` (schema §8). `parity_anchor` and
 * `non_teaching_weekday_rule` do not — neither has an `academic_year_id`, they
 * are keyed by date and by weekday — so they are deleted here, by **the same
 * predicates the screen listed them under** (`listParityAnchors()`,
 * `listWeekdayRules()`): what the teacher saw under this year is what goes with
 * it. Any narrower rule leaves rows that no screen can reach and that the
 * calendar goes on reading — an anchor still shifting the parity of a year that
 * no longer exists, a weekday still blank.
 */
export async function deleteAcademicYearAction(
  academicYearId: string,
): Promise<void> {
  const { id: userId } = await requireUser();

  const existing = await getAcademicYear(userId, academicYearId);
  if (existing !== null) {
    await getDb().transaction(async (tx) => {
      await tx
        .delete(parityAnchor)
        .where(
          and(
            eq(parityAnchor.userId, userId),
            gte(parityAnchor.date, existing.dateFrom),
            lte(parityAnchor.date, existing.dateTo),
          ),
        );

      await tx
        .delete(academicYear)
        .where(
          and(
            eq(academicYear.userId, userId),
            eq(academicYear.id, academicYearId),
          ),
        );

      await tx
        .delete(nonTeachingWeekdayRule)
        .where(
          and(
            eq(nonTeachingWeekdayRule.userId, userId),
            lte(nonTeachingWeekdayRule.validFrom, existing.dateTo),
            gt(nonTeachingWeekdayRule.boundaryDate, existing.dateFrom),
          ),
        );
    });
  }

  revalidatePath(YEAR_SETUP_PATH);
  redirect(YEAR_SETUP_PATH);
}
