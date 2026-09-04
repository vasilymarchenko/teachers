"use client";

import { useActionState } from "react";
import { DateField } from "@/components/forms/date-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldValue } from "@/components/forms/values";
import { Select } from "@/components/ui/select";
import { setTemplateBoundaryAction } from "@/lib/actions/scheduleTemplate";
import type { BoundaryKind, ScheduleView } from "@/lib/db/schema/enums";
import { addIsoDays } from "@/lib/domain/schedule/dates";
import type { IsoDate } from "@/lib/time/today";
import { EMPTY_FORM_STATE } from "@/lib/validation/formState";
import { TEMPLATE_BOUNDARY_FIELD } from "@/lib/validation/templateBoundary";
import {
  ACTION_LABELS,
  BOUNDARY_KIND_OPTIONS,
  BOUNDARY_SECTION,
} from "./labels";

/**
 * «Доки діє цей розклад» — specification §5.1, overview §8.1.
 *
 * The teacher picks the symbol; the action resolves it and stores the date. The
 * row shows both, which is the only way a boundary whose break has since been
 * moved becomes visible — the same shape the weekday rules of T-009 have.
 *
 * Saving this creates a version like any other edit (ADR-006): the schedule in
 * force keeps the days it has already covered and the new end applies from
 * today onwards.
 */
export function BoundaryForm({
  view,
  boundaryKind,
  validTo,
}: {
  view: ScheduleView;
  /** How the version in force ends today; absent when there is no version. */
  boundaryKind?: BoundaryKind;
  /** Exclusive (schema §6) — the teacher is shown the day before it. */
  validTo?: IsoDate;
}) {
  const [state, formAction] = useActionState(
    setTemplateBoundaryAction.bind(null, view),
    EMPTY_FORM_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          error={state.fieldErrors?.[TEMPLATE_BOUNDARY_FIELD.boundaryKind]}
          label={BOUNDARY_SECTION.boundaryKind}
          name={TEMPLATE_BOUNDARY_FIELD.boundaryKind}
        >
          {(props) => (
            <Select
              {...props}
              defaultValue={fieldValue(
                state,
                TEMPLATE_BOUNDARY_FIELD.boundaryKind,
                boundaryKind ?? "END_OF_SEMESTER",
              )}
              required
            >
              {BOUNDARY_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <DateField
          error={state.fieldErrors?.[TEMPLATE_BOUNDARY_FIELD.lastDay]}
          hint={BOUNDARY_SECTION.lastDayHint}
          label={BOUNDARY_SECTION.lastDay}
          name={TEMPLATE_BOUNDARY_FIELD.lastDay}
          required={false}
          state={state}
          // `validTo` is exclusive, so the last day the schedule still applies
          // to is the day before it — and that is the only form of it the
          // teacher ever sees or types.
          stored={
            boundaryKind === "DATE" && validTo !== undefined
              ? addIsoDays(validTo, -1)
              : undefined
          }
        />
      </div>

      <FormMessage>{state.error}</FormMessage>

      <SubmitButton pendingLabel={ACTION_LABELS.saving}>
        {BOUNDARY_SECTION.save}
      </SubmitButton>
    </form>
  );
}
