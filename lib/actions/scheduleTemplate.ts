"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { constraintMessage } from "@/lib/db/constraintViolation";
import {
  getNextTemplateVersionStart,
  getTemplateVersionInForce,
} from "@/lib/db/queries/templateEditor";
import { listNonTeachingPeriods } from "@/lib/db/queries/yearSetup";
import {
  getUpcomingYearFrame,
  getYearFrame,
} from "@/lib/db/queries/yearFrame";
import { scheduleTemplate, templateSlot } from "@/lib/db/schema";
import type {
  BoundaryKind,
  Parity,
  ScheduleView,
  Weekday,
} from "@/lib/db/schema/enums";
import {
  resolveBoundary,
  ruleValidFrom,
} from "@/lib/domain/schedule/boundaries";
import {
  capToNextVersion,
  planTemplateEdit,
  type TemplateBoundary,
} from "@/lib/domain/schedule/copyOnWrite";
import { copyParity, replaceDaySlots } from "@/lib/domain/schedule/templateSlots";
import type { TemplateSlotInput } from "@/lib/domain/schedule/types";
import { today, type IsoDate } from "@/lib/time/today";
import {
  invalidInput,
  rejected,
  rejectedField,
  submittedValues,
  type FormState,
} from "@/lib/validation/formState";
import {
  TEMPLATE_BOUNDARY_FIELD,
  templateBoundaryInput,
} from "@/lib/validation/templateBoundary";
import {
  readTemplateDay,
  templateDayFieldErrors,
  templateDayInputFor,
} from "@/lib/validation/templateDay";
import {
  NO_YEAR,
  SAVE_REFUSED,
  SCHEDULE_PATH,
  VERSION_CHANGED,
} from "./schedule";

/**
 * The weekly template editor's writes — T-010, specification §5.1 and §5.2,
 * overview §3.2.
 *
 * **Every write here is copy-on-write, and there is exactly one of them.** A
 * day saved, a parity week copied and the boundary moved differ only in how
 * they transform the version's set of slots, so all three go through
 * `applyTemplateEdit()` and therefore through `planTemplateEdit()` (T-005),
 * whose cut is always `today()`. That is invariant I1 with no second path to
 * guard: there is no code here that updates a live version's slots in place,
 * and no cut date that could arrive from a form.
 * `decisions/ADR-006-template-day-is-the-save-unit.md` records why the day is
 * the unit and why the boundary is not an exception.
 *
 * The mechanics — the three branches, the order of the writes, what is
 * inherited — are in
 * `docs/architecture/design/T-010-weekly-template-editor.md`.
 */

const CONSTRAINT_MESSAGES = {
  // I3, the exclusion constraint: another submission created a version for
  // these dates between this one's read and its write.
  schedule_template_no_overlap_ex: VERSION_CHANGED,
  schedule_template_range_ck: "Розклад має діяти хоча б один день",
  template_slot_number_ck: "Уроки нумеруються від 0 до 9",
};

/** Thrown inside the transaction to roll it back and answer as a message. */
class VersionChanged extends Error {}

/** How the new version's `[validFrom, validTo)` upper bound was arrived at. */
/**
 * The stored pair of §8.1. Declared in `lib/domain/schedule/copyOnWrite.ts`
 * because `capToNextVersion()` may change both halves of it at once.
 */
type Boundary = TemplateBoundary;

/** What the teacher chose in the «доки діє» form, before it is resolved. */
type BoundaryChoice = { kind: BoundaryKind; lastDay?: IsoDate };

/**
 * The upper bound for the version an edit is about to create.
 *
 * Three cases, in the order the specification introduces them (§5.1):
 *
 *  - the teacher named one in the «доки діє» form — resolve that symbol;
 *  - there is a version in force — the new one ends where it ended, carrying
 *    its `boundaryKind` verbatim. §8.1 forbids re-resolving a symbol later, so
 *    the stored pair moves across unchanged rather than being recomputed;
 *  - neither — «за замовчуванням шаблон розгортається до кінця поточного
 *    семестру», resolved now.
 */
