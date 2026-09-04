import { z } from "zod";
import { SEMESTER_INDEXES } from "./enums";
import { DATE_RANGE_RULE, isOrderedRange, isoDateField } from "./fields";

/**
 * The semester form — specification §3.2, `semester` in schema §4.2.
 *
 * A semester is a **continuous** range: a break inside it is a
 * `NonTeachingPeriod` and is not subtracted here (overview §4). Whether the
 * range lies inside its year is checked by the action, which has the year row;
 * whether it overlaps the other semester is `semester_no_overlap_ex`.
 */
export const semesterInput = z
  .object({
    index: z.coerce
      .number("Оберіть номер семестру")
      .int("Оберіть номер семестру")
      .refine(
        (value) => (SEMESTER_INDEXES as readonly number[]).includes(value),
        "Семестр може бути тільки перший або другий",
      ),
    dateFrom: isoDateField("Виберіть дату початку семестру"),
    dateTo: isoDateField("Виберіть дату завершення семестру"),
  })
  .refine(isOrderedRange, DATE_RANGE_RULE);

export type SemesterInput = z.infer<typeof semesterInput>;

export const SEMESTER_FIELD = {
  index: "index",
  dateFrom: "dateFrom",
  dateTo: "dateTo",
} as const satisfies Record<keyof SemesterInput, string>;
