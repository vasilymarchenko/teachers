"use client";

import { useActionState } from "react";
import { DateField } from "@/components/forms/date-field";
import { DeleteButton } from "@/components/forms/delete-button";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldValue } from "@/components/forms/values";
import { Select } from "@/components/ui/select";
import {
  createSemesterAction,
  deleteSemesterAction,
  updateSemesterAction,
} from "@/lib/actions/semesters";
import type { SemesterRow } from "@/lib/db/queries/yearSetup";
import { SEMESTER_INDEXES } from "@/lib/validation/enums";
import { EMPTY_FORM_STATE } from "@/lib/validation/formState";
import { SEMESTER_FIELD } from "@/lib/validation/semester";
import { ACTION_LABELS, SEMESTERS_SECTION } from "./labels";
import { Empty, Row, Section } from "./section";

/**
 * The two semesters of the selected year — specification §3.2.
 *
 * A semester is a continuous range: the breaks inside it are entered in the
 * next section and do not split it (overview §4). Which is why this section
 * shows two rows and not four.
 */
export function SemestersSection({
  academicYearId,
  semesters,
}: {
  academicYearId: string;
  semesters: SemesterRow[];
}) {
  return (
    <Section
      title={SEMESTERS_SECTION.title}
      description={SEMESTERS_SECTION.description}
    >
      {semesters.length === 0 ? (
        <Empty>{SEMESTERS_SECTION.empty}</Empty>
      ) : (
        <div className="space-y-3">
          {semesters.map((semester) => (
            <SemesterForm
              academicYearId={academicYearId}
              key={semester.id}
              semester={semester}
            />
          ))}
        </div>
      )}

      {semesters.length < SEMESTER_INDEXES.length ? (
        <SemesterForm academicYearId={academicYearId} />
      ) : null}
    </Section>
  );
}

function SemesterForm({
  academicYearId,
  semester,
}: {
  academicYearId: string;
  /** Absent for the form that adds one. */
  semester?: SemesterRow;
}) {
  const [state, formAction] = useActionState(
    semester === undefined
      ? createSemesterAction.bind(null, academicYearId)
      : updateSemesterAction.bind(null, semester.id, academicYearId),
    EMPTY_FORM_STATE,
  );

  return (
    <Row>
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            name={SEMESTER_FIELD.index}
            label={SEMESTERS_SECTION.index}
            error={state.fieldErrors?.[SEMESTER_FIELD.index]}
          >
            {(props) => (
              <Select
                {...props}
                required
                defaultValue={fieldValue(
                  state,
                  SEMESTER_FIELD.index,
                  semester?.index ?? SEMESTER_INDEXES[0],
                )}
              >
                {SEMESTER_INDEXES.map((index) => (
                  <option key={index} value={index}>
                    {SEMESTERS_SECTION.option(index)}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <DateField
            error={state.fieldErrors?.[SEMESTER_FIELD.dateFrom]}
            label={SEMESTERS_SECTION.dateFrom}
            name={SEMESTER_FIELD.dateFrom}
            state={state}
            stored={semester?.dateFrom}
          />
          <DateField
            error={state.fieldErrors?.[SEMESTER_FIELD.dateTo]}
            label={SEMESTERS_SECTION.dateTo}
            name={SEMESTER_FIELD.dateTo}
            state={state}
            stored={semester?.dateTo}
          />
        </div>

        <FormMessage>{state.error}</FormMessage>

        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingLabel={ACTION_LABELS.saving}>
            {semester === undefined ? ACTION_LABELS.add : ACTION_LABELS.save}
          </SubmitButton>
          {semester !== undefined ? (
            <DeleteButton
              action={deleteSemesterAction.bind(null, semester.id)}
              confirm={SEMESTERS_SECTION.removeConfirm}
              label={ACTION_LABELS.remove}
            />
          ) : null}
        </div>
      </form>
    </Row>
  );
}
