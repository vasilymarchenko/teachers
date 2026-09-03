import { z } from "zod";
import { NON_TEACHING_KIND_VALUES } from "./enums";
import {
  DATE_RANGE_RULE,
  isOrderedRange,
  isoDateField,
  nameField,
} from "./fields";

/**
 * The non-teaching-period form — specification §3.1, `non_teaching_period` in
 * schema §4.3.
 *
 * One schema for all three `kind`s, because that is one table: a public holiday
 * is a period whose `dateFrom` equals its `dateTo`, and nothing about the shape
 * of the input distinguishes it (overview §4). Periods are allowed to overlap
 * — a holiday inside a break is a normal data shape — so there is no overlap
 * rule here or in the database.
 */
export const nonTeachingPeriodInput = z
  .object({
    kind: z.enum(NON_TEACHING_KIND_VALUES, "Оберіть вид неробочого періоду"),
    name: nameField,
    dateFrom: isoDateField("Виберіть перший день"),
    dateTo: isoDateField("Виберіть останній день"),
  })
  .refine(isOrderedRange, DATE_RANGE_RULE);

/**
 * `Form` in the name because `lib/domain/schedule/types.ts` already owns
 * `NonTeachingPeriodInput` — the two dates `isNonTeachingOn()` reads. This one
 * is what the teacher types.
 */
export type NonTeachingPeriodFormInput = z.infer<typeof nonTeachingPeriodInput>;

export const NON_TEACHING_PERIOD_FIELD = {
  kind: "kind",
  name: "name",
  dateFrom: "dateFrom",
  dateTo: "dateTo",
} as const satisfies Record<keyof NonTeachingPeriodFormInput, string>;
