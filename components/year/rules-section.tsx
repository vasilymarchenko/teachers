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
  createWeekdayRuleAction,
  deleteWeekdayRuleAction,
  updateWeekdayRuleAction,
} from "@/lib/actions/weekdayRules";
import type { WeekdayRuleRow } from "@/lib/db/queries/yearSetup";
import { addIsoDays } from "@/lib/domain/schedule/dates";
import { EMPTY_FORM_STATE } from "@/lib/validation/formState";
import { WEEKDAY_RULE_FIELD } from "@/lib/validation/weekdayRule";
import {
  ACTION_LABELS,
  BOUNDARY_KIND_OPTIONS,
  fullDate,
  RULES_SECTION,
  WEEKDAY_OPTIONS,
} from "./labels";
import { Empty, Row, Section } from "./section";

/**
 * Weekdays excluded from the schedule — specification §3.4, «методичний день».
 *
 * The stored boundary is a resolved date; what the teacher entered is the
 * *symbol* beside it (overview §8.1). So a row shows both: «До найближчих
 * канікул» as the choice, and the last day it covers as the consequence — which
 * is how a rule whose break has since been moved becomes visible at all.
 *
 * There is no implicit weekend: Saturday and Sunday are non-teaching only
 * because rules say so (schema §4.4), which is what the empty state says out
 * loud rather than leaving the teacher to discover it in the calendar.
 */
export function RulesSection({
  academicYearId,
  rules,
}: {
  academicYearId: string;
  rules: WeekdayRuleRow[];
}) {
  return (
    <Section title={RULES_SECTION.title} description={RULES_SECTION.description}>
      {rules.length === 0 ? (
        <Empty>{RULES_SECTION.empty}</Empty>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleForm academicYearId={academicYearId} key={rule.id} rule={rule} />
          ))}
        </div>
      )}

      <RuleForm academicYearId={academicYearId} />
    </Section>
  );
}

function RuleForm({
  academicYearId,
  rule,
}: {
  academicYearId: string;
  /** Absent for the form that adds one. */
  rule?: WeekdayRuleRow;
}) {
  const [state, formAction] = useActionState(
    rule === undefined
      ? createWeekdayRuleAction.bind(null, academicYearId)
      : updateWeekdayRuleAction.bind(null, rule.id, academicYearId),
    EMPTY_FORM_STATE,
  );

  return (
    <Row>
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            name={WEEKDAY_RULE_FIELD.weekday}
            label={RULES_SECTION.weekday}
            error={state.fieldErrors?.[WEEKDAY_RULE_FIELD.weekday]}
          >
            {(props) => (
              <Select
                {...props}
                required
                defaultValue={fieldValue(
                  state,
                  WEEKDAY_RULE_FIELD.weekday,
                  rule?.weekday ?? WEEKDAY_OPTIONS[0].value,
                )}
              >
                {WEEKDAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField
            name={WEEKDAY_RULE_FIELD.boundaryKind}
            label={RULES_SECTION.boundaryKind}
            error={state.fieldErrors?.[WEEKDAY_RULE_FIELD.boundaryKind]}
          >
            {(props) => (
              <Select
                {...props}
                required
                defaultValue={fieldValue(
                  state,
                  WEEKDAY_RULE_FIELD.boundaryKind,
                  rule?.boundaryKind ?? BOUNDARY_KIND_OPTIONS[0].value,
                )}
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
            error={state.fieldErrors?.[WEEKDAY_RULE_FIELD.lastDay]}
            hint={RULES_SECTION.lastDayHint}
            label={RULES_SECTION.lastDay}
            name={WEEKDAY_RULE_FIELD.lastDay}
            required={false}
            state={state}
            // `boundaryDate` is exclusive (schema §6), so the last day the
            // rule still covers is the day before it — and that is the only
            // form of it the teacher ever sees or types.
            stored={
              rule?.boundaryKind === "DATE"
                ? addIsoDays(rule.boundaryDate, -1)
                : undefined
            }
          />
        </div>

        {rule !== undefined ? (
          <p className="text-muted-foreground text-sm">
            {`${RULES_SECTION.validFrom}: ${fullDate(rule.validFrom)} · ${RULES_SECTION.until}: ${fullDate(addIsoDays(rule.boundaryDate, -1))}`}
          </p>
        ) : null}

        <FormMessage>{state.error}</FormMessage>

        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingLabel={ACTION_LABELS.saving}>
            {rule === undefined ? ACTION_LABELS.add : ACTION_LABELS.save}
          </SubmitButton>
          {rule !== undefined ? (
            <DeleteButton
              action={deleteWeekdayRuleAction.bind(null, rule.id)}
              confirm={RULES_SECTION.removeConfirm}
              label={ACTION_LABELS.remove}
            />
          ) : null}
        </div>
      </form>
    </Row>
  );
}
