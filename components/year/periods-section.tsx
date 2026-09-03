"use client";

import { useActionState } from "react";
import { DateField } from "@/components/forms/date-field";
import { DeleteButton } from "@/components/forms/delete-button";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldValue } from "@/components/forms/values";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createNonTeachingPeriodAction,
  deleteNonTeachingPeriodAction,
  updateNonTeachingPeriodAction,
} from "@/lib/actions/nonTeachingPeriods";
import type { NonTeachingPeriodEditRow } from "@/lib/db/queries/yearSetup";
import { EMPTY_FORM_STATE } from "@/lib/validation/formState";
import { NON_TEACHING_PERIOD_FIELD } from "@/lib/validation/nonTeachingPeriod";
import {
  ACTION_LABELS,
  NON_TEACHING_KIND_OPTIONS,
  PERIODS_SECTION,
} from "./labels";
import { Empty, Row, Section } from "./section";

/**
 * Breaks, public holidays and unplanned days off — specification §3.1.
 *
 * One list for all three kinds, because they are one table (overview §4): they
 * differ by a name and a length, and `expand()` asks one question of them.
 *
 * Editing an existing period carries the warning of overview §8.1: a boundary
 * that was resolved against these dates does not move when they do. That is a
 * property of the model and not something this screen can fix — it is why the
 * warning is on the *edit* form and not on the one that adds a period, which
 * cannot have anything pointing at it yet.
 */
export function PeriodsSection({
  academicYearId,
  periods,
}: {
  academicYearId: string;
  periods: NonTeachingPeriodEditRow[];
}) {
  return (
    <Section
      title={PERIODS_SECTION.title}
      description={PERIODS_SECTION.description}
    >
      {periods.length === 0 ? (
        <Empty>{PERIODS_SECTION.empty}</Empty>
      ) : (
        <div className="space-y-3">
          {periods.map((period) => (
            <PeriodForm
              academicYearId={academicYearId}
              key={period.id}
              period={period}
            />
          ))}
        </div>
      )}

      <PeriodForm academicYearId={academicYearId} />
    </Section>
  );
}

function PeriodForm({
  academicYearId,
  period,
}: {
  academicYearId: string;
  /** Absent for the form that adds one. */
  period?: NonTeachingPeriodEditRow;
}) {
  const [state, formAction] = useActionState(
    period === undefined
      ? createNonTeachingPeriodAction.bind(null, academicYearId)
      : updateNonTeachingPeriodAction.bind(null, period.id, academicYearId),
    EMPTY_FORM_STATE,
  );

  return (
    <Row>
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField
            name={NON_TEACHING_PERIOD_FIELD.kind}
            label={PERIODS_SECTION.kind}
            error={state.fieldErrors?.[NON_TEACHING_PERIOD_FIELD.kind]}
          >
            {(props) => (
              <Select
                {...props}
                required
                defaultValue={fieldValue(
                  state,
                  NON_TEACHING_PERIOD_FIELD.kind,
                  period?.kind ?? NON_TEACHING_KIND_OPTIONS[0].value,
                )}
              >
                {NON_TEACHING_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField
            name={NON_TEACHING_PERIOD_FIELD.name}
            label={PERIODS_SECTION.name}
            error={state.fieldErrors?.[NON_TEACHING_PERIOD_FIELD.name]}
          >
            {(props) => (
              <Input
                {...props}
                type="text"
                required
                maxLength={120}
                defaultValue={fieldValue(
                  state,
                  NON_TEACHING_PERIOD_FIELD.name,
                  period?.name,
                )}
              />
            )}
          </FormField>

          <DateField
            error={state.fieldErrors?.[NON_TEACHING_PERIOD_FIELD.dateFrom]}
            label={PERIODS_SECTION.dateFrom}
            name={NON_TEACHING_PERIOD_FIELD.dateFrom}
            state={state}
            stored={period?.dateFrom}
          />
          <DateField
            error={state.fieldErrors?.[NON_TEACHING_PERIOD_FIELD.dateTo]}
            label={PERIODS_SECTION.dateTo}
            name={NON_TEACHING_PERIOD_FIELD.dateTo}
            state={state}
            stored={period?.dateTo}
          />
        </div>

        {period !== undefined ? (
          <p className="text-muted-foreground border-border border-l-2 pl-3 text-sm">
            {PERIODS_SECTION.datesWarning}
          </p>
        ) : null}

        <FormMessage>{state.error}</FormMessage>

        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingLabel={ACTION_LABELS.saving}>
            {period === undefined ? ACTION_LABELS.add : ACTION_LABELS.save}
          </SubmitButton>
          {period !== undefined ? (
            <DeleteButton
              action={deleteNonTeachingPeriodAction.bind(null, period.id)}
              confirm={PERIODS_SECTION.removeConfirm}
              label={ACTION_LABELS.remove}
            />
          ) : null}
        </div>
      </form>
    </Row>
  );
}