async function boundaryFor(
  userId: string,
  cutAt: IsoDate,
  inherited: Boundary | undefined,
  choice: BoundaryChoice | undefined,
): Promise<Boundary | { error: "unresolvable" | "noYear"; kind: BoundaryKind }> {
  if (choice === undefined && inherited !== undefined) return inherited;

  const kind = choice?.kind ?? "END_OF_SEMESTER";

  if (kind === "DATE") {
    const validTo = resolveBoundary({
      kind,
      referenceDate: cutAt,
      lastDay: choice?.lastDay,
    });
    return validTo === undefined
      ? { error: "unresolvable", kind }
      : { validTo, boundaryKind: kind };
  }

  // A symbol resolves against the year the cut date falls in — its breaks and
  // its semesters — which is exactly what makes it a symbol the teacher can
  // read back («до зимових канікул») rather than a date they had to look up.
  //
  // Before the year begins there is no such year, and that is not an error but
  // the setup order ADR-004 calls the ordinary case: September is entered in
  // August. The symbol then means the year about to start, resolved from its
  // first day. `ruleValidFrom()` is the expression ADR-004 settled on — the
  // later of the year's first day and today — so the mid-year case still
  // resolves against `cutAt` and nothing about it changes.
  const frame =
    (await getYearFrame(userId, cutAt)) ??
    (await getUpcomingYearFrame(userId, cutAt));
  if (frame === null) return { error: "noYear", kind };

  const periods = await listNonTeachingPeriods(userId, frame.id);
  const validTo = resolveBoundary({
    kind,
    referenceDate: ruleValidFrom(frame.dateFrom, cutAt),
    breaks: periods.filter((period) => period.kind === "BREAK"),
    semesters: frame.semesters,
  });

  return validTo === undefined
    ? { error: "unresolvable", kind }
    : { validTo, boundaryKind: kind };
}

/**
 * A symbol that resolved to nothing usable, as a message and the field it
 * belongs to.
 *
 * The field only helps on the form that has it. A day save and a parity copy
 * carry no boundary inputs, and they reach this too — the default
 * `END_OF_SEMESTER` of specification §5.1 has nothing to resolve against until
 * the year has semesters. Putting the message on `boundaryKind` there would
 * render it nowhere at all, and the teacher would press «Зберегти» and watch
 * nothing happen. `boundaryRefusal()` below is what decides.
 */
function unresolvableBoundary(kind: BoundaryKind): {
  field: string;
  message: string;
} {
  switch (kind) {
    case "NEXT_BREAK":
      return {
        field: TEMPLATE_BOUNDARY_FIELD.boundaryKind,
        message:
          "Попереду немає канікул. Додайте канікули в налаштуваннях року або виберіть дату",
      };
    case "END_OF_SEMESTER":
      return {
        field: TEMPLATE_BOUNDARY_FIELD.boundaryKind,
        message:
          "Немає семестру, який ще триває. Додайте семестри в налаштуваннях року або виберіть дату",
      };
    case "DATE":
      return {
        field: TEMPLATE_BOUNDARY_FIELD.lastDay,
        message: "Останній день має бути пізніше за сьогодні",
      };
  }
}

/**
 * The refusal, on the field that shows it when there is one and on the form as
 * a whole when there is not.
 *
 * `fromBoundaryForm` is whether this submission carried the boundary inputs —
 * i.e. whether the teacher is looking at the control the message names.
 */
function boundaryRefusal(
  kind: BoundaryKind,
  fromBoundaryForm: boolean,
  formData: FormData,
): FormState {
  const { field, message } = unresolvableBoundary(kind);
  return fromBoundaryForm
    ? rejectedField(field, message, formData)
    : rejected(message, formData);
}

