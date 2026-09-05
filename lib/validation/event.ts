import { z } from "zod";
import { BOUNDARY_KIND_VALUES, RECURRENCE_KIND_VALUES } from "./enums";
import {
  DATE_RANGE_RULE,
  isoDateField,
  nameField,
  optionalIsoDateField,
} from "./fields";

/**
 * The two event forms — specification §6.3, `event` in schema §4.10. Mechanics:
 * `docs/architecture/design/T-012-events.md`.
 *
 * **One schema per kind, not one schema with a `kind` field.** The two shapes
 * barely overlap: a `DEADLINE` is one date and a state of completion, an `INFO`
 * event is a date or a span of them and may repeat. A single schema would spend
 * every rule saying which half of itself applies — and it would have to offer a
 * repetition field to the kind that must never have one, which is exactly what
 * overview §4 refuses (`event_deadline_shape_ck` refuses it in the database).
 * Two schemas make «a deadline does not repeat» a fact about the form rather
 * than a rule inside it.
 *
 * `done` is in neither: it is not typed, it is toggled from the calendar, and a
 * new deadline starts undone.
 *
 * The boundary is entered **symbolically** and stored resolved (overview §8.1):
 * the teacher picks «до дати Х» / «до найближчих канікул» / «до кінця
 * семестру», and `lib/actions/events.ts` resolves it with `resolveBoundary()`.
 * Nothing is resolved here — resolving needs the year's rows, and this is the
 * browser's half of the boundary, the same split `templateBoundary.ts` has.
 */

const noteField = z
  .string()
  .trim()
  .max(2000, "Опис задовгий — до 2000 символів")
  .transform((value) => (value === "" ? undefined : value));

const optionalDate = optionalIsoDateField.transform((value) =>
  value === "" ? undefined : value,
);

/** «Завдання з терміном» — one date, no repetition (overview §4). */
export const deadlineInput = z.object({
  title: nameField,
  note: noteField,
  dateFrom: isoDateField("Виберіть дату, до якої треба виконати"),
});

export type DeadlineFormInput = z.infer<typeof deadlineInput>;

const RECURRING_SPAN =
  "Подія, що повторюється, триває один день. Приберіть дату завершення або вимкніть повторення";

const BOUNDARY_REQUIRED = "Виберіть, доки подія повторюється";

/**
 * «Інформаційна подія» — a date, or a span of dates, or a repetition.
 *
 * The two rules below are `event_recurring_span_ck` and `event_recurrence_ck`
 * said in Ukrainian, so the teacher meets them as a sentence about her form and
 * not as a refused save: a repeating event is one day per occurrence, and a
 * repetition without an end is not a shape the table holds.
 */
export const infoEventInput = z
  .object({
    title: nameField,
    note: noteField,
    dateFrom: isoDateField("Виберіть день, коли подія відбувається"),
    dateTo: optionalDate,
    recurrenceKind: z.enum(RECURRENCE_KIND_VALUES, "Виберіть, як подія повторюється"),
    boundaryKind: z
      .union([z.literal(""), z.enum(BOUNDARY_KIND_VALUES)])
      .transform((value) => (value === "" ? undefined : value)),
    lastDay: optionalDate,
  })
  .superRefine((entry, ctx) => {
    if (entry.dateTo !== undefined && entry.dateTo < entry.dateFrom) {
      ctx.addIssue({ code: "custom", ...DATE_RANGE_RULE });
    }
    if (entry.recurrenceKind === "NONE") return;

    if (entry.dateTo !== undefined) {
      ctx.addIssue({ code: "custom", path: ["dateTo"], message: RECURRING_SPAN });
    }
    if (entry.boundaryKind === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["boundaryKind"],
        message: BOUNDARY_REQUIRED,
      });
      return;
    }
    if (entry.boundaryKind === "DATE" && entry.lastDay === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["lastDay"],
        message: "Виберіть останній день, коли подія ще повторюється",
      });
    }
  });

export type InfoEventFormInput = z.infer<typeof infoEventInput>;

/**
 * The `name=` of every input of both forms, as the components spell them.
 *
 * `satisfies Record<keyof InfoEventFormInput, string>` is what earns it
 * (overview §8.2): the information event has every field either form has, so
 * binding the map to that schema means a key renamed there stops compiling here
 * instead of silently posting under a name the schema no longer reads.
 */
export const EVENT_FIELD = {
  title: "title",
  note: "note",
  dateFrom: "dateFrom",
  dateTo: "dateTo",
  recurrenceKind: "recurrenceKind",
  boundaryKind: "boundaryKind",
  lastDay: "lastDay",
} as const satisfies Record<keyof InfoEventFormInput, string>;

/** The deadline form as plain strings — every field, as always. */
export function readDeadline(formData: FormData): Record<string, string> {
  return {
    title: field(formData, EVENT_FIELD.title),
    note: field(formData, EVENT_FIELD.note),
    dateFrom: field(formData, EVENT_FIELD.dateFrom),
  };
}

/** The information-event form as plain strings. */
export function readInfoEvent(formData: FormData): Record<string, string> {
  return {
    title: field(formData, EVENT_FIELD.title),
    note: field(formData, EVENT_FIELD.note),
    dateFrom: field(formData, EVENT_FIELD.dateFrom),
    dateTo: field(formData, EVENT_FIELD.dateTo),
    recurrenceKind: field(formData, EVENT_FIELD.recurrenceKind),
    boundaryKind: field(formData, EVENT_FIELD.boundaryKind),
    lastDay: field(formData, EVENT_FIELD.lastDay),
  };
}

const field = (formData: FormData, name: string): string =>
  String(formData.get(name) ?? "");
