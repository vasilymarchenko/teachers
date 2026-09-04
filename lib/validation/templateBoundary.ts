import { z } from "zod";
import { BOUNDARY_KIND_VALUES } from "./enums";
import { optionalIsoDateField } from "./fields";

/**
 * «Доки діє цей розклад» — the `ScheduleTemplate.validTo` half of the editor,
 * specification §5.1 («за замовчуванням до кінця поточного семестру… або
 * конкретна дата, або найближчі канікули») and overview §8.1.
 *
 * The same shape as `weekdayRuleInput` minus the weekday, and for the same
 * reason: the teacher enters the **symbol**, the action resolves it against the
 * year's breaks and semesters and stores the resolved `boundaryDate` beside the
 * `boundaryKind` it came from. Nothing is resolved here — resolving needs rows,
 * and this is the browser's half of the boundary.
 *
 * `validFrom` is not a field either: the cut is always `today()` (overview §3.2,
 * I1), so there is nothing about it for the teacher to choose.
 */
export const templateBoundaryInput = z
  .object({
    boundaryKind: z.enum(BOUNDARY_KIND_VALUES, "Оберіть, доки діє розклад"),
    lastDay: optionalIsoDateField.transform((value) =>
      value === "" ? undefined : value,
    ),
  })
  .refine(
    (input) => input.boundaryKind !== "DATE" || input.lastDay !== undefined,
    {
      message: "Виберіть останній день, коли розклад ще діє",
      path: ["lastDay"],
    },
  );

export type TemplateBoundaryInput = z.infer<typeof templateBoundaryInput>;

export const TEMPLATE_BOUNDARY_FIELD = {
  boundaryKind: "boundaryKind",
  lastDay: "lastDay",
} as const satisfies Record<keyof TemplateBoundaryInput, string>;