/**
 * One edit of one view: copy the version in force forward with its slots
 * transformed, and freeze what it covered up to today.
 *
 * `mutate` receives **every** slot of the version in force — both parity weeks
 * and all seven weekdays — and returns the set the new version will hold. It is
 * a pure function from `lib/domain/schedule/templateSlots.ts`, which is what
 * keeps the three actions below identical apart from their names.
 */
async function applyTemplateEdit(
  userId: string,
  view: ScheduleView,
  mutate: (slots: readonly TemplateSlotInput[]) => TemplateSlotInput[],
  formData: FormData,
  choice?: BoundaryChoice,
): Promise<FormState> {
  // One instant for the whole edit. `today()` is read here and again inside
  // `planTemplateEdit()`, and across a Kyiv midnight two readings are two
  // different dates — the reads and the guards would be about yesterday and the
  // plan about today. `now` is the parameter `planTemplateEdit()` documents for
  // exactly this: an instant, never a date, so the cut still comes from
  // `lib/time/today.ts` and never from a form (overview §8.5, §3.2 I1).
  const now = new Date();
  const cutAt = today(now);
  const [current, nextStart] = await Promise.all([
    getTemplateVersionInForce(userId, view, cutAt),
    getNextTemplateVersionStart(userId, view, cutAt),
  ]);

  const boundary = await boundaryFor(
    userId,
    cutAt,
    current === null
      ? undefined
      : { validTo: current.validTo, boundaryKind: current.boundaryKind },
    choice,
  );
  if ("error" in boundary) {
    return boundary.error === "noYear"
      ? rejected(NO_YEAR, formData)
      : boundaryRefusal(boundary.kind, choice !== undefined, formData);
  }

  // The new version stops where a later one starts, rather than running into it
  // and being refused by I3 with nothing the teacher can act on. The whole pair
  // is capped: a date taken from the next version is a `DATE` boundary, and
  // storing it under the symbol it replaced would make the screen say something
  // untrue about it (§8.1).
  const capped = capToNextVersion(boundary, nextStart);
  const validTo = capped.validTo;

  // A version in force always ends after today, a resolved boundary is always
  // after the date it was resolved against, and a later version always starts
  // after the cut — so this holds for every path above, and `planTemplateEdit()`
  // would throw rather than write a range the check constraint rejects.
  if (validTo <= cutAt) {
    return boundaryRefusal("DATE", choice !== undefined, formData);
  }

  const plan = planTemplateEdit({
    current:
      current === null
        ? undefined
        : {
            id: current.id,
            validFrom: current.validFrom,
            validTo: current.validTo,
          },
    validTo,
    now,
  });

  const slots = mutate(current?.slots ?? []);

  try {
    await getDb().transaction(async (tx) => {
      if (plan.trim !== undefined) {
        // I2: the version in force ends at the cut, and what it covered before
        // today is frozen for good. It is trimmed **before** the insert, so the
        // two never overlap even for the length of a statement.
        const trimmed = await tx
          .update(scheduleTemplate)
          .set({ validTo: plan.trim.validTo })
          .where(
            and(
              eq(scheduleTemplate.userId, userId),
              eq(scheduleTemplate.id, plan.trim.id),
            ),
          )
          .returning({ id: scheduleTemplate.id });

        // Drizzle reports success for an UPDATE that matched nothing; a version
        // deleted or already re-cut in another window must not come back as a
        // clean save.
        if (trimmed.length === 0) throw new VersionChanged();
      }

      if (plan.replace !== undefined) {
        // The version in force started today, so it has no past to freeze:
        // it is replaced outright, its slots going with it by cascade. This is
        // the second edit of the same day, and it leaves one version and no
        // hole (schema §4.7).
        const removed = await tx
          .delete(scheduleTemplate)
          .where(
            and(
              eq(scheduleTemplate.userId, userId),
              eq(scheduleTemplate.id, plan.replace.id),
            ),
          )
          .returning({ id: scheduleTemplate.id });

        if (removed.length === 0) throw new VersionChanged();
      }

      const [created] = await tx
        .insert(scheduleTemplate)
        .values({
          userId,
          view,
          validFrom: plan.create.validFrom,
          validTo: plan.create.validTo,
          boundaryKind: capped.boundaryKind,
        })
        .returning({ id: scheduleTemplate.id });

      if (slots.length > 0) {
        await tx.insert(templateSlot).values(
          slots.map((slot) => ({
            userId,
            templateId: created.id,
            weekday: slot.weekday,
            lessonNumber: slot.lessonNumber,
            parity: slot.parity,
            payload: slot.payload,
          })),
        );
      }
    });
  } catch (error) {
    if (error instanceof VersionChanged) {
      return rejected(VERSION_CHANGED, formData);
    }

    const message = constraintMessage(error, CONSTRAINT_MESSAGES, SAVE_REFUSED);
    if (message === undefined) throw error;
    return rejected(message, formData);
  }

  revalidatePath(SCHEDULE_PATH);
  return {};
}

