"use client";

import { useActionState } from "react";
import { DateField } from "@/components/forms/date-field";
import { formErrorsOf } from "@/components/forms/field-errors";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TrackedForm } from "@/components/forms/tracked-form";
import { fieldValue } from "@/components/forms/values";
import { Select } from "@/components/ui/select";
import { RestatedBoundary } from "@/components/year/section";
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
  restatedUntil,
}: {
  view: ScheduleView;
  /** How the version in force ends today; absent when there is no version. */
  boundaryKind?: BoundaryKind;
  /** Exclusive (schema §6) — the teacher is shown the day before it. */
  validTo?: IsoDate;
  /**
   * Exclusive too: where saving this form again would end the version, when
   * the page found that the stored symbol now resolves elsewhere (T-047).
   */
  restatedUntil?: IsoDate;
}) {
  const [state, formAction] = useActionState(
    setTemplateBoundaryAction.bind(null, view),
    EMPTY_FORM_STATE,
  );
  const errors = formErrorsOf(state);

  return (
    <TrackedForm
      action={formAction}
      changedOnOpen={restatedUntil !== undefined}
      className="space-y-4"
      state={state}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          error={errors.for(TEMPLATE_BOUNDARY_FIELD.boundaryKind)}
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
          errors={errors}
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

      {restatedUntil !== undefined ? (
        <RestatedBoundary>
          {BOUNDARY_SECTION.restated(addIsoDays(restatedUntil, -1))}
        </RestatedBoundary>
      ) : null}

      <FormMessage errors={errors} />

      <SubmitButton pendingLabel={ACTION_LABELS.saving}>
        {BOUNDARY_SECTION.save}
      </SubmitButton>
    </TrackedForm>
  );
}
