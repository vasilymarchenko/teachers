"use client";

import { useActionState, useState } from "react";
import { DateField } from "@/components/forms/date-field";
import { DeleteButton } from "@/components/forms/delete-button";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldValue } from "@/components/forms/values";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createDeadlineAction,
  createInfoEventAction,
  deleteEventAction,
  updateDeadlineAction,
  updateInfoEventAction,
} from "@/lib/actions/events";
import type { EventEditRow } from "@/lib/db/queries/events";
import { addIsoDays } from "@/lib/domain/schedule/dates";
import { EVENT_FIELD } from "@/lib/validation/event";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation/formState";
import {
  ACTION_LABELS,
  BOUNDARY_KIND_OPTIONS,
  DEADLINES_SECTION,
  EVENT_FORM,
  INFO_SECTION,
  RECURRENCE_OPTIONS,
} from "./labels";
import { Row } from "@/components/year/section";

/**
 * The two event forms — specification §6.3.
 *
 * **The deadline form has no repetition controls at all**, and that is the
 * point rather than an omission: `done` is one field per event, so a repeating
 * deadline would close a whole series at once (overview §4). The database
 * refuses the shape (`event_deadline_shape_ck`) and the schema does not accept
 * it; here it simply does not exist to fill in.
 *
 * The information event's boundary is entered as a symbol and stored resolved
 * (overview §8.1) — the same two controls the weekly template's «доки діє»
 * has, and they appear only once a repetition is chosen, because they mean
 * nothing without one.
 */

export function DeadlineForm({ event }: { event?: EventEditRow }) {
  const [state, formAction] = useActionState(
    event === undefined
      ? createDeadlineAction
      : updateDeadlineAction.bind(null, event.id),
    EMPTY_FORM_STATE,
  );

  return (
    <Row>
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TitleField event={event} state={state} />
          <DateField
            error={state.fieldErrors?.[EVENT_FIELD.dateFrom]}
            label={EVENT_FORM.deadlineDate}
            name={EVENT_FIELD.dateFrom}
            state={state}
            stored={event?.dateFrom}
          />
          <NoteField event={event} state={state} />
        </div>

        <FormMessage>{state.error}</FormMessage>

        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingLabel={ACTION_LABELS.saving}>
            {event === undefined ? ACTION_LABELS.add : ACTION_LABELS.save}
          </SubmitButton>
          {event !== undefined ? (
            <DeleteButton
              action={deleteEventAction.bind(null, event.id)}
              confirm={DEADLINES_SECTION.removeConfirm}
              label={ACTION_LABELS.remove}
            />
          ) : null}
        </div>
      </form>
    </Row>
  );
}

export function InfoEventForm({ event }: { event?: EventEditRow }) {
  const [state, formAction] = useActionState(
    event === undefined
      ? createInfoEventAction
      : updateInfoEventAction.bind(null, event.id),
    EMPTY_FORM_STATE,
  );

  // The boundary fields are meaningless without a repetition, so they follow the
  // select rather than sitting there greyed out. That needs the chosen value in
  // React state, and the state has to follow every action result the way an
  // uncontrolled input does: `fieldValue()` shows the submission after a refusal
  // and the fallback after a success, and React clears the rest of the form
  // once the action resolves. Held state alone would keep «щотижня» standing in
  // a form whose every other field has just cleared, and the next event added
  // from it would repeat without anyone choosing that. So the state is re-seeded
  // whenever `useActionState` hands back a new result — the render-time reset
  // React documents, no effect involved.
  const chosen = fieldValue(
    state,
    EVENT_FIELD.recurrenceKind,
    event?.recurrenceKind ?? "NONE",
  );
  const [recurrenceKind, setRecurrenceKind] = useState(chosen);
  const [seenState, setSeenState] = useState(state);
  if (seenState !== state) {
    setSeenState(state);
    setRecurrenceKind(chosen);
  }
  const repeats = recurrenceKind !== "NONE";

  return (
    <Row>
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TitleField event={event} state={state} />
          <DateField
            error={state.fieldErrors?.[EVENT_FIELD.dateFrom]}
            label={EVENT_FORM.dateFrom}
            name={EVENT_FIELD.dateFrom}
            state={state}
            stored={event?.dateFrom}
          />
          <NoteField event={event} state={state} />

          <FormField
            error={state.fieldErrors?.[EVENT_FIELD.recurrenceKind]}
            label={EVENT_FORM.recurrenceKind}
            name={EVENT_FIELD.recurrenceKind}
          >
            {(props) => (
              <Select
                {...props}
                onChange={(changed) => setRecurrenceKind(changed.target.value)}
                required
                value={recurrenceKind}
              >
                {RECURRENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          {repeats ? (
            <>
              <FormField
                error={state.fieldErrors?.[EVENT_FIELD.boundaryKind]}
                hint={EVENT_FORM.boundaryHint}
                label={EVENT_FORM.boundaryKind}
                name={EVENT_FIELD.boundaryKind}
              >
                {(props) => (
                  <Select
                    {...props}
                    defaultValue={fieldValue(
                      state,
                      EVENT_FIELD.boundaryKind,
                      event?.boundaryKind ?? "END_OF_SEMESTER",
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
                error={state.fieldErrors?.[EVENT_FIELD.lastDay]}
                hint={EVENT_FORM.lastDayHint}
                label={EVENT_FORM.lastDay}
                name={EVENT_FIELD.lastDay}
                required={false}
                state={state}
                // `boundaryDate` is exclusive, so the last day the event still
                // occurs on is the day before it (§8.1).
                stored={
                  event?.boundaryKind === "DATE" && event.boundaryDate !== null
                    ? addIsoDays(event.boundaryDate, -1)
                    : undefined
                }
              />
            </>
          ) : (
            <DateField
              error={state.fieldErrors?.[EVENT_FIELD.dateTo]}
              hint={EVENT_FORM.dateToHint}
              label={EVENT_FORM.dateTo}
              name={EVENT_FIELD.dateTo}
              required={false}
              state={state}
              stored={event?.dateTo ?? undefined}
            />
          )}
        </div>

        <FormMessage>{state.error}</FormMessage>

        <div className="flex flex-wrap gap-2">
          <SubmitButton pendingLabel={ACTION_LABELS.saving}>
            {event === undefined ? ACTION_LABELS.add : ACTION_LABELS.save}
          </SubmitButton>
          {event !== undefined ? (
            <DeleteButton
              action={deleteEventAction.bind(null, event.id)}
              confirm={INFO_SECTION.removeConfirm}
              label={ACTION_LABELS.remove}
            />
          ) : null}
        </div>
      </form>
    </Row>
  );
}

function TitleField({
  event,
  state,
}: {
  event?: EventEditRow;
  state: FormState;
}) {
  return (
    <FormField
      error={state.fieldErrors?.[EVENT_FIELD.title]}
      label={EVENT_FORM.title}
      name={EVENT_FIELD.title}
    >
      {(props) => (
        <Input
          {...props}
          defaultValue={fieldValue(state, EVENT_FIELD.title, event?.title)}
          maxLength={120}
          required
          type="text"
        />
      )}
    </FormField>
  );
}

function NoteField({
  event,
  state,
}: {
  event?: EventEditRow;
  state: FormState;
}) {
  return (
    <FormField
      error={state.fieldErrors?.[EVENT_FIELD.note]}
      label={EVENT_FORM.note}
      name={EVENT_FIELD.note}
    >
      {(props) => (
        <Input
          {...props}
          defaultValue={fieldValue(state, EVENT_FIELD.note, event?.note ?? "")}
          maxLength={2000}
          type="text"
        />
      )}
    </FormField>
  );
}
