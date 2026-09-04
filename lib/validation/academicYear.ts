import { z } from "zod";
import { PARITY_VALUES } from "./enums";
import { DATE_RANGE_RULE, isOrderedRange, isoDateField } from "./fields";

/**
 * The academic-year form — specification §3.1 and §4, `academic_year` in
 * schema §4.1.
 *
 * `initialParity` is on this form and is **not** a column: «рік починається з
 * чисельника» is stored as the `ParityAnchor` on the year's first day and
 * nowhere else (schema §4.1, finding F-1). The action writes the two rows
 * together, which is what keeps them from disagreeing.
 *
 * What this schema does not decide: whether the dates overlap another year.
 * That is `academic_year_no_overlap_ex` in the database — the only place that
 * can answer it without a race (schema §4.1).
 */
export const academicYearInput = z
  .object({
    dateFrom: isoDateField("Виберіть дату початку навчального року"),
    dateTo: isoDateField("Виберіть дату завершення навчального року"),
    initialParity: z.enum(PARITY_VALUES, "Оберіть, з чого починається рік"),
  })
  .refine(isOrderedRange, DATE_RANGE_RULE);

export type AcademicYearInput = z.infer<typeof academicYearInput>;

/**
 * The field names, shared with the form that submits them (overview §8.2).
 *
 * `satisfies Record<keyof AcademicYearInput, string>` is the part that earns
 * its keep: renaming a key in the schema without renaming it in the form stops
 * type-checking instead of quietly producing a field the action never reads.
 * Every form schema in this directory carries the same pair.
 */
export const ACADEMIC_YEAR_FIELD = {
  dateFrom: "dateFrom",
  dateTo: "dateTo",
  initialParity: "initialParity",
} as const satisfies Record<keyof AcademicYearInput, string>;
