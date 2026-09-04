"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SLOT_FIELD_LABELS } from "@/components/forms/slot-labels";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldValue } from "@/components/forms/values";
import { Input } from "@/components/ui/input";
import { saveDayOverrideAction } from "@/lib/actions/dayOverride";
import type { DayOverrideKind, ScheduleView } from "@/lib/db/schema/enums";
import type { IsoDate } from "@/lib/time/today";
import {
  DAY_OVERRIDE_FIELD,
  type EditableOverrideKind,
} from "@/lib/validation/dayOverride";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation/formState";
import { SLOT_FIELDS, type SlotFieldName } from "@/lib/validation/slotFields";
import type { SlotPayload } from "@/lib/validation/slotPayload";
import { OVERRIDE_KIND_OPTIONS, OVERRIDE_LABELS } from "./labels";

/**
 * The lesson an override puts on one date — specification §5.3 and §5.4.
 *
 * One form, one slot: the `date`, the `view` and the `lessonNumber` are the URL
 * the teacher is on and are bound to the action by the screen, so nothing the
 * form submits can move the write to another day (overview §8.4 is about
 * `userId`; the same posture is why the slot is not a hidden input either).
 *
 * The fields are the view's own — three for «мої уроки», five for «уроки
 * класу» — because an override renders as a lesson and therefore carries a
 * lesson's payload (`lib/validation/slotFields.ts`, overview §3.4).
 *
 * `useActionState`, like every other form in the application (ADR-005): the
 * schema is parsed in the Server Action and its messages come back as the
 * action's state, so the form works with JavaScript off.
 */
export function OverrideForm({
  view,
  date,
  lessonNumber,
  kind,
  stored,
  planned,
}: {
  view: ScheduleView;
  date: IsoDate;
  lessonNumber: number;
  /** The kind of the override in force, when there is one. */
  kind?: DayOverrideKind;
  /** The payload of the override in force — what the form is editing. */
  stored?: SlotPayload;
  /**
   * What the weekly template gives on this slot. It prefills the form when
   * there is no override yet: a substitution is nearly always the planned
   * lesson with a different teacher, and a правка of one field should not make
   * the teacher retype the others.
   */
  planned?: SlotPayload;
}) {
  const [state, formAction] = useActionState(
    saveDayOverrideAction.bind(null, { date, view, lessonNumber }),
    EMPTY_FORM_STATE,
  );

  const fallback = stored ?? planned;
  // A tombstone has no payload of its own, and «правка» is what the teacher is
  // about to write; `CLEARED` is not one of the choices this form offers
  // (`lib/validation/dayOverride.ts`).
  const selectedKind: EditableOverrideKind =
    kind === "SUBSTITUTION" ? "SUBSTITUTION" : "EDIT";

  return (
    <form action={formAction} className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          {OVERRIDE_LABELS.kindLabel}
        </legend>
        {OVERRIDE_KIND_OPTIONS.map((option) => (
          <label className="flex items-start gap-2 text-sm" key={option.value}>
            <input
              className="accent-primary mt-1"
              defaultChecked={
                fieldValue(state, DAY_OVERRIDE_FIELD.kind, selectedKind) ===
                option.value
              }
              name={DAY_OVERRIDE_FIELD.kind}
              type="radio"
              value={option.value}
            />
            <span>
              <span className="font-medium">{option.label}</span>{" "}
              <span className="text-muted-foreground">
                {option.description}
              </span>
            </span>
          </label>
        ))}
        <FormMessage>{state.fieldErrors?.[DAY_OVERRIDE_FIELD.kind]}</FormMessage>
        {/* Overview §3.4: `replacedOriginal` is computed from the version in
            force on the date and is not stored, so a later template change
            changes it. The screen says so rather than letting the teacher
            assume the substitution froze what it replaced. */}
        <p className="text-muted-foreground text-xs">
          {OVERRIDE_LABELS.substitutionHint}
        </p>
      </fieldset>

      <div className="space-y-3">
        {SLOT_FIELDS[view].map((field) => (
          <PayloadInput
            error={state.fieldErrors?.[field]}
            field={field}
            key={field}
            state={state}
            stored={fallback}
          />
        ))}
      </div>

      <FormMessage>{state.error}</FormMessage>

      <SubmitButton pendingLabel={OVERRIDE_LABELS.saving}>
        {OVERRIDE_LABELS.save}
      </SubmitButton>
    </form>
  );
}

/** One field of the payload, labelled visibly — this form shows one lesson. */
function PayloadInput({
  field,
  stored,
  state,
  error,
}: {
  field: SlotFieldName;
  stored: SlotPayload | undefined;
  state: FormState;
  error?: string;
}) {
  return (
    <FormField error={error} label={SLOT_FIELD_LABELS[field]} name={field}>
      {(props) => (
        <Input
          {...props}
          defaultValue={fieldValue(state, field, storedValue(stored, field))}
          type={field === "zoomLink" ? "url" : "text"}
        />
      )}
    </FormField>
  );
}

/**
 * What the payload holds for one field, or the empty string.
 *
 * The payload is a union of the two views' shapes and the field list is the one
 * belonging to this view, so the lookup is sound but not provable from the
 * types alone — the value is checked to be a string rather than trusted, which
 * is the same posture `parseSlotPayload()` takes on the way in.
 */
function storedValue(
  payload: SlotPayload | undefined,
  field: SlotFieldName,
): string {
  if (payload === undefined) return "";
  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}
