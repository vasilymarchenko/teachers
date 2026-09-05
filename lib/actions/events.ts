"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { constraintMessage } from "@/lib/db/constraintViolation";
import { getYearFrame } from "@/lib/db/queries/yearFrame";
import { listNonTeachingPeriods } from "@/lib/db/queries/yearSetup";
import { event } from "@/lib/db/schema";
import type { BoundaryKind, RecurrenceKind } from "@/lib/db/schema/enums";
import { resolveBoundary } from "@/lib/domain/schedule/boundaries";
import type { IsoDate } from "@/lib/time/today";
import {
  deadlineInput,
  EVENT_FIELD,
  infoEventInput,
  readDeadline,
  readInfoEvent,
} from "@/lib/validation/event";
import {
  invalidInput,
  rejected,
  rejectedField,
  type FormState,
} from "@/lib/validation/formState";
import { CALENDAR_PATH } from "./calendar";
import {
  EVENT_NOT_FOUND,
  EVENTS_PATH,
  NO_YEAR_FOR_THE_DATE,
  SAVE_REFUSED,
  UNRESOLVABLE_BOUNDARY,
} from "./eventsShared";

/**
 * Events — specification §6.3, `event` in schema §4.10. Mechanics:
 * `docs/architecture/design/T-012-events.md`.
 *
 * Two kinds, two pairs of actions, because the shapes do not overlap (overview
 * §4): a `DEADLINE` is one date with a state of completion and never repeats, an
 * `INFO` event is a date or a span and may. `done` is written by
 * `setEventDoneAction` alone and never by a form, so a deadline's state cannot
 * be reset by saving an edit to its title.
 *
 * This is the second place overview §8.1 happens: the recurrence boundary is
 * entered as a symbol and stored as the pair `boundaryDate` + `boundaryKind`,
 * resolved **here**, once, by the same `resolveBoundary()` the weekday rules
 * use. `recurrence.ts` never resolves anything — which is what keeps a break
 * moved in January from silently rewriting the events of October.
 *
 * `userId` comes from `requireUser()` and from nowhere else (overview §8.4);
 * every statement below filters by it.
 */

const CONSTRAINT_MESSAGES = {
  event_range_ck: "Подія не може завершуватися раніше, ніж починається",
  event_boundary_ck: "Повторення має закінчуватися пізніше за дату події",
  // The three shape checks can only fire on a row this module built wrong; they
  // are named so that such a bug arrives as itself rather than as «дані
  // суперечать іншим записам».
  event_done_ck: "Позначку «виконано» має лише завдання з терміном",
  event_deadline_shape_ck: "Завдання з терміном не повторюється",
  event_recurring_span_ck: "Подія, що повторюється, триває один день",
};

/** Both screens show events, so both are stale after every write. */
function revalidateEvents(): void {
  revalidatePath(EVENTS_PATH);
  revalidatePath(CALENDAR_PATH, "layout");
}

export async function createDeadlineAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = deadlineInput.safeParse(readDeadline(formData));
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const { title, note, dateFrom } = parsed.data;

  try {
    await getDb().insert(event).values({
      userId,
      kind: "DEADLINE",
      title,
      note,
      dateFrom,
      // A new deadline starts undone; nothing else may write this column.
      done: false,
    });
  } catch (error) {
    return refusal(error, formData);
  }

  revalidateEvents();
  return {};
}

export async function updateDeadlineAction(
  eventId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = deadlineInput.safeParse(readDeadline(formData));
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const { title, note, dateFrom } = parsed.data;

  try {
    const updated = await getDb()
      .update(event)
      // `note: note ?? null` and not `note`: Drizzle drops an `undefined` from
      // the SET clause, so a teacher who cleared the description would be told
      // the save succeeded and find the old text still there.
      .set({ title, note: note ?? null, dateFrom, updatedAt: new Date() })
      // `kind` is part of the filter, not of the update: a deadline stays a
      // deadline, and an id that names an INFO event matches nothing rather
      // than turning one kind into the other.
      .where(
        and(
          eq(event.userId, userId),
          eq(event.id, eventId),
          eq(event.kind, "DEADLINE"),
        ),
      )
      // A row deleted in another tab must not come back as a clean save: the
      // UPDATE matches nothing and Drizzle reports success either way.
      .returning({ id: event.id });

    if (updated.length === 0) return rejected(EVENT_NOT_FOUND, formData);
  } catch (error) {
    return refusal(error, formData);
  }

  revalidateEvents();
  return {};
}

export async function createInfoEventAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = infoEventInput.safeParse(readInfoEvent(formData));
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const { title, note, dateFrom, dateTo, recurrenceKind } = parsed.data;
  const boundary = await resolveFor(userId, parsed.data);
  if ("error" in boundary) return boundary.error(formData);

  try {
    await getDb().insert(event).values({
      userId,
      kind: "INFO",
      title,
      note,
      dateFrom,
      dateTo,
      recurrenceKind,
      ...boundary.stored,
    });
  } catch (error) {
    return refusal(error, formData);
  }

  revalidateEvents();
  return {};
}

