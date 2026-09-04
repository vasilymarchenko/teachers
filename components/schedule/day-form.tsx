"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { SLOT_FIELD_LABELS } from "@/components/forms/slot-labels";
import { fieldValue } from "@/components/forms/values";
import { Input } from "@/components/ui/input";
import { saveTemplateDayAction } from "@/lib/actions/scheduleTemplate";
import type { Parity, ScheduleView, Weekday } from "@/lib/db/schema/enums";
import type { TemplateSlotInput } from "@/lib/domain/schedule/types";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation/formState";
import type { SlotPayload } from "@/lib/validation/slotPayload";
import {
  TEMPLATE_SLOT_FIELDS,
  templateSlotField,
  type TemplateSlotFieldName,
} from "@/lib/validation/templateDay";
import {
  ACTION_LABELS,
  DAY_LABELS,
  dayFormLabel,
  lessonRowLabel,
  WEEKDAY_LABELS,
} from "./labels";
import type { LessonRow } from "./lessonRows";

/**
 * One weekday of one parity week — the unit of saving (ADR-006).
 *
 * On a narrow screen this is the whole editor; from the tablet breakpoint up,
 * seven of them side by side are the weekly grid (overview §10.2). It is the
 * same component either way, which is the point of the decision: a grid that
 * had to be taken apart for a phone would have to be rewritten, not restyled.
 *
 * The rows are the same list for every day of the screen, so the seven cards
 * line up: `lessonRows()` computes them from the bells and from every slot of
 * the version.
 *
 * An empty row means «уроку немає»: clearing the inputs and saving deletes the
 * slot, which is what makes one submission create, update and delete.
 */
export function DayForm({
  view,
  parity,
  weekday,
  rows,
  slots,
}: {
  view: ScheduleView;
  parity: Parity;
  weekday: Weekday;
  rows: readonly LessonRow[];
  /** The version's slots for this weekday and parity, in any order. */
  slots: readonly TemplateSlotInput[];
}) {
  const lessonNumbers = rows.map((row) => row.lessonNumber);
  const [state, formAction] = useActionState(
    saveTemplateDayAction.bind(null, view, parity, weekday, lessonNumbers),
    EMPTY_FORM_STATE,
  );

  const stored = new Map(slots.map((slot) => [slot.lessonNumber, slot.payload]));
  const fields = TEMPLATE_SLOT_FIELDS[view];

  return (
    <form
      action={formAction}
      aria-label={dayFormLabel(WEEKDAY_LABELS[weekday], parity, view)}
      className="border-border bg-card flex h-full flex-col gap-4 rounded-lg border p-4"
    >
      <h3 className="text-sm font-semibold">{WEEKDAY_LABELS[weekday]}</h3>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{DAY_LABELS.empty}</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <div className="space-y-2" key={row.lessonNumber}>
              <p className="text-muted-foreground text-xs font-medium">
                {lessonRowLabel(row)}
              </p>
              {fields.map((field) => (
                <SlotInput
                  error={
                    state.fieldErrors?.[
                      templateSlotField(row.lessonNumber, field)
                    ]
                  }
                  field={field}
                  key={field}
                  lessonNumber={row.lessonNumber}
                  state={state}
                  stored={stored.get(row.lessonNumber)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <FormMessage>{state.error}</FormMessage>

      {rows.length > 0 ? (
        <div className="mt-auto pt-2">
          <SubmitButton pendingLabel={ACTION_LABELS.saving}>
            {ACTION_LABELS.save}
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

/**
 * One input of one cell.
 *
 * The label is visually hidden and names the lesson as well as the field: seven
 * columns of «Предмет» read as one word repeated, and the lesson number is the
 * only thing that tells them apart. The row's «3 · 10:15» above them is the
 * sighted reader's version of the same information.
 */
function SlotInput({
  lessonNumber,
  field,
  stored,
  state,
  error,
}: {
  lessonNumber: number;
  field: TemplateSlotFieldName;
  stored: SlotPayload | undefined;
  state: FormState;
  error?: string;
}) {
  const name = templateSlotField(lessonNumber, field);

  return (
    <FormField
      className="space-y-1"
      error={error}
      label={DAY_LABELS.field(lessonNumber, field)}
      labelHidden
      name={name}
    >
      {(props) => (
        <Input
          {...props}
          defaultValue={fieldValue(state, name, storedValue(stored, field))}
          placeholder={SLOT_FIELD_LABELS[field]}
          type={field === "zoomLink" ? "url" : "text"}
        />
      )}
    </FormField>
  );
}

/**
 * What the stored payload holds for one field, or the empty string.
 *
 * The payload is a union of the two views' shapes and the field list is the one
 * belonging to this view, so the lookup is sound but not provable from the
 * types alone — the value is checked to be a string rather than trusted, which
 * is the same posture `parseSlotPayload()` takes on the way in.
 */
function storedValue(
  payload: SlotPayload | undefined,
  field: TemplateSlotFieldName,
): string {
  if (payload === undefined) return "";
  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}
