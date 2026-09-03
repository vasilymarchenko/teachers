import { z } from "zod";
import { BOUNDARY_KIND_VALUES, WEEKDAY_VALUES } from "./enums";
import { optionalIsoDateField } from "./fields";

/**
 * The weekday-rule form — specification §3.4, `non_teaching_weekday_rule` in
 * schema §4.4.
 *
 * The teacher enters the **symbolic** boundary of overview §8.1 — «до дати Х»,
 * «до найближчих канікул», «до кінця семестру» — and `lastDay` only when the
 * kind is `DATE`. What gets stored is the resolved pair `boundaryDate` +
 * `boundaryKind`, computed by `resolveBoundary()` in the action; this schema
 * never resolves anything, because resolving needs the year's breaks and
 * semesters and this is the browser's half of the boundary.
 *
 * `validFrom` is deliberately **not** a field: it is not the teacher's to
 * choose (schema §4.4, ADR-004).
 */
export const weekdayRuleInput = z
  .object({
    weekday: z.enum(WEEKDAY_VALUES, "Оберіть день тижня"),
    boundaryKind: z.enum(BOUNDARY_KIND_VALUES, "Оберіть, доки діє правило"),
    lastDay: optionalIsoDateField.transform((value) =>
      value === "" ? undefined : value,
    ),
  })
  .refine(
    (input) => input.boundaryKind !== "DATE" || input.lastDay !== undefined,
    {
      message: "Виберіть останній день, коли правило ще діє",
      path: ["lastDay"],
    },
  );

export type WeekdayRuleInput = z.infer<typeof weekdayRuleInput>;

export const WEEKDAY_RULE_FIELD = {
  weekday: "weekday",
  boundaryKind: "boundaryKind",
  lastDay: "lastDay",
} as const satisfies Record<keyof WeekdayRuleInput, string>;