export async function updateInfoEventAction(
  eventId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const parsed = infoEventInput.safeParse(readInfoEvent(formData));
  if (!parsed.success) return invalidInput(parsed.error, formData);

  const { title, note, dateFrom, dateTo, recurrenceKind } = parsed.data;
  const boundary = await resolveFor(userId, parsed.data);
  if ("error" in boundary) return boundary.error(formData);

  try {
    const updated = await getDb()
      .update(event)
      .set({
        title,
        // Every column is written, `null` included — Drizzle drops an
        // `undefined` from the SET clause, so a cleared description or a
        // dropped end date would silently keep its old value. The boundary has
        // to go the same way: an event that stops repeating must lose it, or
        // `event_recurrence_ck` refuses the half-changed row.
        note: note ?? null,
        dateFrom,
        dateTo: dateTo ?? null,
        recurrenceKind,
        ...boundary.stored,
        updatedAt: new Date(),
      })
      .where(
        and(eq(event.userId, userId), eq(event.id, eventId), eq(event.kind, "INFO")),
      )
      .returning({ id: event.id });

    if (updated.length === 0) return rejected(EVENT_NOT_FOUND, formData);
  } catch (error) {
    return refusal(error, formData);
  }

  revalidateEvents();
  return {};
}

/**
 * «Виконано» / «Ще не виконано» — the one state a `DEADLINE` carries
 * (specification §6.3), toggled from the calendar where the teacher meets it.
 *
 * `kind = 'DEADLINE'` is part of the filter because `event_done_ck` forbids
 * `done` on an `INFO` event: the constraint would refuse the row anyway, and an
 * id that names the wrong kind is answered as a missing row rather than as a
 * database error.
 */
export async function setEventDoneAction(
  eventId: string,
  done: boolean,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { id: userId } = await requireUser();

  const updated = await getDb()
    .update(event)
    .set({ done, updatedAt: new Date() })
    .where(
      and(
        eq(event.userId, userId),
        eq(event.id, eventId),
        eq(event.kind, "DEADLINE"),
      ),
    )
    .returning({ id: event.id });

  if (updated.length === 0) return rejected(EVENT_NOT_FOUND, formData);

  revalidateEvents();
  return {};
}

export async function deleteEventAction(eventId: string): Promise<void> {
  const { id: userId } = await requireUser();

  await getDb()
    .delete(event)
    .where(and(eq(event.userId, userId), eq(event.id, eventId)));

  revalidateEvents();
}

/** The two boundary columns, written together or not at all (schema §4.10). */
type StoredBoundary = {
  boundaryDate: IsoDate | null;
  boundaryKind: BoundaryKind | null;
};

/**
 * The boundary of an information event, resolved — overview §8.1.
 *
 * The reference date is the event's own `dateFrom`, not today: «щотижня до
 * найближчих канікул» on an event entered in August for September means the
 * break that follows the event, not the one that follows the typing.
 *
 * An event that does not repeat stores neither column, which is the same
 * `event_recurrence_ck` shape read from the other side.
 */
async function resolveFor(
  userId: string,
  input: {
    dateFrom: IsoDate;
    recurrenceKind: RecurrenceKind;
    boundaryKind?: BoundaryKind;
    lastDay?: IsoDate;
  },
): Promise<
  | { stored: StoredBoundary }
  | { error: (formData: FormData) => FormState }
> {
  if (input.recurrenceKind === "NONE") {
    return { stored: { boundaryDate: null, boundaryKind: null } };
  }

  // The schema has already refused a repetition with no symbol; this narrows
  // the type without a second message.
  const kind = input.boundaryKind;
  if (kind === undefined) {
    return { error: (formData) => rejected(SAVE_REFUSED, formData) };
  }

  if (kind === "DATE") {
    const boundaryDate = resolveBoundary({
      kind,
      referenceDate: input.dateFrom,
      lastDay: input.lastDay,
    });
    return boundaryDate === undefined
      ? {
          error: (formData) =>
            rejectedField(
              EVENT_FIELD.lastDay,
              UNRESOLVABLE_BOUNDARY.DATE,
              formData,
            ),
        }
      : { stored: { boundaryDate, boundaryKind: kind } };
  }

  // A symbolic boundary is resolved against the year the event falls in — its
  // breaks and its semesters. An event outside every year has neither.
  const frame = await getYearFrame(userId, input.dateFrom);
  if (frame === null) {
    return {
      error: (formData) =>
        rejectedField(
          EVENT_FIELD.boundaryKind,
          NO_YEAR_FOR_THE_DATE,
          formData,
        ),
    };
  }

  const periods = await listNonTeachingPeriods(userId, frame.id);
  const boundaryDate = resolveBoundary({
    kind,
    referenceDate: input.dateFrom,
    // «найближчі канікули» means a break, not a public holiday (schema §4.3).
    breaks: periods.filter((period) => period.kind === "BREAK"),
    semesters: frame.semesters,
  });

  return boundaryDate === undefined
    ? {
        error: (formData) =>
          rejectedField(
            EVENT_FIELD.boundaryKind,
            UNRESOLVABLE_BOUNDARY[kind],
            formData,
          ),
      }
    : { stored: { boundaryDate, boundaryKind: kind } };
}

/** A constraint the database refused, phrased; anything else is a bug. */
function refusal(error: unknown, formData: FormData): FormState {
  const message = constraintMessage(error, CONSTRAINT_MESSAGES, SAVE_REFUSED);
  if (message === undefined) throw error;
  return rejected(message, formData);
}
