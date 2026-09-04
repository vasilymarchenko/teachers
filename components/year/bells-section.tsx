"use client";

import { useActionState } from "react";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { fieldValue } from "@/components/forms/values";
import { Input } from "@/components/ui/input";
import { saveBellScheduleAction } from "@/lib/actions/bellSchedule";
import type { BellInput } from "@/lib/domain/schedule/types";
import { bellField } from "@/lib/validation/bellSchedule";
import { LESSON_NUMBERS } from "@/lib/validation/enums";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/validation/formState";
import { ACTION_LABELS, BELLS_SECTION } from "./labels";
import { Row, Section } from "./section";

/**
 * The bell schedule — specification §3.3.
 *
 * One form for all ten lesson numbers rather than ten rows to create and delete
 * one at a time: a teacher reads a bell schedule as a column of times, and the
 * numbers that are not in use are simply blank. Clearing a row is how a lesson
 * number is deleted, which is why every number is always on screen.
 *
 * This section is not inside the selected year: `bell_schedule` is keyed by
 * `(user_id, lesson_number)` and by nothing else (schema §4.5), so it says so.
 */
export function BellsSection({ bells }: { bells: BellInput[] }) {
  const [state, formAction] = useActionState(
    saveBellScheduleAction,
    EMPTY_FORM_STATE,
  );

  const stored = new Map(bells.map((bell) => [bell.lessonNumber, bell]));

  return (
    <Section title={BELLS_SECTION.title} description={BELLS_SECTION.description}>
      <Row>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {LESSON_NUMBERS.map((lessonNumber) => {
              const from = bellField(lessonNumber, "from");
              const to = bellField(lessonNumber, "to");

              return (
                <div className="contents" key={lessonNumber}>
                  <TimeField
                    error={state.fieldErrors?.[from]}
                    label={BELLS_SECTION.timeFrom(lessonNumber)}
                    name={from}
                    stored={stored.get(lessonNumber)?.timeFrom}
                    state={state}
                  />
                  <TimeField
                    error={state.fieldErrors?.[to]}
                    label={BELLS_SECTION.timeTo(lessonNumber)}
                    name={to}
                    stored={stored.get(lessonNumber)?.timeTo}
                    state={state}
                  />
                </div>
              );
            })}
          </div>

          <p className="text-muted-foreground text-sm">{BELLS_SECTION.shared}</p>

          <FormMessage>{state.error}</FormMessage>

          <SubmitButton pendingLabel={ACTION_LABELS.saving}>
            {ACTION_LABELS.save}
          </SubmitButton>
        </form>
      </Row>
    </Section>
  );
}

function TimeField({
  name,
  label,
  state,
  stored,
  error,
}: {
  name: string;
  label: string;
  state: FormState;
  stored?: string;
  error?: string;
}) {
  return (
    <FormField error={error} label={label} name={name}>
      {(props) => (
        // No `required`: an empty row is a lesson number the teacher does not
        // use, and the pair is checked together by `bellScheduleInput`.
        <Input
          {...props}
          type="time"
          defaultValue={fieldValue(state, name, stored)}
        />
      )}
    </FormField>
  );
}
