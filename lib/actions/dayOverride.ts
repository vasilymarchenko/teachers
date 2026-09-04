"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { constraintMessage } from "@/lib/db/constraintViolation";
import { dayOverride } from "@/lib/db/schema";
import type { ScheduleView } from "@/lib/db/schema/enums";
import type { IsoDate } from "@/lib/time/today";
import {
  dayOverrideInputFor,
  readDayOverride,
} from "@/lib/validation/dayOverride";
import {
  invalidInput,
  rejected,
  type FormState,
} from "@/lib/validation/formState";
import { CALENDAR_PATH, OVERRIDE_NOT_FOUND, SAVE_REFUSED } from "./calendar";

/**
 * Editing one day of the calendar — specification §5.3 and §5.4, overview §3.4,
 * `day_override` in schema §4.9. Mechanics:
 * `docs/architecture/design/T-011-day-overrides.md`.
 *
 * **Not copy-on-write, and that is the whole difference from
 * `scheduleTemplate.ts`.** A `ScheduleTemplate` is versioned because it applies
 * to every future week and editing it would rewrite days already taught (I1,
 * ADR-006). A `DayOverride` applies to **one date**: «заміна стосується лише
 * конкретної дати й не змінює ні шаблон, ні інші дні» (specification §5.4).
 * There is nothing for a new version to protect, so the three writes here are
 * an upsert, an upsert and a delete, addressed by the slot itself.
 *
 * All three take the slot — `date`, `view`, `lessonNumber` — bound by the
 * screen and not read from the form: they are the URL the teacher is on, and
 * `day_override_slot_uq` is the row they name. `userId` never comes from either
 * (overview §8.4); `requireUser()` is the first statement of every action and
 * every statement below filters by its result.
 */

const CONSTRAINT_MESSAGES = {
  day_override_number_ck: "Уроки нумеруються від 0 до 9",
  // The payload check can only fire on a row this module built wrong; it is
  // named so that such a bug arrives as itself rather than as «дані
  // суперечать іншим записам».
  day_override_payload_ck: "Скасований урок не може мати вмісту",
};

/** The four columns that identify one override — `day_override_slot_uq`. */
type Slot = {
  date: IsoDate;
  view: ScheduleView;
  lessonNumber: number;
};

/**
 * «Правка» and «заміна» — one row, `kind` apart (overview §3.4).
 *
 * The two differ only in what the calendar renders beside them: a
 * `SUBSTITUTION` shows the lesson it displaced, computed by `expand()` from the
 * version in force on the date and never stored (schema §4.9, «no
 * `replaced_original` column»). So there is nothing to write differently, and
 * switching a saved override from one kind to the other is the same upsert.
 */
export async function saveDayOverrideAction(
  slot: Slot,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = dayOverrideInputFor(slot.view).safeParse(
    readDayOverride(formData),
  );
  if (!parsed.success) return invalidInput(parsed.error, formData);

  try {
    await upsert(userId, slot, {
      kind: parsed.data.kind,
      // The parsed object, not the input: `z.object()` strips unknown keys, and
      // storing what was submitted would put them in the `jsonb` (schema §7).
      payload: parsed.data.payload,
    });
  } catch (error) {
    const message = constraintMessage(error, CONSTRAINT_MESSAGES, SAVE_REFUSED);
    if (message === undefined) throw error;
    return rejected(message, formData);
  }

  revalidatePath(CALENDAR_PATH, "layout");
  return {};
}

/**
 * «Скасувати урок» — the tombstone of specification §5.3.
 *
 * A row with an empty payload, never a delete: deleting is how an override is
 * *undone*, and the two must stay distinguishable, because a cancelled lesson
 * is shown struck through and a day with no override shows the template's
 * lesson as usual (overview §3.4, T-007 §4.1).
 *
 * Cancelling a slot the template does not fill is allowed and does nothing
 * visible — a tombstone over an absent slot resolves to no lesson, exactly as
 * an absent override would (fixtures §8.8, O8). The screen offers the button
 * only where there is a lesson to cancel; the action does not need a rule of
 * its own for a case whose outcome is already correct.
 */
export async function clearLessonAction(
  slot: Slot,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  try {
    await upsert(userId, slot, { kind: "CLEARED", payload: null });
  } catch (error) {
    const message = constraintMessage(error, CONSTRAINT_MESSAGES, SAVE_REFUSED);
    if (message === undefined) throw error;
    return rejected(message, formData);
  }

  revalidatePath(CALENDAR_PATH, "layout");
  return {};
}

/**
 * «Прибрати правку» / «Повернути урок» — the override is deleted and the
 * weekly template applies to the date again.
 *
 * This is the one write that restores: with the row gone `expand()` has nothing
 * to merge over the slot, so a cancelled lesson comes back and an edited one
 * reverts to what the version in force gives. It answers as `FormState` rather
 * than as a bare `void` action, so that a row already removed in another window
 * is a message and not a silent no-op.
 */
export async function removeDayOverrideAction(
  slot: Slot,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const removed = await getDb()
    .delete(dayOverride)
    .where(and(eq(dayOverride.userId, userId), ...slotColumns(slot)))
    .returning({ id: dayOverride.id });

  if (removed.length === 0) return rejected(OVERRIDE_NOT_FOUND, formData);

  revalidatePath(CALENDAR_PATH, "layout");
  return {};
}

/**
 * The write both saving actions make: one row per slot, replaced where it
 * exists.
 *
 * `ON CONFLICT` on `day_override_slot_uq` rather than a read followed by an
 * insert or an update — the read-then-write would be a race between two windows
 * and would end in a unique violation the teacher can do nothing with. Last
 * write wins, which is what a single-date edit with no history to lose should
 * do; the template's version machinery exists for the case where that is not
 * true.
 */
async function upsert(
  userId: string,
  slot: Slot,
  content: Pick<typeof dayOverride.$inferInsert, "kind" | "payload">,
): Promise<void> {
  await getDb()
    .insert(dayOverride)
    .values({ userId, ...slot, ...content })
    .onConflictDoUpdate({
      target: [
        dayOverride.userId,
        dayOverride.date,
        dayOverride.view,
        dayOverride.lessonNumber,
      ],
      set: { ...content, updatedAt: new Date() },
    });
}

/** The slot as a `WHERE`, in the order `day_override_slot_uq` indexes it. */
function slotColumns(slot: Slot) {
  return [
    eq(dayOverride.date, slot.date),
    eq(dayOverride.view, slot.view),
    eq(dayOverride.lessonNumber, slot.lessonNumber),
  ];
}