/**
 * One weekday of one parity week — the unit of saving (ADR-006).
 *
 * `lessonNumbers` are the rows the screen actually showed, in order; they are
 * bound to the action by the form and are what both `readTemplateDay()` and
 * `templateDayFieldErrors()` read a row's lesson number from. They are not
 * teacher input in any meaningful sense — an invented number would simply fail
 * the schema's `0…9` and the `template_slot_number_ck` behind it.
 */
export async function saveTemplateDayAction(
  view: ScheduleView,
  parity: Parity,
  weekday: Weekday,
  lessonNumbers: readonly number[],
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = templateDayInputFor(view).safeParse(
    readTemplateDay(formData, lessonNumbers),
  );
  if (!parsed.success) {
    return {
      fieldErrors: templateDayFieldErrors(parsed.error, lessonNumbers),
      values: submittedValues(formData),
    };
  }

  // An entry with no payload is an empty cell, and an empty cell is the absence
  // of a slot rather than a slot to write (schema §4.8).
  const next: TemplateSlotInput[] = parsed.data.entries.flatMap((entry) =>
    entry.payload === undefined
      ? []
      : [
          {
            weekday,
            parity,
            lessonNumber: entry.lessonNumber,
            payload: entry.payload,
          },
        ],
  );

  return applyTemplateEdit(
    userId,
    view,
    (slots) => replaceDaySlots(slots, { weekday, parity }, next, lessonNumbers),
    formData,
  );
}

/**
 * «Скопіювати з чисельника в знаменник» and the other direction —
 * specification §5.1.
 *
 * It is an edit like any other, so it too creates a version: the copy applies
 * from today onwards and the weeks that have already been taught keep the
 * schedule they were taught under.
 */
export async function copyParityAction(
  view: ScheduleView,
  from: Parity,
  to: Parity,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  return applyTemplateEdit(
    userId,
    view,
    (slots) => copyParity(slots, from, to),
    formData,
  );
}

/**
 * «Доки діє цей розклад» — overview §8.1, resolved here and stored as a date.
 *
 * Moving the boundary goes through copy-on-write as well, with the slots
 * unchanged: an `UPDATE` of the version in force would be the one write in the
 * application able to move a `valid_to` backwards over days that have already
 * been taught, and I1 exists to make that unreachable (ADR-006).
 */
export async function setTemplateBoundaryAction(
  view: ScheduleView,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = templateBoundaryInput.safeParse({
    boundaryKind: formData.get(TEMPLATE_BOUNDARY_FIELD.boundaryKind),
    lastDay: formData.get(TEMPLATE_BOUNDARY_FIELD.lastDay) ?? "",
  });
  if (!parsed.success) return invalidInput(parsed.error, formData);

  return applyTemplateEdit(userId, view, (slots) => [...slots], formData, {
    kind: parsed.data.boundaryKind,
    lastDay: parsed.data.lastDay,
  });
}
