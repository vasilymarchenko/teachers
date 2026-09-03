"use client";

import { useActionState } from "react";
import { DeleteButton } from "@/components/forms/delete-button";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldValue } from "@/components/forms/values";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createAcademicYearAction,
  deleteAcademicYearAction,
  updateAcademicYearAction,
} from "@/lib/actions/academicYear";
import type { AcademicYearRow } from "@/lib/db/queries/yearSetup";
import type { Parity } from "@/lib/db/schema/enums";
import { ACADEMIC_YEAR_FIELD } from "@/lib/validation/academicYear";
import { EMPTY_FORM_STATE } from "@/lib/validation/formState";
import { ACTION_LABELS, PARITY_OPTIONS, YEAR_SECTION } from "./labels";
import { Row } from "./section";

/**
 * The year's dates and its initial parity — specification §3.1 and §4.
 *
 * One component for both jobs: creating a year and editing the selected one.
 * They submit the same three fields to the same schema, and the only
 * differences are which action they call and whether there is anything to
 * delete — writing them twice would be two places to keep a field in step.
 *
 * `initialParity` is not a column: it is the `ParityAnchor` on the year's first
 * day (schema §4.1, finding F-1), read back by the page and written by the
 * action in the same transaction as the year.
 */
export function YearForm({
  year,
  initialParity,
}: {
  /** Absent for the form that creates a year. */
  year?: AcademicYearRow;
  /** The parity of the anchor on `year.dateFrom`, when there is one. */
  initialParity?: Parity;
}) {
  const [state, formAction] = useActionState(
    year === undefined
      ? createAcademicYearAction
      : updateAcademicYearAction.bind(null, year.id),
    EMPTY_FORM_STATE,
  );

  return (
    <Row>
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            name={ACADEMIC_YEAR_FIELD.dateFrom}
            label={YEAR_SECTION.dateFrom}
            error={state.fieldErrors?.[ACADEMIC_YEAR_FIELD.dateFrom]}
          >
            {(props) => (
              <Input
                {...props}
                type="date"
                required
                defaultValue={fieldValue(
                  state,
                  ACADEMIC_YEAR_FIELD.dateFrom,
                  year?.dateFrom,
                )}
              />
            )}
          </FormField>

          <FormField
            name={ACADEMIC_YEAR_FIELD.dateTo}
            label={YEAR_SECTION.dateTo}
            error={state.fieldErrors?.[ACADEMIC_YEAR_FIELD.dateTo]}
          >
            {(props) => (
              <Input
                {...props}
                type="date"
                required
                defaultValue={fieldValue(
                  state,
                  ACADEMIC_YEAR_FIELD.dateTo,
                  year?.dateTo,
                )}
              />
            )}
          </FormField>

          <FormField
            name={ACADEMIC_YEAR_FIELD.initialParity}
            label={YEAR_SECTION.initialParity}
            error={state.fieldErrors?.[ACADEMIC_YEAR_FIELD.initialParity]}
          >
            {(props) => (
              <Select
                {...props}
                required
                defaultValue={fieldValue(
                  state,
                  ACADEMIC_YEAR_FIELD.initialParity,
                  initialParity ?? PARITY_OPTIONS[0].value,
                )}
              >
                {PARITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>

        <FormMessage>{state.error}</FormMessage>

        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingLabel={ACTION_LABELS.saving}>
            {year === undefined ? ACTION_LABELS.add : ACTION_LABELS.save}
          </SubmitButton>
          {year !== undefined ? (
            <DeleteButton
              action={deleteAcademicYearAction.bind(null, year.id)}
              confirm={YEAR_SECTION.removeConfirm}
              label={ACTION_LABELS.remove}
            />
          ) : null}
        </div>
      </form>
    </Row>
  );
}
