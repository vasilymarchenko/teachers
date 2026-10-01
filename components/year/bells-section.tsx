"use client";

import { useActionState, useState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldValue } from "@/components/forms/values";
import { Input } from "@/components/ui/input";
import { saveBellScheduleAction } from "@/lib/actions/bellSchedule";
import { lessonEnd, storedLessonMinutes } from "@/lib/domain/schedule/bells";
import type { BellInput } from "@/lib/domain/schedule/types";
import {
  BELL_SCHEDULE_FIELD,
  bellField,
  parseLessonMinutes,
} from "@/lib/validation/bellSchedule";
import { LESSON_NUMBERS } from "@/lib/validation/enums";
import { clockTimeInput } from "@/lib/validation/fields";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation/formState";
import { ACTION_LABELS, BELLS_SECTION } from "./labels";
import { Row, Section } from "./section";

/**
 * The bell schedule — specification §3.3.
 *
 * One form for all ten lesson numbers rather than ten rows to create and delete
 * one at a time: a teacher reads a bell schedule as a column of times, and the
 * numbers that are not in use are simply blank. Clearing a start is how a
 * lesson number is deleted, which is why every number is always on screen.
 *
 * The teacher types when each lesson starts and one lesson length; the end is
 * `lessonEnd()` of the two, shown under the start as she types and computed
 * again by the action on save. There is no input for it (overview §9).
 *
 * This section is not inside the selected year: `bell_schedule` is keyed by
 * `(user_id, lesson_number)` and by nothing else (schema §4.5), so it says so.
 */
export function BellsSection({ bells }: { bells: BellInput[] }) {
  const [state, formAction] = useActionState(
    saveBellScheduleAction,
    EMPTY_FORM_STATE,
  );

  // What is stored, as one string: the grid below starts over when it changes —
  // a save that went through — and keeps what was typed when the page is
  // re-rendered for any other reason, such as another section's save.
  const storedKey = bells
    .map((bell) => `${bell.lessonNumber}=${bell.timeFrom}-${bell.timeTo}`)
    .join(",");

  return (
    <Section title={BELLS_SECTION.title} description={BELLS_SECTION.description}>
      <Row>
        <BellsForm
          key={storedKey}
          bells={bells}
          formAction={formAction}
          state={state}
        />
      </Row>
    </Section>
  );
}

function BellsForm({
  bells,
  state,
  formAction,
}: {
  bells: BellInput[];
  state: FormState;
  formAction: (formData: FormData) => void;
}) {
  const stored = storedLessonMinutes(bells);

  // Controlled, unlike the other forms of this screen: the ends are computed
  // from what is in the inputs right now. The first value is still what was
  // submitted, or what is stored — the same rule `fieldValue()` gives every
  // other form, and what a page rendered with JavaScript off shows.
  const [lessonMinutes, setLessonMinutes] = useState(() =>
    fieldValue(state, BELL_SCHEDULE_FIELD.lessonMinutes, stored.lessonMinutes),
  );
  const [starts, setStarts] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      LESSON_NUMBERS.map((lessonNumber) => [
        lessonNumber,
        fieldValue(
          state,
          bellField(lessonNumber),
          bells.find((bell) => bell.lessonNumber === lessonNumber)?.timeFrom,
        ),
      ]),
    ),
  );

  const minutes = parseLessonMinutes(lessonMinutes);

  const setStart = (lessonNumber: number, value: string) =>
    setStarts((current) => ({ ...current, [lessonNumber]: value }));

  return (
    <form
      action={formAction}
      className="space-y-4"
      // Enter submits without a blur, so the starts are spelled here as well;
      // the action spells them for itself and does not depend on this.
      onSubmit={() =>
        setStarts((current) =>
          Object.fromEntries(
            Object.entries(current).map(([lessonNumber, value]) => [
              lessonNumber,
              clockTimeInput(value),
            ]),
          ),
        )
      }
    >
      <FormField
        className="sm:max-w-xs"
        error={state.fieldErrors?.[BELL_SCHEDULE_FIELD.lessonMinutes]}
        hint={BELLS_SECTION.lessonMinutesHint}
        label={BELLS_SECTION.lessonMinutes}
        name={BELL_SCHEDULE_FIELD.lessonMinutes}
      >
        {(props) => (
          <Input
            {...props}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={lessonMinutes}
            onChange={(event) => setLessonMinutes(event.target.value)}
          />
        )}
      </FormField>

      {stored.mixed ? (
        <p className="text-muted-foreground text-sm">
          {BELLS_SECTION.mixedLengths}
        </p>
      ) : null}

      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {LESSON_NUMBERS.map((lessonNumber) => {
          const name = bellField(lessonNumber);
          const typed = starts[lessonNumber] ?? "";
          const end =
            minutes === undefined
              ? undefined
              : lessonEnd(clockTimeInput(typed), minutes);

          return (
            <FormField
              error={state.fieldErrors?.[name]}
              hint={end === undefined ? undefined : BELLS_SECTION.end(end)}
              key={lessonNumber}
              label={BELLS_SECTION.timeFrom(lessonNumber)}
              name={name}
            >
              {(props) => (
                // A text input, not `type="time"`: a native time input follows
                // the browser's locale and may show AM/PM, and every time here
                // is 24-hour `HH:MM`. No `required`: an empty start is a lesson
                // number the teacher does not use.
                <Input
                  {...props}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={BELLS_SECTION.timePlaceholder}
                  value={typed}
                  onChange={(event) => setStart(lessonNumber, event.target.value)}
                  // `8:30` and `830` become `08:30` in the field, as they will
                  // in the row; what is not a time is left for the teacher to
                  // see and for the action to name.
                  onBlur={() => setStart(lessonNumber, clockTimeInput(typed))}
                />
              )}
            </FormField>
          );
        })}
      </div>

      <p className="text-muted-foreground text-sm">{BELLS_SECTION.shared}</p>

      <FormMessage>{state.error}</FormMessage>

      <SubmitButton pendingLabel={ACTION_LABELS.saving}>
        {ACTION_LABELS.save}
      </SubmitButton>
    </form>
  );
}
