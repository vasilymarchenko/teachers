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
  createParityAnchorAction,
  deleteParityAnchorAction,
} from "@/lib/actions/parityAnchors";
import type { ParityAnchorRow } from "@/lib/db/queries/yearSetup";
import type { IsoDate } from "@/lib/time/today";
import { EMPTY_FORM_STATE } from "@/lib/validation/formState";
import { PARITY_ANCHOR_FIELD } from "@/lib/validation/parityAnchor";
import {
  ACTION_LABELS,
  fullDate,
  PARITY_OPTION_LABELS,
  PARITY_OPTIONS,
  PARITY_SECTION,
} from "./labels";
import { Empty, Row, Section } from "./section";

/**
 * The parity of the week — specification §4.
 *
 * There is no «скидання» entity: the year's initial value and every reset after
 * it are the same `ParityAnchor` (overview §3.5). What separates them is the
 * date, so this section separates them the same way — the anchor on the year's
 * first day is shown as the year's initial value and edited in the year form
 * above, and everything after it is a reset that can be added and removed here.
 *
 * A reset has no edit form: it is a date and one of two values, and changing
 * either means a different reset. Removing it and adding the right one is the
 * same number of gestures as editing it, with nothing to get wrong.
 */
export function ParitySection({
  academicYearId,
  anchors,
  yearStart,
}: {
  academicYearId: string;
  anchors: ParityAnchorRow[];
  yearStart: IsoDate;
}) {
  const initial = anchors.find((anchor) => anchor.date === yearStart);
  const resets = anchors.filter((anchor) => anchor.date !== yearStart);

  return (
    <Section
      title={PARITY_SECTION.title}
      description={PARITY_SECTION.description}
    >
      <Row>
        {initial === undefined ? (
          // The year form writes this row with the year itself, so the only way
          // here is deleting it by hand or a half-finished older database.
          <p className="text-destructive text-sm">{PARITY_SECTION.initialMissing}</p>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {`${PARITY_SECTION.initial}: ${fullDate(initial.date)} — ${PARITY_OPTION_LABELS[initial.parity]}`}
            </p>
            <p className="text-muted-foreground text-sm">
              {PARITY_SECTION.initialHint}
            </p>
          </div>
        )}
      </Row>

      {resets.length === 0 ? (
        <Empty>{PARITY_SECTION.empty}</Empty>
      ) : (
        <div className="space-y-3">
          {resets.map((anchor) => (
            <ResetRow anchor={anchor} key={anchor.id} />
          ))}
        </div>
      )}

      <AddResetForm academicYearId={academicYearId} />
    </Section>
  );
}

function ResetRow({ anchor }: { anchor: ParityAnchorRow }) {
  return (
    <Row>
      <form
        action={deleteParityAnchorAction.bind(null, anchor.id)}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <p className="text-sm">
          {`${fullDate(anchor.date)} — ${PARITY_OPTION_LABELS[anchor.parity]}`}
        </p>
        <DeleteButton
          confirm={PARITY_SECTION.removeConfirm}
          label={ACTION_LABELS.remove}
        />
      </form>
    </Row>
  );
}

function AddResetForm({ academicYearId }: { academicYearId: string }) {
  const [state, formAction] = useActionState(
    createParityAnchorAction.bind(null, academicYearId),
    EMPTY_FORM_STATE,
  );

  return (
    <Row>
      <form action={formAction} className="space-y-4">
        <h3 className="text-sm font-semibold">{PARITY_SECTION.addTitle}</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <DateField
            error={state.fieldErrors?.[PARITY_ANCHOR_FIELD.date]}
            label={PARITY_SECTION.date}
            name={PARITY_ANCHOR_FIELD.date}
            state={state}
          />

          <FormField
            name={PARITY_ANCHOR_FIELD.parity}
            label={PARITY_SECTION.parity}
            error={state.fieldErrors?.[PARITY_ANCHOR_FIELD.parity]}
          >
            {(props) => (
              <Select
                {...props}
                required
                defaultValue={fieldValue(
                  state,
                  PARITY_ANCHOR_FIELD.parity,
                  PARITY_OPTIONS[0].value,
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

        <SubmitButton pendingLabel={ACTION_LABELS.saving}>
          {ACTION_LABELS.add}
        </SubmitButton>
      </form>
    </Row>
  );
}
